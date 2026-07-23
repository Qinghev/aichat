import { makeInitialState } from "../data/seed";
import { defaultGlobalSkillPrompt } from "./globalSkillTemplate";
import { applyWeeklyWalletCredit, normalizeWallet } from "./wallet";
import { advanceLocalLife } from "./lifeStream";
import type { AppState, MediaAsset } from "../types";

const STORAGE_KEY = "ai-chat-sandbox-state-v1";
const STORAGE_VERSION = 2;
const DATABASE_NAME = "weichat-local-state";
const DATABASE_STORE = "app-state";
const DATABASE_KEY = "current";

interface StoredStateEnvelope {
  storageVersion: number;
  savedAt: number;
  state: AppState;
}

let latestLocalSavedAt = 0;
let pendingRichEnvelope: StoredStateEnvelope | null = null;
let richWritePromise: Promise<void> | null = null;

const isLegacyRemoteAsset = (url?: string) =>
  Boolean(url && /(?:i\.pravatar\.cc|picsum\.photos|images\.unsplash\.com)/.test(url));

const parseStoredEnvelope = (value: unknown): StoredStateEnvelope | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredStateEnvelope> & Partial<AppState>;
  if (candidate.state && typeof candidate.savedAt === "number") {
    return {
      storageVersion: candidate.storageVersion || STORAGE_VERSION,
      savedAt: candidate.savedAt,
      state: candidate.state
    };
  }
  if (candidate.user && candidate.settings) {
    return {
      storageVersion: 1,
      savedAt: 0,
      state: candidate as AppState
    };
  }
  return null;
};

const stripInlineUrl = (url?: string) => (url?.startsWith("data:") ? "" : url || "");

const lightweightState = (state: AppState): AppState => {
  const copy = JSON.parse(JSON.stringify(state)) as AppState;
  copy.user.avatarUrl = stripInlineUrl(copy.user.avatarUrl);
  copy.characters = copy.characters.map((character) => ({
    ...character,
    avatarUrl: stripInlineUrl(character.avatarUrl),
    album: (character.album || []).map((asset) => ({
      ...asset,
      url: stripInlineUrl(asset.url),
      thumbUrl: stripInlineUrl(asset.thumbUrl)
    }))
  }));
  copy.conversations = copy.conversations.map((conversation) => ({
    ...conversation,
    chatBackgroundUrl: stripInlineUrl(conversation.chatBackgroundUrl)
  }));
  copy.messages = copy.messages.map((message) => ({
    ...message,
    media: message.media
      ? {
          ...message.media,
          url: stripInlineUrl(message.media.url),
          thumbUrl: stripInlineUrl(message.media.thumbUrl)
        }
      : undefined
  }));
  copy.moments = copy.moments.map((post) => ({
    ...post,
    media: post.media.map((asset) => ({
      ...asset,
      url: stripInlineUrl(asset.url),
      thumbUrl: stripInlineUrl(asset.thumbUrl)
    }))
  }));
  copy.memories = copy.memories.map((memory) => ({
    ...memory,
    media: memory.media
      ? {
          ...memory.media,
          url: stripInlineUrl(memory.media.url),
          thumbUrl: stripInlineUrl(memory.media.thumbUrl)
        }
      : undefined
  }));
  copy.settings = {
    ...copy.settings,
    chatBackgroundUrl: stripInlineUrl(copy.settings.chatBackgroundUrl),
    momentsCoverUrl: stripInlineUrl(copy.settings.momentsCoverUrl)
  };
  return copy;
};

const mergeAsset = (snapshot?: MediaAsset, rich?: MediaAsset): MediaAsset | undefined => {
  if (!snapshot) return rich;
  if (!rich) return snapshot;
  return {
    ...rich,
    ...snapshot,
    url: snapshot.url || rich.url,
    thumbUrl: snapshot.thumbUrl || rich.thumbUrl
  };
};

