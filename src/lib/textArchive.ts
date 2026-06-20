import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { AppState, Character, Conversation, Message } from "../types";

export interface TextArchive {
  archiveVersion: 1;
  exportedAt: string;
  owner: {
    id: string;
    displayName: string;
  };
  characters: Array<
    Pick<
      Character,
      | "id"
      | "displayName"
      | "remarkName"
      | "initials"
      | "avatarColor"
      | "relationshipToUser"
      | "roleType"
      | "gender"
      | "region"
      | "occupation"
      | "signature"
      | "tags"
      | "background"
      | "personality"
      | "speechStyle"
      | "boundaries"
      | "proactivePolicy"
      | "momentsPolicy"
      | "enabled"
    >
  >;
  conversations: Array<Pick<Conversation, "id" | "characterId" | "title" | "lastMessageAt">>;
  messages: Array<
    Pick<
      Message,
      "id" | "conversationId" | "senderType" | "senderCharacterId" | "content" | "riskLevel" | "createdAt" | "modelName"
    >
  >;
}

const archiveFileName = () => `weichat-text-archive-${new Date().toISOString().slice(0, 10)}.json`;

export const makeTextArchive = (state: AppState): TextArchive => ({
  archiveVersion: 1,
  exportedAt: new Date().toISOString(),
  owner: {
    id: state.user.id,
    displayName: state.user.displayName
  },
  characters: state.characters.map((character) => ({
    id: character.id,
    displayName: character.displayName,
    remarkName: character.remarkName,
    initials: character.initials,
    avatarColor: character.avatarColor,
    relationshipToUser: character.relationshipToUser,
    roleType: character.roleType,
    gender: character.gender,
    region: character.region,
    occupation: character.occupation,
    signature: character.signature,
    tags: character.tags,
    background: character.background,
    personality: character.personality,
    speechStyle: character.speechStyle,
    boundaries: character.boundaries,
    proactivePolicy: character.proactivePolicy,
    momentsPolicy: character.momentsPolicy,
    enabled: character.enabled
  })),
  conversations: state.conversations.map((conversation) => ({
    id: conversation.id,
    characterId: conversation.characterId,
    title: conversation.title,
    lastMessageAt: conversation.lastMessageAt
  })),
  messages: state.messages
    .filter((message) => message.contentType === "text" && (message.senderType === "user" || message.senderType === "ai"))
    .map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderCharacterId: message.senderCharacterId,
      content: message.content,
      riskLevel: message.riskLevel,
      createdAt: message.createdAt,
      modelName: message.modelName
    }))
});

export const downloadTextArchive = (state: AppState) => {
  const blob = new Blob([JSON.stringify(makeTextArchive(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = archiveFileName();
  anchor.click();
  URL.revokeObjectURL(url);
};

export const sendTextArchive = async (state: AppState, endpoint: string) => {
  if (!endpoint.trim()) throw new Error("Text backup endpoint is empty.");
  const archive = makeTextArchive(state);
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url: endpoint,
      headers: { "Content-Type": "application/json" },
      data: archive,
      responseType: "json"
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Backup failed with HTTP ${response.status}.`);
    }
    return;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(archive)
  });
  if (!response.ok) throw new Error(`Backup failed with HTTP ${response.status}.`);
};

export const mergeTextArchive = (state: AppState, archive: TextArchive): AppState => {
  if (archive.archiveVersion !== 1) throw new Error("Unsupported text archive version.");
  const existingMessageIds = new Set(state.messages.map((message) => message.id));
  const incomingMessages: Message[] = archive.messages
    .filter((message) => !existingMessageIds.has(message.id))
    .map((message) => ({
      ...message,
      contentType: "text",
      aiGenerated: message.senderType === "ai"
    }));

  const characterById = new Map(state.characters.map((character) => [character.id, character]));
  for (const character of archive.characters) {
    const existing = characterById.get(character.id);
    characterById.set(character.id, existing ? { ...existing, ...character } : ({ ...character } as Character));
  }

  const conversationById = new Map(state.conversations.map((conversation) => [conversation.id, conversation]));
  for (const conversation of archive.conversations) {
    const existing = conversationById.get(conversation.id);
    conversationById.set(
      conversation.id,
      existing
        ? { ...existing, ...conversation }
        : {
            ...conversation,
            pinned: false,
            muted: false,
            unreadCount: 0
          }
    );
  }

  return {
    ...state,
    characters: Array.from(characterById.values()),
    conversations: Array.from(conversationById.values()),
    messages: [...state.messages, ...incomingMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  };
};
