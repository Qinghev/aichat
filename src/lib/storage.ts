import { makeInitialState } from "../data/seed";
import { defaultGlobalSkillPrompt } from "./globalSkillTemplate";
import { applyWeeklyWalletCredit, normalizeWallet } from "./wallet";
import type { AppState, MediaAsset } from "../types";

const STORAGE_KEY = "ai-chat-sandbox-state-v1";

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
  const existingMomentIds = new Set((state.moments || []).map((post) => post.id));
  const legacyChatBackgroundUrl = state.settings?.chatBackgroundUrl || "";
  const migratedMoments = (state.moments || []).map((post) => ({
    ...post,
    media: (post.media || []).map((media, index) => normalizeMedia(media, index))
  }));
  const missingSeedMoments = initialState.moments.filter((post) => !existingMomentIds.has(post.id));

  return {
    ...state,
    characters: state.characters.map((character) => {
      const seedCharacter = initialState.characters.find((item) => item.id === character.id);
      return {
        ...(seedCharacter || {}),
        ...character,
        avatarUrl: character.avatarUrl || seedCharacter?.avatarUrl || "",
        album: character.album || seedCharacter?.album || [],
        skillPrompt: character.skillPrompt || seedCharacter?.skillPrompt || "",
        skillIds: character.skillIds || seedCharacter?.skillIds || []
      };
    }),
    messages: state.messages.map((message) => ({
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
    conversations: state.conversations.map((conversation) => ({
      ...conversation,
      chatBackgroundUrl: conversation.chatBackgroundUrl || legacyChatBackgroundUrl || ""
    })),
    moments: [...migratedMoments, ...missingSeedMoments],
    user: {
      ...state.user,
      avatarUrl: state.user.avatarUrl || initialState.user.avatarUrl || ""
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
    if (!raw) return applyWeeklyWalletCredit(migrateState(makeInitialState()));
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
    if (!state.settings.momentsCoverUrl) state.settings.momentsCoverUrl = "";
    if (!state.settings.globalSkillIds) state.settings.globalSkillIds = [];
    state = applyWeeklyWalletCredit(state);
    if (!state.settings.apiKey) state.settings.providerMode = "local_mock";
    return state;
  } catch {
    return applyWeeklyWalletCredit(migrateState(makeInitialState()));
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
