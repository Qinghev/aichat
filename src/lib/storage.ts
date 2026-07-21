import { makeInitialState } from "../data/seed";
import { defaultGlobalSkillPrompt } from "./globalSkillTemplate";
import { applyWeeklyWalletCredit, normalizeWallet } from "./wallet";
import { advanceLocalLife } from "./lifeStream";
import type { AppState, MediaAsset } from "../types";

const STORAGE_KEY = "ai-chat-sandbox-state-v1";
const isLegacyRemoteAsset = (url?: string) =>
  Boolean(url && /(?:i\.pravatar\.cc|picsum\.photos|images\.unsplash\.com)/.test(url));

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

export const loadAppState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return advanceLocalLife(applyWeeklyWalletCredit(migrateState(makeInitialState())));
    const parsed = JSON.parse(raw) as AppState;
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
  } catch {
    return advanceLocalLife(applyWeeklyWalletCredit(migrateState(makeInitialState())));
  }
};

export const saveAppState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Large local images can exceed WebView storage. Keep the running state usable.
  }
};

export const resetAppState = () => {
  localStorage.removeItem(STORAGE_KEY);
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