const hydrateRichMedia = (snapshot: AppState, rich: AppState): AppState => {
  const richCharacters = new Map(rich.characters.map((character) => [character.id, character]));
  const richConversations = new Map(rich.conversations.map((conversation) => [conversation.id, conversation]));
  const richMessages = new Map(rich.messages.map((message) => [message.id, message]));
  const richMoments = new Map(rich.moments.map((post) => [post.id, post]));
  const richMemories = new Map(rich.memories.map((memory) => [memory.id, memory]));

  return {
    ...snapshot,
    user: {
      ...snapshot.user,
      avatarUrl: snapshot.user.avatarUrl || rich.user.avatarUrl
    },
    characters: snapshot.characters.map((character) => {
      const richCharacter = richCharacters.get(character.id);
      const richAlbum = new Map((richCharacter?.album || []).map((asset) => [asset.id, asset]));
      return {
        ...character,
        avatarUrl: character.avatarUrl || richCharacter?.avatarUrl,
        album: (character.album || []).map((asset) => mergeAsset(asset, richAlbum.get(asset.id))!)
      };
    }),
    conversations: snapshot.conversations.map((conversation) => ({
      ...conversation,
      chatBackgroundUrl:
        conversation.chatBackgroundUrl || richConversations.get(conversation.id)?.chatBackgroundUrl || ""
    })),
    messages: snapshot.messages.map((message) => ({
      ...message,
      media: mergeAsset(message.media, richMessages.get(message.id)?.media)
    })),
    moments: snapshot.moments.map((post) => {
      const richMedia = new Map((richMoments.get(post.id)?.media || []).map((asset) => [asset.id, asset]));
      return {
        ...post,
        media: post.media.map((asset) => mergeAsset(asset, richMedia.get(asset.id))!)
      };
    }),
    memories: snapshot.memories.map((memory) => ({
      ...memory,
      media: mergeAsset(memory.media, richMemories.get(memory.id)?.media)
    })),
    settings: {
      ...snapshot.settings,
      chatBackgroundUrl: snapshot.settings.chatBackgroundUrl || rich.settings.chatBackgroundUrl,
      momentsCoverUrl: snapshot.settings.momentsCoverUrl || rich.settings.momentsCoverUrl
    }
  };
};

const openStateDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DATABASE_STORE)) {
        request.result.createObjectStore(DATABASE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open local database."));
  });

const readRichEnvelope = async (): Promise<StoredStateEnvelope | null> => {
  const database = await openStateDatabase();
  try {
    return await new Promise<StoredStateEnvelope | null>((resolve, reject) => {
      const transaction = database.transaction(DATABASE_STORE, "readonly");
      const request = transaction.objectStore(DATABASE_STORE).get(DATABASE_KEY);
      request.onsuccess = () => resolve(parseStoredEnvelope(request.result));
      request.onerror = () => reject(request.error || new Error("Unable to read local state."));
    });
  } finally {
    database.close();
  }
};

const writeRichEnvelope = async (envelope: StoredStateEnvelope) => {
  const database = await openStateDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DATABASE_STORE, "readwrite");
      transaction.objectStore(DATABASE_STORE).put(envelope, DATABASE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Unable to persist local state."));
      transaction.onabort = () => reject(transaction.error || new Error("Local state write was aborted."));
    });
  } finally {
    database.close();
  }
};

const scheduleRichWrite = () => {
  if (richWritePromise) return richWritePromise;
  richWritePromise = (async () => {
    while (pendingRichEnvelope) {
      const envelope = pendingRichEnvelope;
      pendingRichEnvelope = null;
      await writeRichEnvelope(envelope);
    }
  })()
    .catch(() => undefined)
    .finally(() => {
      richWritePromise = null;
      if (pendingRichEnvelope) void scheduleRichWrite();
    });
  return richWritePromise;
};

const normalizeMedia = (item: Partial<MediaAsset> & { tone?: string }, index: number): MediaAsset => ({
  id: item.id || `media_migrated_${index}`,
  type: item.type || "image",
  url: item.url || "",
  thumbUrl: item.thumbUrl,
  title: item.title,
  sourceUrl: item.sourceUrl,
  width: item.width,
  height: item.height,
  emoji: item.emoji,
  label: item.label,
  tone: item.tone
});

