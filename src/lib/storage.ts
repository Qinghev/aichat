import { makeInitialState } from "../data/seed";
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
        skillPrompt: character.skillPrompt || seedCharacter?.skillPrompt || ""
      };
    }),
    messages: state.messages.map((message) => ({
      ...message,
      media: message.media ? normalizeMedia(message.media, 0) : undefined
    })),
    moments: [...migratedMoments, ...missingSeedMoments],
    user: {
      ...state.user,
      avatarUrl: state.user.avatarUrl || initialState.user.avatarUrl || ""
    }
  };
};

export const loadAppState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateState(makeInitialState());
    const parsed = JSON.parse(raw) as AppState;
    const state = migrateState({
      ...makeInitialState(),
      ...parsed,
      settings: { ...makeInitialState().settings, ...parsed.settings },
      counters: { ...makeInitialState().counters, ...parsed.counters }
    });
    state.user = { ...state.user, consentAccepted: true };
    if (!state.settings.apiModel) state.settings.apiModel = "grok-4.3";
    if (!state.settings.apiBaseUrl) state.settings.apiBaseUrl = "https://api.x.ai/v1";
    if (!state.settings.globalSkillPrompt) state.settings.globalSkillPrompt = "";
    if (!state.settings.chatBackgroundUrl) state.settings.chatBackgroundUrl = "";
    if (!state.settings.apiKey) state.settings.providerMode = "local_mock";
    return state;
  } catch {
    return migrateState(makeInitialState());
  }
};

export const saveAppState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
