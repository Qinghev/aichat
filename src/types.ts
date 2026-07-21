export type SenderType = "user" | "ai" | "system";
export type RiskLevel = "L0" | "L1" | "L2" | "L3" | "L4";
export type TabKey = "chats" | "contacts" | "moments" | "me";
export type AuditMode = "safety_summary" | "full_transcript";
export type ProviderMode = "local_mock" | "openai_compatible";
export type SkillId =
  | "warm_followup"
  | "logic_canvas"
  | "memory_callback"
  | "scene_roleplay"
  | "image_search"
  | "red_packet"
  | "playful_combo";

export interface MediaAsset {
  id: string;
  type: "image" | "sticker";
  url: string;
  thumbUrl?: string;
  title?: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
  emoji?: string;
  label?: string;
  tone?: string;
}

export interface Personality {
  warmth: number;
  humor: number;
  initiative: number;
  rationality: number;
  emotionalSupport: number;
  directness: number;
}

export interface Character {
  id: string;
  displayName: string;
  remarkName: string;
  initials: string;
  avatarColor: string;
  avatarUrl?: string;
  relationshipToUser: string;
  roleType: string;
  gender?: "female" | "male" | "unknown";
  region?: string;
  occupation?: string;
  signature?: string;
  album?: MediaAsset[];
  tags?: string[];
  background: string;
  skillPrompt?: string;
  skillIds?: SkillId[];
  apiTextModel?: string;
  apiImageModel?: string;
  personality: Personality;
  speechStyle: {
    sentenceLength: "short" | "medium" | "long";
    emojiFrequency: "none" | "low" | "medium";
    tone: string;
    catchphrases: string[];
  };
  boundaries: {
    mustDiscloseAi: boolean;
    noRealPersonImpersonation: boolean;
    noDependencyInduction: boolean;
    noFinancialAdvice: boolean;
    noMedicalDiagnosis: boolean;
  };
  proactivePolicy: {
    enabled: boolean;
    maxMessagesPerDay: number;
    quietHours: [string, string];
    allowedTopics: string[];
  };
  momentsPolicy: {
    enabled: boolean;
    maxPostsPerDay: number;
    visibility: "only_current_user";
  };
  enabled: boolean;
}

export interface CharacterRelationship {
  id: string;
  characterAId: string;
  characterBId: string;
  label: string;
  note?: string;
}

export interface Conversation {
  id: string;
  characterId: string;
  memberCharacterIds?: string[];
  title: string;
  pinned: boolean;
  muted: boolean;
  unreadCount: number;
  lastMessageAt: string;
  chatBackgroundUrl?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderCharacterId?: string;
  contentType: "text" | "image" | "sticker" | "audio" | "red_packet" | "system";
  content: string;
  media?: MediaAsset;
  redPacket?: {
    amount: number;
    blessing: string;
    status: "sent" | "unopened" | "opened";
    openedAt?: string;
  };
  aiGenerated: boolean;
  riskLevel: RiskLevel;
  createdAt: string;
  modelName: string;
}

export interface MomentInteraction {
  id: string;
  actorCharacterId: string;
  type: "like" | "comment";
  content?: string;
  aiGenerated: boolean;
  createdAt: string;
}

export interface MomentPost {
  id: string;
  ownerUserId: string;
  authorCharacterId?: string;
  authorUserId?: string;
  content: string;
  media: MediaAsset[];
  visibility: "only_owner";
  aiGenerated: boolean;
  generationReason: string;
  riskLevel: RiskLevel;
  createdAt: string;
  interactions: MomentInteraction[];
}

export interface MemoryNote {
  id: string;
  type: "preference" | "event" | "risk" | "personality";
  content: string;
  title?: string;
  excerpt?: string;
  conversationTitle?: string;
  senderLabel?: string;
  favoriteKind?: "message" | "note" | "tool" | "moment";
  media?: MediaAsset;
  sensitivity: "low" | "medium" | "high";
  sourceConversationId?: string;
  createdAt: string;
}

export interface LifeEvent {
  id: string;
  type: "message" | "group" | "moment";
  title: string;
  preview: string;
  characterIds: string[];
  conversationId?: string;
  momentId?: string;
  createdAt: string;
  seen: boolean;
}

export interface AuditEvent {
  id: string;
  eventType: "risk" | "admin_view" | "export" | "delete_request" | "consent_change";
  riskLevel?: RiskLevel;
  summary: string;
  evidenceMessageIds: string[];
  createdAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  gender?: "female" | "male" | "unknown";
  consentAccepted: boolean;
  consentVersion: string;
  ageGroup: "adult" | "unknown";
  lastActiveAt: string;
}

export interface Settings {
  auditMode: AuditMode;
  providerMode: ProviderMode;
  proactiveEnabled: boolean;
  momentsEnabled: boolean;
  dailyProactiveLimit: number;
  aiDisclosureAlwaysOn: boolean;
  quietHours: [string, string];
  apiKey: string;
  apiBaseUrl: string;
  apiModel: string;
  apiTextModel: string;
  apiImageModel: string;
  apiImageSize: string;
  globalSkillPrompt: string;
  globalSkillIds: SkillId[];
  chatBackgroundUrl: string;
  momentsCoverUrl: string;
  textBackupEndpoint: string;
  autoTextBackup: boolean;
}

export interface Wallet {
  balance: number;
  weeklyAllowance: number;
  lastWeeklyCreditAt: string;
  totalSent: number;
  totalReceived: number;
}

export interface AppState {
  user: UserProfile;
  characters: Character[];
  characterRelationships: CharacterRelationship[];
  conversations: Conversation[];
  messages: Message[];
  moments: MomentPost[];
  lifeEvents: LifeEvent[];
  memories: MemoryNote[];
  auditEvents: AuditEvent[];
  settings: Settings;
  wallet: Wallet;
  counters: {
    todayProactiveCount: number;
    lastProactiveDate: string;
    lastLifeRefreshAt?: string;
    lifeStreamVersion?: number;
  };
}