const migrateState = (state: AppState): AppState => {
  const initialState = makeInitialState();
  const deletedCharacterIds = state.deletedCharacterIds || [];
  const deletedCharacterIdSet = new Set(deletedCharacterIds);
  const existingMomentIds = new Set((state.moments || []).map((post) => post.id));
  const legacyChatBackgroundUrl = state.settings?.chatBackgroundUrl || "";
  const migratedMoments = (state.moments || []).map((post) => {
    const seedPost = initialState.moments.find((item) => item.id === post.id);
    return {
      ...post,
      media: (post.media || []).map((media, index) => {
        const normalized = normalizeMedia(media, index);
        return isLegacyRemoteAsset(normalized.url) && seedPost?.media[index]
          ? { ...normalized, url: seedPost.media[index].url }
          : normalized;
      })
    };
  });
  const missingSeedMoments = initialState.moments.filter(
    (post) => !existingMomentIds.has(post.id) && (!post.authorCharacterId || !deletedCharacterIdSet.has(post.authorCharacterId))
  );
  const existingConversationIds = new Set((state.conversations || []).map((conversation) => conversation.id));
  const missingSeedConversations = initialState.conversations.filter(
    (conversation) =>
      conversation.memberCharacterIds &&
      conversation.memberCharacterIds.length > 1 &&
      !conversation.memberCharacterIds.some((characterId) => deletedCharacterIdSet.has(characterId)) &&
      !existingConversationIds.has(conversation.id)
  );
  const existingMessageIds = new Set((state.messages || []).map((message) => message.id));
  const missingSeedMessages = initialState.messages.filter(
    (message) => missingSeedConversations.some((conversation) => conversation.id === message.conversationId) && !existingMessageIds.has(message.id)
  );

  return {
    ...state,
    characters: state.characters.filter((character) => !deletedCharacterIdSet.has(character.id)).map((character) => {
      const seedCharacter = initialState.characters.find((item) => item.id === character.id);
      return {
        ...(seedCharacter || {}),
        ...character,
        avatarUrl:
          !character.avatarUrl || isLegacyRemoteAsset(character.avatarUrl)
            ? seedCharacter?.avatarUrl || ""
            : character.avatarUrl,
        album:
          !character.album?.length || character.album.some((media) => isLegacyRemoteAsset(media.url))
            ? seedCharacter?.album || character.album || []
            : character.album,
        skillPrompt: character.skillPrompt || seedCharacter?.skillPrompt || "",
        skillIds: character.skillIds || seedCharacter?.skillIds || [],
        apiTextModel: character.apiTextModel || seedCharacter?.apiTextModel || "",
        apiImageModel: character.apiImageModel || seedCharacter?.apiImageModel || "",
        boundaries: {
          ...(seedCharacter?.boundaries || character.boundaries),
          ...character.boundaries,
          mustDiscloseAi: false
        }
      };
    }),
    deletedCharacterIds,
    characterRelationships: (state.characterRelationships || initialState.characterRelationships).filter(
      (relationship) =>
        !deletedCharacterIdSet.has(relationship.characterAId) &&
        !deletedCharacterIdSet.has(relationship.characterBId)
    ),
    messages: [
      ...state.messages.map((message) => ({
        ...message,
        media: message.media ? normalizeMedia(message.media, 0) : undefined,
        redPacket: message.redPacket
          ? {
              amount: Number(message.redPacket.amount) || 0,
              blessing: message.redPacket.blessing || message.content || "",
              status: message.redPacket.status || "sent",
              openedAt: message.redPacket.openedAt
            }
          : undefined
      })),
      ...missingSeedMessages
    ],
    conversations: [
      ...state.conversations.map((conversation) => ({
        ...conversation,
        memberCharacterIds: conversation.memberCharacterIds?.length ? conversation.memberCharacterIds : [conversation.characterId],
        chatBackgroundUrl: conversation.chatBackgroundUrl || legacyChatBackgroundUrl || "",
        folded: Boolean(conversation.folded),
        forceNotify: Boolean(conversation.forceNotify)
      })),
      ...missingSeedConversations
    ],
    moments: [...migratedMoments, ...missingSeedMoments]
      .filter((post) => !post.authorCharacterId || !deletedCharacterIdSet.has(post.authorCharacterId))
      .map((post) => ({
        ...post,
        interactions: post.interactions.filter(
          (interaction) => !interaction.actorCharacterId || !deletedCharacterIdSet.has(interaction.actorCharacterId)
        )
      })),
    lifeEvents: state.lifeEvents || [],
    memories: (state.memories || []).map((memory) => ({
      ...memory,
      favoriteKind: memory.favoriteKind || (memory.type === "event" && memory.content.startsWith("收藏了") ? "message" : memory.favoriteKind),
      media: memory.media ? normalizeMedia(memory.media, 0) : undefined
    })),
    user: {
      ...initialState.user,
      ...state.user,
      gender: state.user.gender || initialState.user.gender || "unknown",
      avatarUrl:
        !state.user.avatarUrl || isLegacyRemoteAsset(state.user.avatarUrl)
          ? initialState.user.avatarUrl || ""
          : state.user.avatarUrl
    },
    settings: {
      ...initialState.settings,
      ...state.settings,
      globalSkillIds: state.settings?.globalSkillIds || initialState.settings.globalSkillIds || []
    },
    wallet: normalizeWallet(state.wallet)
  };
};

const normalizeLoadedState = (parsed: AppState): AppState => {
  let state = migrateState({
      ...makeInitialState(),
      ...parsed,
      settings: { ...makeInitialState().settings, ...parsed.settings },
      wallet: { ...makeInitialState().wallet, ...parsed.wallet },
      counters: { ...makeInitialState().counters, ...parsed.counters }
    });
  state.user = { ...state.user, consentAccepted: true };
  if (!state.settings.apiModel) state.settings.apiModel = "grok-4.3";
  if (!state.settings.apiTextModel) state.settings.apiTextModel = state.settings.apiModel || "grok-4.3";
  if (!state.settings.apiImageModel) state.settings.apiImageModel = "grok-imagine-image-quality";
  if (!state.settings.apiImageSize) state.settings.apiImageSize = "1k";
  if (!state.settings.apiBaseUrl) state.settings.apiBaseUrl = "https://yunwu.ai/v1";
  if (!state.settings.globalSkillPrompt) state.settings.globalSkillPrompt = defaultGlobalSkillPrompt;
  if (!state.settings.chatBackgroundUrl) state.settings.chatBackgroundUrl = "";
  if (!state.settings.momentsCoverUrl) state.settings.momentsCoverUrl = makeInitialState().settings.momentsCoverUrl;
  if (!state.settings.globalSkillIds) state.settings.globalSkillIds = [];
  state.settings.aiDisclosureAlwaysOn = false;
  state = applyWeeklyWalletCredit(state);
  if (!state.settings.apiKey) state.settings.providerMode = "local_mock";
  return advanceLocalLife(state);
};

export const loadAppState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeLoadedState(makeInitialState());
    const envelope = parseStoredEnvelope(JSON.parse(raw));
    if (!envelope) return normalizeLoadedState(makeInitialState());
    latestLocalSavedAt = envelope.savedAt;
    return normalizeLoadedState(envelope.state);
  } catch {
    return normalizeLoadedState(makeInitialState());
  }
};

export const hydrateAppState = async (snapshot: AppState): Promise<AppState> => {
  try {
    const envelope = await readRichEnvelope();
    if (!envelope) return snapshot;
    const richState = normalizeLoadedState(envelope.state);
    if (envelope.savedAt > latestLocalSavedAt) {
      latestLocalSavedAt = envelope.savedAt;
      return richState;
    }
    return hydrateRichMedia(snapshot, richState);
  } catch {
    return snapshot;
  }
};

export const saveAppState = (state: AppState): Promise<void> => {
  const savedAt = Math.max(Date.now(), latestLocalSavedAt + 1);
  latestLocalSavedAt = savedAt;
  const richEnvelope: StoredStateEnvelope = {
    storageVersion: STORAGE_VERSION,
    savedAt,
    state: JSON.parse(JSON.stringify(state)) as AppState
  };
  const localEnvelope: StoredStateEnvelope = {
    ...richEnvelope,
    state: lightweightState(state)
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localEnvelope));
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localEnvelope));
    } catch {
      // IndexedDB remains the full-state fallback when WebView local storage is unavailable.
    }
  }
  pendingRichEnvelope = richEnvelope;
  return scheduleRichWrite();
};

export const resetAppState = () => {
  localStorage.removeItem(STORAGE_KEY);
  latestLocalSavedAt = 0;
  pendingRichEnvelope = null;
  void openStateDatabase()
    .then(
      (database) =>
        new Promise<void>((resolve) => {
          const transaction = database.transaction(DATABASE_STORE, "readwrite");
          transaction.objectStore(DATABASE_STORE).delete(DATABASE_KEY);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            database.close();
            resolve();
          };
        })
    )
    .catch(() => undefined);
};

export const exportAppState = (state: AppState) => {
  const safeState = {
    ...state,
    settings: {
      ...state.settings,
      apiKey: ""
    }
  };
  const blob = new Blob([JSON.stringify(safeState, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `weichat-full-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};
