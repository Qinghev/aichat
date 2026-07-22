import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { ChangeEvent, CSSProperties, FormEvent, ReactNode, TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import { seedCharacters } from "./data/seed";
import { exportAppState, loadAppState, resetAppState, saveAppState } from "./lib/storage";
import { formatMomentTime, formatTime, todayKey } from "./lib/time";
import {
  LocalPersonaProvider,
  generateMoment,
  makeProactiveMessage,
  messageSummary,
  updateMemoryFromMessage
} from "./lib/localAi";
import { hasConfiguredProvider, makeConfiguredProvider } from "./lib/llm";
import { generateImageAsset } from "./lib/imageGeneration";
import {
  cacheImageAsset,
  fileToMediaAsset,
  imageQueryFromText,
  momentImageQuery,
  searchImages,
  shouldAttachImageFromText,
  stickerPack
} from "./lib/media";
import { downloadTextArchive, mergeTextArchive, type TextArchive } from "./lib/textArchive";
import { checkForInternalUpdate } from "./lib/updater";
import { formatMoney, normalizeWallet, pickRedPacketAmount } from "./lib/wallet";
import { hasSkill, mergeSkillIds, skillCombos, skillPresets, toggleSkillId } from "./lib/skills";
import { defaultGlobalSkillPrompt } from "./lib/globalSkillTemplate";
import { advanceLocalLife } from "./lib/lifeStream";
import type {
  AppState,
  Character,
  CharacterRelationship,
  Conversation,
  MediaAsset,
  MemoryNote,
  Message,
  MomentPost,
  SkillId,
  TabKey,
  UserProfile
} from "./types";

const localProvider = new LocalPersonaProvider();
const defaultMomentsCoverUrl = new URL("../assets/moments/street.jpg", import.meta.url).href;

const tabOrder: TabKey[] = ["chats", "contacts", "moments", "me"];
const textModelOptions = [
  "grok-4",
  "grok-4.3",
  "grok-3",
  "grok-3-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "o3",
  "o4-mini",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "deepseek-chat",
  "deepseek-reasoner",
  "qwen-plus",
  "qwen-max",
  "qwen-turbo",
  "qwen3-235b-a22b",
  "kimi-latest",
  "glm-4.5"
];
const imageModelOptions = [
  "grok-imagine-image-quality",
  "grok-2-image",
  "gpt-image-1",
  "gpt-image-2",
  "dall-e-3",
  "gemini-2.5-flash-image-preview",
  "imagen-4",
  "flux.1-kontext-pro",
  "flux.1-dev"
];
const imageSizeOptions = ["1k", "2k", "1024x1024", "1792x1024", "1024x1792", "1536x1024", "1024x1536"];

type PendingReply = {
  id: string;
  conversationId: string;
  userMessageId: string;
  characterId?: string;
  content: string;
  createdAt: string;
};

type ToolKey = "research" | "document" | "background" | "role";

const uiIconAssets = {
  "tab-chat": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_tab_chats_outlined.svg", import.meta.url).href,
  "tab-chat-filled": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_tab_chats_filled.svg", import.meta.url).href,
  "tab-contacts": new URL("../assets/wechat-ui-icons/outlined/my_audit_contacts.svg", import.meta.url).href,
  "tab-contacts-filled": new URL("../assets/wechat-ui-icons/filled/my_audit_contacts.svg", import.meta.url).href,
  "tab-discover": new URL("../assets/wechat-ui-icons/outlined/my_audit_discover.svg", import.meta.url).href,
  "tab-discover-filled": new URL("../assets/wechat-ui-icons/filled/my_audit_discover.svg", import.meta.url).href,
  "tab-me": new URL("../assets/wechat-ui-icons/outlined/my_audit_me.svg", import.meta.url).href,
  "tab-me-filled": new URL("../assets/wechat-ui-icons/filled/my_audit_me.svg", import.meta.url).href,
  add: new URL("../assets/wechat-ui-icons/outlined/my_audit_add.svg", import.meta.url).href,
  "plus-circle": new URL("../assets/wechat-ui-icons/outlined/my_audit_add_circle.svg", import.meta.url).href,
  arrow: new URL("../assets/wechat-ui-icons/outlined/my_audit_arrow.svg", import.meta.url).href,
  back: new URL("../assets/wechat-ui-icons/outlined/my_audit_back.svg", import.meta.url).href,
  voice: new URL("../assets/wechat-ui-icons/outlined/my_audit_voice.svg", import.meta.url).href,
  emoji: new URL("../assets/wechat-ui-icons/outlined/my_audit_sticker.svg", import.meta.url).href,
  album: new URL("../assets/wechat-ui-icons/outlined/my_audit_album.svg", import.meta.url).href,
  "qr-code": new URL("../assets/wechat-ui-icons/outlined/my_audit_qr_code.svg", import.meta.url).href,
  delete: new URL("../assets/wechat-ui-icons/outlined/my_audit_delete.svg", import.meta.url).href,
  refresh: new URL("../assets/wechat-ui-icons/outlined/my_audit_refresh.svg", import.meta.url).href,
  settings: new URL("../assets/wechat-ui-icons/outlined/my_audit_setting.svg", import.meta.url).href,
  "bell-off": new URL("../assets/wechat-ui-icons/outlined/my_audit_bellring_off.svg", import.meta.url).href,
  close: new URL("../assets/wechat-ui-icons/outlined/my_audit_close.svg", import.meta.url).href,
  copy: new URL("../assets/wechat-ui-icons/outlined/my_audit_copy.svg", import.meta.url).href,
  note: new URL("../assets/wechat-ui-icons/outlined/my_audit_note.svg", import.meta.url).href,
  star: new URL("../assets/wechat-ui-icons/outlined/my_audit_star.svg", import.meta.url).href,
  tag: new URL("../assets/wechat-ui-icons/outlined/my_audit_tag.svg", import.meta.url).href,
  upload: new URL("../assets/wechat-ui-icons/outlined/my_audit_share.svg", import.meta.url).href,
  profile: new URL("../assets/wechat-ui-icons/outlined/my_audit_me.svg", import.meta.url).href,
  "contact-add": new URL("../assets/wechat-ui-icons/outlined/my_audit_add_friends.svg", import.meta.url).href,
  "contact-entry-new": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_contact_new_friend.png", import.meta.url).href,
  "contact-entry-group": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_contact_group.png", import.meta.url).href,
  "contact-entry-tag": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_contact_tag.png", import.meta.url).href,
  "contact-entry-official": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_contact_official.png", import.meta.url).href,
  "new-friend": new URL("../assets/wechat-ui-icons/filled/my_audit_add_friends.svg", import.meta.url).href,
  group: new URL("../assets/wechat-ui-icons/filled/my_audit_contacts.svg", import.meta.url).href,
  official: new URL("../assets/wechat-ui-icons/weixin-homepage/my_audit_official_account.svg", import.meta.url).href,
  moments: new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_moments_filled.svg", import.meta.url).href,
  "discover-moments": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_discover_moments_color.svg", import.meta.url).href,
  channels: new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_channels_finder.svg", import.meta.url).href,
  live: new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_discover_live.svg", import.meta.url).href,
  scan: new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_discover_scan.svg", import.meta.url).href,
  look: new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_discover_news.svg", import.meta.url).href,
  "search-grid": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_discover_searchlogo.svg", import.meta.url).href,
  search: new URL("../assets/wechat-ui-icons/outlined/my_audit_search.svg", import.meta.url).href,
  location: new URL("../assets/wechat-ui-icons/outlined/my_audit_location.svg", import.meta.url).href,
  shop: new URL("../assets/wechat-ui-icons/filled/my_audit_shop.svg", import.meta.url).href,
  game: new URL("../assets/wechat-ui-icons/weixin-homepage/my_audit_mini_game.png", import.meta.url).href,
  mini: new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_discover_miniprogram.svg", import.meta.url).href,
  services: new URL("../assets/wechat-ui-icons/filled/my_audit_transfer.svg", import.meta.url).href,
  favorite: new URL("../assets/wechat-ui-icons/filled/my_audit_like.svg", import.meta.url).href,
  card: new URL("../assets/wechat-ui-icons/filled/my_audit_transfer.svg", import.meta.url).href,
  sticker: new URL("../assets/wechat-ui-icons/filled/my_audit_sticker.svg", import.meta.url).href,
  camera: new URL("../assets/wechat-ui-icons/filled/my_audit_camera.svg", import.meta.url).href,
  more: new URL("../assets/wechat-ui-icons/filled/my_audit_more.svg", import.meta.url).href,
  comment: new URL("../assets/wechat-ui-icons/filled/my_audit_comment.svg", import.meta.url).href,
  like: new URL("../assets/wechat-ui-icons/outlined/my_audit_like.svg", import.meta.url).href,
  "like-filled": new URL("../assets/wechat-ui-icons/filled/my_audit_like.svg", import.meta.url).href,
  share: new URL("../assets/wechat-ui-icons/filled/my_audit_share.svg", import.meta.url).href,
  "profile-pay": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_profile_wechatpay.svg", import.meta.url).href,
  "profile-favorite": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_profile_favorites.svg", import.meta.url).href,
  "profile-card": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_profile_cards.svg", import.meta.url).href,
  "profile-sticker": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_profile_sticker.svg", import.meta.url).href,
  "profile-setting": new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_profile_setting.svg", import.meta.url).href
} as const;

const createId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const messagePreview = (message?: Message) => {
  if (!message) return "还没有消息";
  if (message.contentType === "image") return "[图片]";
  if (message.contentType === "sticker") return `[表情] ${message.media?.label || message.content}`;
  if (message.contentType === "red_packet") return `[红包] ${message.redPacket?.blessing || message.content}`;
  return message.content;
};

const personalityLabels: Array<{ key: keyof Character["personality"]; label: string }> = [
  { key: "warmth", label: "温柔" },
  { key: "humor", label: "幽默" },
  { key: "initiative", label: "主动" },
  { key: "rationality", label: "理性" },
  { key: "emotionalSupport", label: "共情" },
  { key: "directness", label: "直接" }
];

const genderText = (gender?: Character["gender"]) => {
  if (gender === "female") return "女";
  if (gender === "male") return "男";
  return "未设置";
};

const pinyinBoundaries: Array<[string, string]> = [
  ["A", "阿"], ["B", "芭"], ["C", "擦"], ["D", "搭"], ["E", "蛾"], ["F", "发"],
  ["G", "噶"], ["H", "哈"], ["J", "讥"], ["K", "喀"], ["L", "垃"], ["M", "妈"],
  ["N", "拿"], ["O", "哦"], ["P", "啪"], ["Q", "期"], ["R", "然"], ["S", "撒"],
  ["T", "塌"], ["W", "挖"], ["X", "昔"], ["Y", "压"], ["Z", "匝"]
];

const contactInitial = (name: string) => {
  const first = name.trim().charAt(0);
  if (!first) return "#";
  if (/^[a-z]$/i.test(first)) return first.toUpperCase();
  let initial = "#";
  for (const [letter, boundary] of pinyinBoundaries) {
    if (first.localeCompare(boundary, "zh-CN-u-co-pinyin") < 0) break;
    initial = letter;
  }
  return initial;
};

function GenderSelector({
  value,
  onChange
}: {
  value?: "female" | "male" | "unknown";
  onChange: (value: "female" | "male" | "unknown") => void;
}) {
  const options = [
    { value: "female" as const, label: "女" },
    { value: "male" as const, label: "男" },
    { value: "unknown" as const, label: "未设置" }
  ];
  return (
    <div className="gender-selector" role="group" aria-label="性别">
      {options.map((option) => (
        <button
          type="button"
          className={(value || "unknown") === option.value ? "active" : ""}
          aria-pressed={(value || "unknown") === option.value}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const fallbackMomentImages = [
  new URL("../assets/moments/cafe.jpg", import.meta.url).href,
  new URL("../assets/moments/outfit.jpg", import.meta.url).href,
  new URL("../assets/moments/street.jpg", import.meta.url).href,
  new URL("../assets/moments/table.jpg", import.meta.url).href,
  new URL("../assets/moments/rain.jpg", import.meta.url).href
];

const fallbackMomentImage = (id: string) => {
  const index = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % fallbackMomentImages.length;
  return fallbackMomentImages[index];
};

const messageActionText = (message: Message) => {
  if (message.contentType === "image") return message.media?.title || "图片";
  if (message.contentType === "sticker") return message.media?.label || "表情";
  if (message.contentType === "red_packet") return `[红包] ${message.redPacket?.blessing || message.content}`;
  return message.content;
};

const shortMessagePreview = (message: Message) => {
  const text = messageActionText(message).replace(/\s+/g, " ").trim();
  return text.length > 28 ? `${text.slice(0, 28)}...` : text || "消息";
};

const modelSettingsForCharacter = (settings: AppState["settings"], character?: Character) => ({
  ...settings,
  apiTextModel: character?.apiTextModel?.trim() || settings.apiTextModel,
  apiModel: character?.apiTextModel?.trim() || settings.apiModel,
  apiImageModel: character?.apiImageModel?.trim() || settings.apiImageModel
});

function Avatar({ character, size = "md" }: { character: Character; size?: "sm" | "md" | "lg" }) {
  const style = character.avatarUrl
    ? { backgroundColor: character.avatarColor, backgroundImage: `url(${character.avatarUrl})` }
    : { background: character.avatarColor };
  return (
    <div className={`avatar avatar-${size} ${character.avatarUrl ? "avatar-image" : ""}`} style={style}>
      {!character.avatarUrl && character.initials}
    </div>
  );
}

function UserAvatar({ user, size = "md" }: { user: UserProfile; size?: "sm" | "md" | "lg" }) {
  const label = user.displayName.slice(0, 1) || "我";
  return (
    <div
      className={`avatar avatar-${size} own-avatar ${user.avatarUrl ? "avatar-image" : ""}`}
      style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
    >
      {!user.avatarUrl && label}
    </div>
  );
}

const getConversationMemberIds = (conversation: Conversation) =>
  conversation.memberCharacterIds?.length ? conversation.memberCharacterIds : [conversation.characterId];

const getConversationCharacters = (conversation: Conversation, characters: Character[]) =>
  getConversationMemberIds(conversation)
    .map((id) => characters.find((character) => character.id === id))
    .filter(Boolean) as Character[];

function ConversationAvatar({
  conversation,
  characters,
  size = "md"
}: {
  conversation: Conversation;
  characters: Character[];
  size?: "sm" | "md" | "lg";
}) {
  const members = getConversationCharacters(conversation, characters);
  if (members.length <= 1) {
    const character = members[0] || characters.find((item) => item.id === conversation.characterId) || characters[0];
    return character ? <Avatar character={character} size={size} /> : null;
  }
  return (
    <div className={`group-avatar group-avatar-${size}`}>
      {members.slice(0, 4).map((member) => (
        <span
          key={member.id}
          style={member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : { background: member.avatarColor }}
        >
          {!member.avatarUrl && member.initials}
        </span>
      ))}
    </div>
  );
}

function AiBadge() {
  return null;
}

function WeIcon({
  name,
  tone,
  active = false,
  className = "",
  size
}: {
  name: string;
  tone?: string;
  active?: boolean;
  className?: string;
  size?: number;
}) {
  const activeName = `${name}-filled` as keyof typeof uiIconAssets;
  const asset = uiIconAssets[active ? activeName : (name as keyof typeof uiIconAssets)] || uiIconAssets[name as keyof typeof uiIconAssets];
  const isFullColorAsset =
    name === "discover-moments" || name.startsWith("contact-entry-") || ["profile-pay", "profile-favorite", "profile-card"].includes(name);
  const style = {
    ...(asset ? { "--we-icon-url": `url("${asset}")` } : {}),
    ...(size ? { width: size, height: size } : {})
  } as CSSProperties;
  return (
    <span
      className={`wechat-icon ${asset ? "wechat-icon-asset" : `wechat-icon-${name}`} ${isFullColorAsset ? "wechat-icon-full-color" : ""} ${tone ? `wechat-icon-${tone}` : ""} ${className}`}
      style={style}
      aria-hidden="true"
    >
      <span />
    </span>
  );
}

function ActionSheet({
  title,
  actions,
  onClose
}: {
  title?: string;
  actions: Array<{ label: string; icon?: ReactNode; danger?: boolean; onClick: () => void }>;
  onClose: () => void;
}) {
  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="action-sheet" onClick={(event) => event.stopPropagation()}>
        {title && <div className="sheet-title">{title}</div>}
        <div className="sheet-actions">
          {actions.map((action) => (
            <button
              type="button"
              className={action.danger ? "danger" : ""}
              key={action.label}
              onClick={() => run(action.onClick)}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="sheet-cancel" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  );
}

function SkillSelector({
  value,
  onChange,
  compact = false
}: {
  value: SkillId[];
  onChange: (value: SkillId[]) => void;
  compact?: boolean;
}) {
  return (
    <div className={`skill-selector ${compact ? "compact" : ""}`}>
      <div className="skill-chip-grid">
        {skillPresets.map((skill) => {
          const active = value.includes(skill.id);
          return (
            <button
              type="button"
              className={active ? "active" : ""}
              key={skill.id}
              onClick={() => onChange(toggleSkillId(value, skill.id))}
              title={skill.description}
            >
              <b>{compact ? skill.shortLabel : skill.label}</b>
              {!compact && <span>{skill.description}</span>}
            </button>
          );
        })}
      </div>
      {!compact && (
        <div className="skill-combo-row">
          {skillCombos.map((combo) => (
            <button type="button" key={combo.id} onClick={() => onChange(mergeSkillIds(value, combo.skillIds))}>
              <span>{combo.label}</span>
              <small>{combo.description}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MainPlusMenu({
  onClose,
  actions
}: {
  actions: Array<{ label: string; icon: string; tone?: string; onClick: () => void }>;
  onClose: () => void;
}) {
  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="main-menu-layer" onClick={onClose}>
      <div className="main-plus-menu" onClick={(event) => event.stopPropagation()}>
        <span className="main-plus-menu-arrow" aria-hidden="true" />
        {actions.map((action) => (
          <button type="button" key={action.label} onClick={() => run(action.onClick)}>
            <WeIcon name={action.icon} tone={action.tone || "menu"} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GlobalSearchPanel({
  state,
  onClose,
  onOpenConversation,
  onOpenProfile
}: {
  state: AppState;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenProfile: (characterId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();
  const characters = keyword
    ? state.characters.filter((character) =>
        [character.remarkName, character.displayName, character.signature, character.roleType]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword))
      )
    : state.characters.slice(0, 5);
  const conversations = keyword
    ? state.conversations.filter((conversation) => conversation.title.toLowerCase().includes(keyword))
    : state.conversations.slice(0, 5);
  const messageResults = keyword
    ? state.messages
        .filter((message) => message.senderType !== "system" && message.contentType === "text" && message.content.toLowerCase().includes(keyword))
        .slice(-8)
        .reverse()
    : [];

  const openConversation = (conversationId: string) => {
    onClose();
    onOpenConversation(conversationId);
  };

  const openProfile = (characterId: string) => {
    onClose();
    onOpenProfile(characterId);
  };

  return (
    <div className="search-panel">
      <div className="search-panel-top">
        <div className="search-panel-input">
          <WeIcon name="search" size={18} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" />
          {query && (
            <button type="button" onClick={() => setQuery("")}>
              <WeIcon name="close" size={15} />
            </button>
          )}
        </div>
        <button type="button" onClick={onClose}>
          取消
        </button>
      </div>
      <div className="search-panel-body">
        {conversations.length > 0 && (
          <section>
            <h3>聊天</h3>
            {conversations.map((conversation) => {
              const character = state.characters.find((item) => item.id === conversation.characterId);
              return (
                <button type="button" key={conversation.id} onClick={() => openConversation(conversation.id)}>
                  {character && <Avatar character={character} size="sm" />}
                  <span>{conversation.title}</span>
                </button>
              );
            })}
          </section>
        )}
        {characters.length > 0 && (
          <section>
            <h3>联系人</h3>
            {characters.map((character) => (
              <button type="button" key={character.id} onClick={() => openProfile(character.id)}>
                <Avatar character={character} size="sm" />
                <span>{character.remarkName}</span>
              </button>
            ))}
          </section>
        )}
        {messageResults.length > 0 && (
          <section>
            <h3>聊天记录</h3>
            {messageResults.map((message) => {
              const conversation = state.conversations.find((item) => item.id === message.conversationId);
              return (
                <button type="button" key={message.id} onClick={() => conversation && openConversation(conversation.id)}>
                  <WeIcon name="tab-chat" />
                  <span>{message.content}</span>
                </button>
              );
            })}
          </section>
        )}
        {keyword && conversations.length === 0 && characters.length === 0 && messageResults.length === 0 && (
          <div className="search-empty">没有找到相关内容</div>
        )}
      </div>
    </div>
  );
}

function AvatarEditor({
  title,
  initialUrl,
  filePrefix = "avatar",
  onClose,
  onSave
}: {
  title: string;
  initialUrl?: string;
  filePrefix?: string;
  onClose: () => void;
  onSave: (avatarUrl: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl || "");

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const media = await fileToMediaAsset(file, filePrefix);
    setUrl(media.url);
    onSave(media.url);
    onClose();
  };

  return (
    <section className="profile-page local-image-page">
      <header className="chat-header profile-header">
        <button type="button" className="icon-button" onClick={onClose} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">{title}</div>
        <span />
      </header>
      <div className="local-image-body">
        <div className="local-image-preview">
          {url ? <img src={url} alt="" /> : <WeIcon name="album" size={32} />}
        </div>
        <label className="local-image-row">
          <span>从手机相册选择</span>
          <WeIcon name="arrow" size={12} className="native-chevron" />
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>
      </div>
    </section>
  );
}

function ChatsTab({
  state,
  openConversation
}: {
  state: AppState;
  openConversation: (conversationId: string) => void;
}) {
  const [showFolded, setShowFolded] = useState(false);
  const sorted = [...state.conversations].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
  const visibleConversations = sorted.filter((conversation) => !conversation.folded);
  const foldedConversations = sorted.filter((conversation) => conversation.folded);

  const renderConversation = (conversation: Conversation) => {
    const lastMessage = [...state.messages]
      .reverse()
      .find((message) => message.conversationId === conversation.id && message.senderType !== "system");
    return (
      <button
        className={`chat-row ${conversation.pinned ? "pinned" : ""}`}
        key={conversation.id}
        onClick={() => openConversation(conversation.id)}
      >
        <ConversationAvatar conversation={conversation} characters={state.characters} />
        <div className="row-main">
          <div className="row-title-line">
            <span className="row-title">{conversation.title}</span>
            <span className="row-time">{formatTime(conversation.lastMessageAt)}</span>
          </div>
          <div className="row-sub-line">
            <span className="row-preview">{messagePreview(lastMessage)}</span>
            <span className="row-icons">
              {conversation.muted && <WeIcon name="bell-off" size={13} />}
              {conversation.unreadCount > 0 && (
                conversation.muted
                  ? <span className="muted-unread-dot" aria-label={`${conversation.unreadCount}条未读消息`} />
                  : <span className="unread-dot">{conversation.unreadCount}</span>
              )}
            </span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <section className="screen-body list-body">
      <div className="search-row">
        <WeIcon name="search" size={18} />
        <span>搜索</span>
      </div>
      {visibleConversations.map(renderConversation)}
      {foldedConversations.length > 0 && (
        <>
          <button className="chat-row folded-chats-row" type="button" onClick={() => setShowFolded((value) => !value)}>
            <span className="folded-chats-icon"><WeIcon name="tab-chat-filled" size={23} /></span>
            <div className="row-main">
              <div className="row-title-line">
                <span className="row-title">折叠的聊天</span>
                <WeIcon name="arrow" size={12} className={`native-chevron ${showFolded ? "expanded" : ""}`} />
              </div>
              <div className="row-preview">{foldedConversations.length}个聊天</div>
            </div>
          </button>
          {showFolded && <div className="folded-conversation-list">{foldedConversations.map(renderConversation)}</div>}
        </>
      )}
    </section>
  );
}

function ContactsTab({
  state,
  onOpen,
  onStartGroup
}: {
  state: AppState;
  onOpen: (characterId: string) => void;
  onStartGroup: () => void;
}) {
  const sortedCharacters = [...state.characters].sort((a, b) =>
    a.remarkName.localeCompare(b.remarkName, "zh-CN-u-co-pinyin")
  );
  const groupedCharacters = sortedCharacters.reduce<Array<{ initial: string; characters: Character[] }>>((groups, character) => {
    const initial = contactInitial(character.remarkName);
    const current = groups[groups.length - 1];
    if (current?.initial === initial) current.characters.push(character);
    else groups.push({ initial, characters: [character] });
    return groups;
  }, []);

  return (
    <section className="screen-body list-body">
      <div className="utility-row static">
        <WeIcon name="contact-entry-new" />
        <span>新的朋友</span>
      </div>
      <button className="utility-row" type="button" onClick={onStartGroup}>
        <WeIcon name="contact-entry-group" />
        <span>群聊</span>
      </button>
      <div className="utility-row static">
        <WeIcon name="contact-entry-tag" />
        <span>标签</span>
      </div>
      <div className="utility-row utility-row-last static">
        <WeIcon name="contact-entry-official" />
        <span>公众号</span>
      </div>
      {groupedCharacters.map((group) => (
        <div className="contact-section" key={group.initial}>
          <div className="section-label contact-section-label">{group.initial}</div>
          {group.characters.map((character) => (
            <button className="contact-row contact-open-row" key={character.id} onClick={() => onOpen(character.id)}>
              <Avatar character={character} size="sm" />
              <div className="contact-name">
                {character.remarkName}
                <AiBadge />
              </div>
            </button>
          ))}
        </div>
      ))}
      <div className="contact-index" aria-hidden="true">
        <span>↑</span>
        {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ#").map((letter) => <span key={letter}>{letter}</span>)}
      </div>
    </section>
  );
}

function GroupCreatorPage({
  characters,
  onBack,
  onCreate
}: {
  characters: Character[];
  onBack: () => void;
  onCreate: (characterIds: string[]) => void;
}) {
  const availableCharacters = characters.filter((character) => character.enabled);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedCount = selectedIds.length;

  const toggleMember = (characterId: string) => {
    setSelectedIds((current) =>
      current.includes(characterId) ? current.filter((id) => id !== characterId) : [...current, characterId]
    );
  };

  return (
    <section className="profile-page group-creator-page">
      <header className="chat-header profile-header">
        <button className="icon-button" type="button" onClick={onBack} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">发起群聊</div>
        <button
          className="group-create-confirm"
          type="button"
          disabled={selectedCount < 2}
          onClick={() => onCreate(selectedIds)}
        >
          完成{selectedCount > 0 ? `(${selectedCount})` : ""}
        </button>
      </header>
      <div className="group-create-scroll">
        <div className="section-label">选择联系人</div>
        <div className="group-member-list">
          {availableCharacters.map((character) => {
            const checked = selectedIds.includes(character.id);
            return (
              <label className="group-member-row" key={character.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMember(character.id)}
                  aria-label={`选择${character.remarkName}`}
                />
                <Avatar character={character} size="sm" />
                <span>{character.remarkName}</span>
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RelationshipManagerPage({
  characters,
  relationships,
  onBack,
  onSave,
  onDelete
}: {
  characters: Character[];
  relationships: CharacterRelationship[];
  onBack: () => void;
  onSave: (relationship: CharacterRelationship) => void;
  onDelete: (relationshipId: string) => void;
}) {
  const availableCharacters = characters.filter((character) => character.enabled);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [characterAId, setCharacterAId] = useState(availableCharacters[0]?.id || "");
  const [characterBId, setCharacterBId] = useState(availableCharacters[1]?.id || "");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");

  const characterById = (id: string) => characters.find((character) => character.id === id);
  const openEditor = (relationship?: CharacterRelationship) => {
    setEditingId(relationship?.id || null);
    setCharacterAId(relationship?.characterAId || availableCharacters[0]?.id || "");
    setCharacterBId(relationship?.characterBId || availableCharacters[1]?.id || "");
    setLabel(relationship?.label || "");
    setNote(relationship?.note || "");
    setEditorOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const relationLabel = label.trim();
    if (!characterAId || !characterBId || characterAId === characterBId || !relationLabel) return;
    onSave({
      id: editingId || createId("relation"),
      characterAId,
      characterBId,
      label: relationLabel,
      note: note.trim()
    });
    setEditorOpen(false);
  };

  const remove = () => {
    if (!editingId) return;
    onDelete(editingId);
    setEditorOpen(false);
  };

  return (
    <section className="profile-page relationship-page">
      <header className="chat-header profile-header">
        <button className="icon-button" type="button" onClick={onBack} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">人物关系</div>
        <button className="icon-button" type="button" onClick={() => openEditor()} title="添加关系">
          <WeIcon name="add" size={22} />
        </button>
      </header>
      <div className="relationship-scroll">
        {relationships.length === 0 ? (
          <button className="relationship-empty" type="button" onClick={() => openEditor()}>
            <WeIcon name="group" size={28} />
            <span>添加第一组人物关系</span>
          </button>
        ) : (
          <div className="relationship-list">
            {relationships.map((relationship) => {
              const characterA = characterById(relationship.characterAId);
              const characterB = characterById(relationship.characterBId);
              if (!characterA || !characterB) return null;
              return (
                <button
                  className="relationship-row"
                  type="button"
                  key={relationship.id}
                  onClick={() => openEditor(relationship)}
                >
                  <span className="relationship-person">
                    <Avatar character={characterA} size="sm" />
                    <b>{characterA.remarkName}</b>
                  </span>
                  <span className="relationship-label">
                    <b>{relationship.label}</b>
                    {relationship.note && <small>{relationship.note}</small>}
                  </span>
                  <span className="relationship-person">
                    <Avatar character={characterB} size="sm" />
                    <b>{characterB.remarkName}</b>
                  </span>
                  <WeIcon name="arrow" size={12} className="native-chevron" />
                </button>
              );
            })}
          </div>
        )}
      </div>
      {editorOpen && (
        <div className="modal-backdrop">
          <form className="modal-panel relationship-editor" onSubmit={submit}>
            <button type="button" className="icon-button modal-close" onClick={() => setEditorOpen(false)} title="关闭">
              <WeIcon name="close" size={18} />
            </button>
            <h2>{editingId ? "编辑关系" : "添加关系"}</h2>
            <label>
              人物一
              <select value={characterAId} onChange={(event) => setCharacterAId(event.target.value)}>
                {availableCharacters.map((character) => (
                  <option value={character.id} key={character.id}>
                    {character.remarkName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              人物二
              <select value={characterBId} onChange={(event) => setCharacterBId(event.target.value)}>
                {availableCharacters.map((character) => (
                  <option value={character.id} key={character.id} disabled={character.id === characterAId}>
                    {character.remarkName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              关系
              <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：姐妹、同事、前任" maxLength={20} />
            </label>
            <label>
              相处细节
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选" rows={3} maxLength={120} />
            </label>
            <button className="primary-button" type="submit" disabled={characterAId === characterBId || !label.trim()}>
              保存
            </button>
            {editingId && (
              <button className="relationship-delete-button" type="button" onClick={remove}>
                删除关系
              </button>
            )}
          </form>
        </div>
      )}
    </section>
  );
}

function CharacterManagerPage({
  characters,
  relationships,
  onBack,
  onCreate,
  onEdit,
  onManageRelationships
}: {
  characters: Character[];
  relationships: CharacterRelationship[];
  onBack: () => void;
  onCreate: (name: string) => void;
  onEdit: (characterId: string) => void;
  onManageRelationships: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const create = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
    setIsAdding(false);
  };

  return (
    <section className="profile-page character-manager-page">
      <header className="chat-header profile-header">
        <button className="icon-button" type="button" onClick={onBack} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">人物管理</div>
        <button className="icon-button" type="button" onClick={() => setIsAdding(true)} title="添加人物">
          <WeIcon name="add" size={22} />
        </button>
      </header>
      <div className="character-manager-scroll">
        <div className="section-label">关系</div>
        <button className="settings-navigation-row" type="button" onClick={onManageRelationships}>
          <span className="settings-navigation-icon relationship-settings-icon">
            <WeIcon name="group" size={19} />
          </span>
          <span>人物关系</span>
          <small>{relationships.length} 组</small>
          <WeIcon name="arrow" size={12} className="native-chevron" />
        </button>

        <div className="section-label">人物</div>
        <div className="managed-character-list">
          {characters.map((character) => (
            <button
              className={`managed-character-row ${character.enabled ? "" : "disabled"}`}
              type="button"
              key={character.id}
              onClick={() => onEdit(character.id)}
            >
              <Avatar character={character} size="sm" />
              <span className="managed-character-copy">
                <b>{character.remarkName}</b>
                <small>{character.relationshipToUser || character.roleType}</small>
              </span>
              {!character.enabled && <span className="managed-character-status">已停用</span>}
              <WeIcon name="arrow" size={12} className="native-chevron" />
            </button>
          ))}
        </div>
      </div>
      {isAdding && (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={create}>
            <button className="icon-button modal-close" type="button" onClick={() => setIsAdding(false)} title="关闭">
              <WeIcon name="close" size={18} />
            </button>
            <h2>添加人物</h2>
            <label>
              名字
              <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={14} autoFocus />
            </label>
            <button className="primary-button" type="submit" disabled={!newName.trim()}>
              下一步
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function MomentComposer({
  characters,
  onClose,
  onPublish
}: {
  characters: Character[];
  onClose: () => void;
  onPublish: (content: string, media: MediaAsset[]) => void;
}) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState("公开");
  const [remindedCharacterIds, setRemindedCharacterIds] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<"location" | "remind" | "visibility" | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 9 - media.length);
    const picked = await Promise.all(files.map((file) => fileToMediaAsset(file, "moment")));
    setMedia((prev) => [...prev, ...picked].slice(0, 9));
  };

  const publish = () => {
    if (!content.trim() && media.length === 0) return;
    onPublish(content.trim(), media);
    setContent("");
    setMedia([]);
    onClose();
  };

  const canPublish = Boolean(content.trim() || media.length > 0);
  const reminderText = remindedCharacterIds.length > 0 ? `已选择${remindedCharacterIds.length}人` : "";

  return (
    <section className="profile-page moment-compose-page">
      <header className="chat-header moment-compose-header">
        <button type="button" className="moment-compose-cancel" onClick={onClose}>取消</button>
        <span />
        <button type="button" className="moment-publish-button" onClick={publish} disabled={!canPublish}>发表</button>
      </header>
      <div className="moment-compose-body">
        <textarea
          autoFocus
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="这一刻的想法..."
          maxLength={2000}
        />
        <div className="compose-media-grid">
          {media.map((item) => (
            <button
              className="compose-media-tile"
              type="button"
              key={item.id}
              onClick={() => setMedia((prev) => prev.filter((mediaItem) => mediaItem.id !== item.id))}
              title="移除图片"
            >
              <img src={item.url} alt="" />
              <span className="compose-media-remove"><WeIcon name="close" size={12} /></span>
            </button>
          ))}
          {media.length < 9 && (
            <label className="compose-media-add" title="从手机相册选择">
              <WeIcon name="add" size={28} />
              <input type="file" accept="image/*" multiple onChange={handleFile} />
            </label>
          )}
        </div>
        <div className="moment-compose-options">
          <button type="button" onClick={() => setActiveSheet("location")}>
            <WeIcon name="location" size={22} />
            <span>所在位置</span>
            {location && <small>{location}</small>}
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
          <button type="button" onClick={() => setActiveSheet("remind")}>
            <WeIcon name="contact-add" size={22} />
            <span>提醒谁看</span>
            {reminderText && <small>{reminderText}</small>}
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
          <button type="button" onClick={() => setActiveSheet("visibility")}>
            <WeIcon name="profile" size={22} />
            <span>谁可以看</span>
            <small>{visibility}</small>
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
        </div>
      </div>
      {activeSheet === "location" && (
        <ActionSheet
          title="所在位置"
          onClose={() => setActiveSheet(null)}
          actions={["不显示位置", "家", "公司", "附近"].map((label) => ({
            label,
            onClick: () => setLocation(label === "不显示位置" ? "" : label)
          }))}
        />
      )}
      {activeSheet === "visibility" && (
        <ActionSheet
          title="谁可以看"
          onClose={() => setActiveSheet(null)}
          actions={["公开", "私密", "部分可见", "不给谁看"].map((label) => ({
            label,
            onClick: () => setVisibility(label)
          }))}
        />
      )}
      {activeSheet === "remind" && (
        <ActionSheet
          title="提醒谁看"
          onClose={() => setActiveSheet(null)}
          actions={characters.map((character) => ({
            label: `${remindedCharacterIds.includes(character.id) ? "✓ " : ""}${character.remarkName}`,
            onClick: () => setRemindedCharacterIds((current) =>
              current.includes(character.id)
                ? current.filter((id) => id !== character.id)
                : [...current, character.id]
            )
          }))}
        />
      )}
    </section>
  );
}

function MomentCoverViewer({
  coverUrl,
  onClose,
  onChange
}: {
  coverUrl: string;
  onClose: () => void;
  onChange: () => void;
}) {
  return (
    <section className="moment-cover-viewer">
      <header className="moment-cover-viewer-header">
        <button type="button" className="icon-button" onClick={onClose} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <span>相册封面</span>
        <span />
      </header>
      <div className="moment-cover-viewer-image">
        <img src={coverUrl || defaultMomentsCoverUrl} alt="朋友圈相册封面" />
      </div>
      <button type="button" className="moment-cover-change-button" onClick={onChange}>更换相册封面</button>
    </section>
  );
}

function MomentCoverPicker({
  onClose,
  onSave
}: {
  onClose: () => void;
  onSave: (coverUrl: string) => void;
}) {
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const media = await fileToMediaAsset(file, "moments-background");
    onSave(media.url);
    event.target.value = "";
  };

  return (
    <section className="profile-page moment-cover-picker">
      <header className="chat-header profile-header">
        <button type="button" className="icon-button" onClick={onClose} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">更换相册封面</div>
        <span />
      </header>
      <div className="moment-cover-picker-body">
        <label>
          <span>从手机相册选择</span>
          <WeIcon name="arrow" size={12} className="native-chevron" />
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>
        <label>
          <span>拍一个</span>
          <WeIcon name="arrow" size={12} className="native-chevron" />
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
        </label>
      </div>
    </section>
  );
}

function DiscoverTab({
  onOpenMoments,
  hasUnreadMoments,
  unreadMomentAuthor
}: {
  onOpenMoments: () => void;
  hasUnreadMoments: boolean;
  unreadMomentAuthor?: Character;
}) {
  const rows: Array<{
    label: string;
    icon: string;
    tone: string;
    onClick?: () => void;
    gap?: boolean;
    unread?: boolean;
    unreadAuthor?: Character;
  }> = [
    {
      label: "朋友圈",
      icon: "discover-moments",
      tone: "blue",
      onClick: onOpenMoments,
      unread: hasUnreadMoments,
      unreadAuthor: unreadMomentAuthor
    },
    { label: "视频号", icon: "channels", tone: "orange", gap: true },
    { label: "直播", icon: "live", tone: "live-red" },
    { label: "扫一扫", icon: "scan", tone: "blue", gap: true },
    { label: "看一看", icon: "look", tone: "yellow" },
    { label: "搜一搜", icon: "search-grid", tone: "red" },
    { label: "小程序", icon: "mini", tone: "purple", gap: true }
  ];

  return (
    <section className="screen-body discover-body">
      {rows.map((row) => (
        <button
          className={`discover-row ${row.gap ? "row-gap" : ""}`}
          key={row.label}
          onClick={row.onClick}
          type="button"
        >
          <span className="discover-icon-slot">
            <WeIcon name={row.icon} tone={row.tone} />
          </span>
          <span className="discover-row-label">{row.label}</span>
          <span className="discover-row-tail">
            {row.unread && row.unreadAuthor ? (
              <span className="discover-moment-update" aria-hidden="true">
                <span
                  className={`discover-moment-avatar ${row.unreadAuthor.avatarUrl ? "has-image" : ""}`}
                  style={
                    row.unreadAuthor.avatarUrl
                      ? {
                          backgroundColor: row.unreadAuthor.avatarColor,
                          backgroundImage: `url(${row.unreadAuthor.avatarUrl})`
                        }
                      : { background: row.unreadAuthor.avatarColor }
                  }
                >
                  {!row.unreadAuthor.avatarUrl && row.unreadAuthor.initials}
                </span>
                <span className="discover-row-unread-dot" />
              </span>
            ) : (
              row.unread && <span className="discover-row-unread-dot" aria-hidden="true" />
            )}
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </span>
        </button>
      ))}
    </section>
  );
}

function LocalToolPanel({
  tool,
  onClose,
  onSaveCard,
  onApplyBackground,
  onCreateRole
}: {
  tool: ToolKey;
  onClose: () => void;
  onSaveCard: (title: string, content: string) => void;
  onApplyBackground: (url: string) => void;
  onCreateRole: (template: "neighbor" | "mentor" | "night") => void;
}) {
  const config = {
    research: {
      title: "深度整理",
      placeholder: "输入一个想梳理的话题",
      action: "整理提纲"
    },
    document: {
      title: "文档摘记",
      placeholder: "粘贴一段文字",
      action: "整理摘要"
    },
    background: {
      title: "聊天背景",
      placeholder: "",
      action: ""
    },
    role: {
      title: "角色模板",
      placeholder: "",
      action: ""
    }
  }[tool];
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const backgroundOptions = [
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80"
  ];

  const run = () => {
    const text = input.trim();
    if (!text) return;
    if (tool === "research") {
      setResult(
        [
          `${text}`,
          "1. 先确认背景：这件事从哪里开始，当前卡在哪里。",
          "2. 再列关键变量：人、时间、资源、情绪、约束。",
          "3. 最后收成三个动作：要问谁、要查什么、今天能推进哪一步。"
        ].join("\n")
      );
      return;
    }
    setResult(
      [
        "摘要",
        text.replace(/\s+/g, " ").slice(0, 120) || "暂无内容",
        "",
        "待办",
        "1. 标出最重要的一句话。",
        "2. 把需要跟进的事项单独发到聊天里。",
        "3. 收藏这张卡片，晚点再看。"
      ].join("\n")
    );
  };

  return (
    <section className="profile-page tool-page">
      <header className="chat-header">
        <button className="icon-button" onClick={onClose}>
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">{config.title}</div>
        <span />
      </header>
      <div className="tool-body">
        {(tool === "research" || tool === "document") && (
          <>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={config.placeholder} />
            <button type="button" className="primary-button" onClick={run}>
              {config.action}
            </button>
            {result && (
              <div className="tool-result-card">
                <pre>{result}</pre>
                <button type="button" onClick={() => onSaveCard(config.title, result)}>
                  存入收藏
                </button>
              </div>
            )}
          </>
        )}

        {tool === "background" && (
          <div className="background-choice-grid">
            {backgroundOptions.map((url) => (
              <button type="button" key={url} onClick={() => onApplyBackground(url)}>
                <img src={url} alt="" />
                <span>设为聊天背景</span>
              </button>
            ))}
          </div>
        )}

        {tool === "role" && (
          <div className="role-template-list">
            {[
              { key: "neighbor" as const, title: "楼下邻居", desc: "熟悉、自然、会聊生活琐事。" },
              { key: "mentor" as const, title: "年长朋友", desc: "稳一点，适合复盘和提醒。" },
              { key: "night" as const, title: "深夜朋友", desc: "安静、慢节奏，适合睡前聊天。" }
            ].map((template) => (
              <button type="button" key={template.key} onClick={() => onCreateRole(template.key)}>
                <b>{template.title}</b>
                <span>{template.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MomentsTab({
  state,
  onBack,
  onGenerate,
  onPublish,
  onToggleLike,
  onComment,
  onEditCover,
  generating
}: {
  state: AppState;
  onBack: () => void;
  onGenerate: () => void;
  onPublish: (content: string, media: MediaAsset[]) => void;
  onToggleLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onEditCover: () => void;
  generating: boolean;
}) {
  const [isComposing, setIsComposing] = useState(false);
  const [isCoverPreviewOpen, setIsCoverPreviewOpen] = useState(false);
  const [coverScrolled, setCoverScrolled] = useState(false);
  const posts = [...state.moments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <section className="moments-page">
      <header className={`moments-nav ${coverScrolled ? "is-scrolled" : ""}`}>
        <button className="icon-button" onClick={onBack}>
          <WeIcon name="back" size={24} />
        </button>
        <div className="moments-nav-title">朋友圈</div>
        <button className="icon-button" onClick={() => setIsComposing(true)} onDoubleClick={onGenerate} disabled={generating}>
          <WeIcon name="camera" size={24} />
        </button>
      </header>
      <div
        className="screen-body moments-body moments-full-body"
        onScroll={(event) => setCoverScrolled(event.currentTarget.scrollTop > 210)}
      >
        <div className="moments-cover">
          <button
            type="button"
            className={`moments-cover-photo ${state.settings.momentsCoverUrl ? "has-custom-cover" : ""}`}
            onClick={() => setIsCoverPreviewOpen(true)}
            title="查看朋友圈背景"
            style={{ backgroundImage: `url("${(state.settings.momentsCoverUrl || defaultMomentsCoverUrl).replace(/"/g, "%22")}")` }}
          />
          <div className="moments-owner">
            <span>{state.user.displayName}</span>
            <button className="cover-avatar-button" onClick={() => setIsComposing(true)} title="发朋友圈">
              <UserAvatar user={state.user} size="lg" />
            </button>
          </div>
        </div>
        <div className="moments-stream">
          {posts.map((post) => (
            <MomentCard
              key={post.id}
              post={post}
              user={state.user}
              characters={state.characters}
              onToggleLike={onToggleLike}
              onComment={onComment}
            />
          ))}
        </div>
        {isComposing && (
          <MomentComposer
            characters={state.characters}
            onClose={() => setIsComposing(false)}
            onPublish={onPublish}
          />
        )}
        {isCoverPreviewOpen && (
          <MomentCoverViewer
            coverUrl={state.settings.momentsCoverUrl || defaultMomentsCoverUrl}
            onClose={() => setIsCoverPreviewOpen(false)}
            onChange={onEditCover}
          />
        )}
      </div>
    </section>
  );
}

function MomentCard({
  post,
  user,
  characters,
  onToggleLike,
  onComment
}: {
  post: MomentPost;
  user: UserProfile;
  characters: Character[];
  onToggleLike: (postId: string) => void;
  onComment: (postId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const author = post.authorCharacterId ? characters.find((item) => item.id === post.authorCharacterId) : undefined;
  const isUserPost = post.authorUserId === user.id || !author;
  const likes = post.interactions.filter((item) => item.type === "like");
  const comments = post.interactions.filter((item) => item.type === "comment");

  return (
    <article className="moment-card">
      {isUserPost ? <UserAvatar user={user} size="sm" /> : <Avatar character={author!} size="sm" />}
      <div className="moment-main">
        <div className="moment-author">
          {isUserPost ? user.displayName : author!.remarkName}
          <AiBadge />
        </div>
        <p>{post.content}</p>
        {post.media.length > 0 && (
          <div className={`media-grid media-count-${Math.min(post.media.length, 9)}`}>
            {post.media.map((media) => (
              media.url ? (
                <img className="media-tile" key={media.id} src={media.url} alt="" />
              ) : (
                <div
                  className="media-tile"
                  key={media.id}
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.16)), url(${fallbackMomentImage(media.id)})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover"
                  }}
                />
              )
            ))}
          </div>
        )}
        <div className="moment-actions">
          <span>{formatMomentTime(post.createdAt)}</span>
          <button className="moment-more-button" onClick={() => setShowActions((value) => !value)}>
            <WeIcon name="more" />
          </button>
          {showActions && (
            <div className="moment-action-pop">
              <button
                onClick={() => {
                  onToggleLike(post.id);
                  setShowActions(false);
                }}
              >
                <WeIcon name="like" />
                赞
              </button>
              <button
                onClick={() => {
                  onComment(post.id);
                  setShowActions(false);
                }}
              >
                <WeIcon name="comment" />
                评论
              </button>
            </div>
          )}
        </div>
        {(likes.length > 0 || comments.length > 0) && (
          <div className="interaction-panel">
            {likes.length > 0 && (
              <div className="likes-line">
                <WeIcon name="like" />
                {likes
                  .map((like) => characters.find((item) => item.id === like.actorCharacterId)?.remarkName)
                  .filter(Boolean)
                  .join("、")}
              </div>
            )}
            {comments.map((comment) => {
              const actor = characters.find((item) => item.id === comment.actorCharacterId);
              return (
                <div className="comment-line" key={comment.id}>
                  <b>{actor?.remarkName}</b>：{comment.content}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

function CharacterProfilePage({
  character,
  moments,
  onBack,
  onMessage,
  onOpenMoments
}: {
  character: Character;
  moments: MomentPost[];
  onBack: () => void;
  onMessage: () => void;
  onOpenMoments: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const momentMedia = moments
    .filter((post) => post.authorCharacterId === character.id)
    .flatMap((post) => post.media)
    .filter((item) => item.url.trim());
  const previewMedia = [...momentMedia, ...(character.album || []).filter((item) => item.url.trim())]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, 4);

  return (
    <section className="profile-page native-character-profile">
      <header className="chat-header profile-header">
        <button className="icon-button" type="button" onClick={onBack} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">详细资料</div>
        <button className="icon-button" type="button" onClick={() => setShowActions(true)} title="更多">
          <WeIcon name="more" size={24} />
        </button>
      </header>

      <div className="profile-scroll">
        <section className="contact-hero-card native-contact-hero">
          <div className="profile-big-avatar">
            <Avatar character={character} size="lg" />
          </div>
          <div className="contact-hero-main">
            <div className="profile-name-text">{character.remarkName}</div>
            <div className="profile-meta-line">
              <span>{genderText(character.gender)}</span>
              <span>地区：{character.region || "未设置"}</span>
            </div>
            <div className="profile-id-line">微信号：{character.id.replace(/^c_/, "")}</div>
          </div>
        </section>

        <section className="wechat-card native-profile-list">
          <div className="native-profile-row">
            <span>备注和标签</span>
            <small>{(character.tags || []).slice(0, 3).join("、") || character.remarkName}</small>
          </div>
          <div className="native-profile-row">
            <span>朋友权限</span>
            <small>聊天、朋友圈</small>
          </div>
        </section>

        <section className="wechat-card native-profile-list">
          <button className="native-profile-row native-moments-row" type="button" onClick={onOpenMoments}>
            <span>朋友圈</span>
            <span className="native-moments-preview">
              {previewMedia.map((item) => (
                <img key={item.id} src={item.url} alt="" />
              ))}
            </span>
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
          <div className="native-profile-row">
            <span>更多信息</span>
            <small>{character.occupation || character.roleType}</small>
          </div>
        </section>

        <section className="wechat-card native-profile-list">
          <div className="native-profile-row">
            <span>与我的关系</span>
            <small>{character.relationshipToUser || "朋友"}</small>
          </div>
          {character.signature && (
            <div className="native-profile-row">
              <span>个性签名</span>
              <small>{character.signature}</small>
            </div>
          )}
        </section>

        <button className="profile-message-button" type="button" onClick={onMessage}>
          <WeIcon name="comment" size={20} />
          发消息
        </button>
      </div>
      {showActions && (
        <ActionSheet
          title={character.remarkName}
          onClose={() => setShowActions(false)}
          actions={[{ label: "发消息", icon: <WeIcon name="comment" size={18} />, onClick: onMessage }]}
        />
      )}
    </section>
  );
}

function CharacterEditorPage({
  character,
  memories,
  onBack,
  onEditAvatar,
  onUpdate,
  onAddMemory,
  onDeleteMemory,
  onDelete
}: {
  character: Character;
  memories: MemoryNote[];
  onBack: () => void;
  onEditAvatar: () => void;
  onUpdate: (character: Character) => void;
  onAddMemory: (content: string) => void;
  onDeleteMemory: (memoryId: string) => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const updateField = (field: keyof Character, value: string) => {
    onUpdate({ ...character, [field]: value });
  };

  const updatePersonality = (key: keyof Character["personality"], value: number) => {
    onUpdate({ ...character, personality: { ...character.personality, [key]: value } });
  };

  const saveMemory = () => {
    const content = memoryDraft.trim();
    if (!content) return;
    onAddMemory(content);
    setMemoryDraft("");
  };

  return (
    <section className="profile-page character-editor-page">
      <header className="chat-header profile-header">
        <button className="icon-button" onClick={onBack}>
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">人物设置</div>
        <button className="icon-button" onClick={() => setShowActions(true)} title="更多">
          <WeIcon name="more" size={24} />
        </button>
      </header>

      <div className="profile-scroll">
        <section className="contact-hero-card">
          <button className="profile-big-avatar" onClick={onEditAvatar} title="设置头像">
            <Avatar character={character} size="lg" />
          </button>
          <div className="contact-hero-main">
            <input
              className="profile-name-input"
              value={character.remarkName}
              onChange={(event) => updateField("remarkName", event.target.value)}
              maxLength={14}
            />
            <div className="profile-meta-line">
              <span>{genderText(character.gender)}</span>
              <span>地区：{character.region || "未设置"}</span>
            </div>
            <div className="profile-id-line">微信号：{character.id.replace(/^c_/, "")}</div>
          </div>
        </section>

        <section className="wechat-card">
          <div className="profile-edit-row profile-choice-row">
            <span>性别</span>
            <GenderSelector
              value={character.gender}
              onChange={(gender) => onUpdate({ ...character, gender })}
            />
          </div>
          <label className="profile-edit-row">
            <span>与我的关系</span>
            <input
              value={character.relationshipToUser || ""}
              onChange={(event) => updateField("relationshipToUser", event.target.value)}
              placeholder="例如：朋友、同事、伴侣"
              maxLength={20}
            />
          </label>
          <label className="profile-edit-row">
            <span>角色类型</span>
            <input
              value={character.roleType || ""}
              onChange={(event) => updateField("roleType", event.target.value)}
              placeholder="例如：老朋友、同事、伴侣"
              maxLength={24}
            />
          </label>
          <label className="profile-edit-row">
            <span>职业</span>
            <input
              value={character.occupation || ""}
              onChange={(event) => updateField("occupation", event.target.value)}
              placeholder="填写职业"
            />
          </label>
          <label className="profile-edit-row">
            <span>地区</span>
            <input
              value={character.region || ""}
              onChange={(event) => updateField("region", event.target.value)}
              placeholder="填写地区"
            />
          </label>
          <label className="profile-edit-row">
            <span>个性签名</span>
            <input
              value={character.signature || ""}
              onChange={(event) => updateField("signature", event.target.value)}
              placeholder="填写签名"
            />
          </label>
        </section>

        <section className="wechat-card">
          <div className="profile-card-title">
            <WeIcon name="album" size={18} />
            朋友圈
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </div>
          <div className="album-strip">
            {(character.album || []).slice(0, 4).map((item) => (
              <img key={item.id} src={item.url} alt="" />
            ))}
          </div>
        </section>

        <section className="wechat-card">
          <div className="profile-card-title">
            <WeIcon name="tag" size={18} />
            标签
          </div>
          <div className="tag-cloud">
            {(character.tags || [character.roleType]).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </section>

        <section className="wechat-card">
          <div className="profile-card-title">
            <WeIcon name="star" size={18} />
            印象
          </div>
          <div className="memory-card-list">
            {memories.length === 0 ? (
              <span className="memory-empty">还没有记录</span>
            ) : (
              memories.slice(0, 5).map((memory) => (
                <div className="memory-card-item" key={memory.id}>
                  <button type="button" onClick={() => onDeleteMemory(memory.id)} title="删除">
                    <WeIcon name="close" size={14} />
                  </button>
                  <p>{memory.excerpt || memory.content}</p>
                  <span>{formatMomentTime(memory.createdAt)}</span>
                </div>
              ))
            )}
          </div>
          <div className="memory-add-row">
            <input
              value={memoryDraft}
              maxLength={80}
              onChange={(event) => setMemoryDraft(event.target.value)}
              placeholder="添加一条备注"
            />
            <button type="button" onClick={saveMemory}>
              保存
            </button>
          </div>
        </section>

        <section className="wechat-card">
          <div className="profile-card-title">
            <WeIcon name="note" size={18} />
            资料
          </div>
          <label className="profile-textarea-row">
            <span>身份设定</span>
            <textarea
              value={character.background}
              onChange={(event) => updateField("background", event.target.value)}
              rows={4}
            />
          </label>
          <label className="profile-textarea-row">
            <span>聊天备注</span>
            <textarea
              value={character.skillPrompt || ""}
              onChange={(event) => onUpdate({ ...character, skillPrompt: event.target.value })}
              placeholder="只对这个联系人生效的说话方式和相处细节"
              rows={4}
            />
          </label>
          <div className="profile-skill-row">
            <span>偏好组合</span>
            <SkillSelector
              compact
              value={character.skillIds || []}
              onChange={(skillIds) => onUpdate({ ...character, skillIds })}
            />
          </div>
          <label className="profile-edit-row">
            <span>说话风格</span>
            <input
              value={character.speechStyle.tone}
              onChange={(event) =>
                onUpdate({ ...character, speechStyle: { ...character.speechStyle, tone: event.target.value } })
              }
            />
          </label>
        </section>

        <section className="wechat-card">
          <div className="profile-card-title">
            <WeIcon name="settings" size={18} />
            接口
          </div>
          <label className="profile-edit-row">
            <span>聊天模型</span>
            <input
              list="api-text-model-options"
              value={character.apiTextModel || ""}
              onChange={(event) => onUpdate({ ...character, apiTextModel: event.target.value })}
              placeholder="留空使用全局"
            />
          </label>
          <label className="profile-edit-row">
            <span>图片模型</span>
            <input
              list="api-image-model-options"
              value={character.apiImageModel || ""}
              onChange={(event) => onUpdate({ ...character, apiImageModel: event.target.value })}
              placeholder="留空使用全局"
            />
          </label>
        </section>

        <section className="wechat-card">
          <div className="profile-card-title">
            <WeIcon name="profile" size={18} />
            性格
          </div>
          <div className="personality-list">
            {personalityLabels.map((item) => (
              <label className="personality-row" key={item.key}>
                <span>{item.label}</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={character.personality[item.key]}
                  onChange={(event) => updatePersonality(item.key, Number(event.target.value))}
                />
                <b>{character.personality[item.key]}</b>
              </label>
            ))}
          </div>
        </section>

        <button className="profile-delete-button" type="button" onClick={() => setShowDeleteConfirm(true)}>
          <WeIcon name="delete" size={18} />
          删除人物
        </button>
      </div>
      {showActions && (
        <ActionSheet
          title={character.remarkName}
          onClose={() => setShowActions(false)}
          actions={[
            { label: "设置头像", icon: <WeIcon name="album" size={18} />, onClick: onEditAvatar },
            {
              label: character.enabled ? "停用联系人" : "启用联系人",
              icon: character.enabled ? <WeIcon name="delete" size={18} /> : <WeIcon name="refresh" size={18} />,
              danger: character.enabled,
              onClick: () => onUpdate({ ...character, enabled: !character.enabled })
            },
            { label: "删除人物", icon: <WeIcon name="delete" size={18} />, danger: true, onClick: () => setShowDeleteConfirm(true) }
          ]}
        />
      )}
      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-panel character-delete-confirm">
            <h2>删除{character.remarkName}？</h2>
            <p>相关私聊、群成员、朋友圈互动和人物关系会一并移除。</p>
            <button className="character-delete-confirm-button" type="button" onClick={onDelete}>
              删除
            </button>
            <button className="secondary-button" type="button" onClick={() => setShowDeleteConfirm(false)}>
              取消
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MeTab({
  state,
  onOpenProfile,
  onOpenWallet,
  onOpenFavorites,
  onOpenMoments,
  onOpenSettings
}: {
  state: AppState;
  onOpenProfile: () => void;
  onOpenWallet: () => void;
  onOpenFavorites: () => void;
  onOpenMoments: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <section className="screen-body me-body">
      <button type="button" className="profile-row me-profile-row" onClick={onOpenProfile} title="个人信息">
        <span className="profile-avatar-button">
          <UserAvatar user={state.user} size="lg" />
        </span>
        <div className="me-profile-copy">
          <div className="me-profile-primary">
            <div className="profile-name">{state.user.displayName}</div>
            <WeIcon name="qr-code" className="profile-qr-icon" size={22} />
          </div>
          <div className="me-profile-secondary">
            <div className="profile-sub">微信号：qinghe</div>
            <WeIcon name="arrow" className="profile-edit-icon native-chevron" size={12} />
          </div>
        </div>
      </button>

      <div className="settings-block me-list-block">
        <button className="setting-row" type="button" onClick={onOpenWallet}>
          <WeIcon name="profile-pay" />
          服务
          <WeIcon name="arrow" size={12} className="native-chevron" />
        </button>
      </div>

      <div className="settings-block me-list-block">
        <button className="setting-row" type="button" onClick={onOpenFavorites}>
          <WeIcon name="profile-favorite" />
          收藏
          <WeIcon name="arrow" size={12} className="native-chevron" />
        </button>
        <button className="setting-row" type="button" onClick={onOpenMoments}>
          <WeIcon name="moments" tone="blue" />
          朋友圈
          <WeIcon name="arrow" size={12} className="native-chevron" />
        </button>
        <button className="setting-row">
          <WeIcon name="profile-card" />
          卡包
          <WeIcon name="arrow" size={12} className="native-chevron" />
        </button>
        <button className="setting-row">
          <WeIcon name="profile-sticker" tone="yellow" />
          表情
          <WeIcon name="arrow" size={12} className="native-chevron" />
        </button>
      </div>

      <div className="settings-block me-list-block">
        <button
          className="setting-row"
          onClick={onOpenSettings}
        >
          <WeIcon name="profile-setting" tone="green" />
          设置
          <WeIcon name="arrow" size={12} className="native-chevron" />
        </button>
      </div>
    </section>
  );
}

function FavoritesPage({
  state,
  onBack,
  onOpenConversation,
  onDelete
}: {
  state: AppState;
  onBack: () => void;
  onOpenConversation: (conversationId: string) => void;
  onDelete: (memoryId: string) => void;
}) {
  const favorites = state.memories
    .filter((memory) => memory.favoriteKind === "message" || memory.favoriteKind === "tool" || memory.content.startsWith("收藏"))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <section className="profile-page favorites-page">
      <header className="chat-header">
        <button className="icon-button" onClick={onBack}>
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">收藏</div>
        <span />
      </header>
      <div className="favorites-body">
        {favorites.length === 0 ? (
          <div className="favorites-empty">还没有收藏</div>
        ) : (
          favorites.map((memory) => (
            <article className="favorite-card" key={memory.id}>
              <button
                type="button"
                className="favorite-main"
                onClick={() => memory.sourceConversationId && onOpenConversation(memory.sourceConversationId)}
              >
                <div className="favorite-title-line">
                  <b>{memory.title || memory.conversationTitle || "收藏"}</b>
                  <span>{formatMomentTime(memory.createdAt)}</span>
                </div>
                {memory.senderLabel && <div className="favorite-source">{memory.senderLabel}</div>}
                {memory.media?.url && <img className="favorite-image" src={memory.media.url} alt="" />}
                <p>{memory.excerpt || memory.content}</p>
              </button>
              <button type="button" className="favorite-delete" onClick={() => onDelete(memory.id)} title="删除">
                <WeIcon name="delete" size={17} />
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function WalletPanel({
  wallet,
  onBack
}: {
  wallet: AppState["wallet"];
  onBack: () => void;
}) {
  const payItems = [
    { label: "收付款", icon: "services", tone: "green" },
    { label: "零钱", icon: "card", tone: "green", value: formatMoney(wallet.balance) },
    { label: "银行卡", icon: "card", tone: "blue" },
    { label: "账单", icon: "favorite", tone: "orange" }
  ];
  const lifeItems = [
    { label: "红包", icon: "sticker", tone: "red", value: `已发 ${formatMoney(wallet.totalSent)}` },
    { label: "转账", icon: "services", tone: "green", value: `已收 ${formatMoney(wallet.totalReceived)}` },
    { label: "每周到账", icon: "favorite", tone: "yellow", value: formatMoney(wallet.weeklyAllowance) }
  ];

  return (
    <section className="wallet-page">
      <header className="chat-header wallet-topbar">
        <button className="icon-button" onClick={onBack}>
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">服务</div>
        <button className="icon-button" type="button" title="更多">
          <WeIcon name="more" size={24} />
        </button>
      </header>
      <div className="wallet-body">
        <section className="wallet-pay-card">
          <button type="button" className="wallet-pay-primary">
            <WeIcon name="services" />
            <span>收付款</span>
          </button>
          <button type="button" className="wallet-pay-primary">
            <WeIcon name="card" />
            <span>钱包</span>
          </button>
        </section>

        <section className="wallet-section">
          <h3>支付服务</h3>
          <div className="wallet-service-grid">
            {payItems.map((item) => (
              <button type="button" key={item.label}>
                <WeIcon name={item.icon} tone={item.tone} />
                <span>{item.label}</span>
                {item.value && <small>{item.value}</small>}
              </button>
            ))}
          </div>
        </section>

        <section className="wallet-section">
          <h3>生活服务</h3>
          <div className="wallet-service-grid">
            {lifeItems.map((item) => (
              <button type="button" key={item.label}>
                <WeIcon name={item.icon} tone={item.tone} />
                <span>{item.label}</span>
                {item.value && <small>{item.value}</small>}
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function UserProfilePage({
  user,
  onBack,
  onEditAvatar,
  onEditMomentsCover,
  onOpenSettings,
  onUpdateName,
  onUpdateGender
}: {
  user: UserProfile;
  onBack: () => void;
  onEditAvatar: () => void;
  onEditMomentsCover: () => void;
  onOpenSettings: () => void;
  onUpdateName: (name: string) => void;
  onUpdateGender: (gender: NonNullable<UserProfile["gender"]>) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <section className="profile-page">
      <header className="chat-header profile-header">
        <button className="icon-button" onClick={onBack}>
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">个人信息</div>
        <button className="icon-button" onClick={() => setShowActions(true)} title="更多">
          <WeIcon name="more" size={24} />
        </button>
      </header>

      <div className="profile-scroll">
        <section className="wechat-card self-info-card">
          <button type="button" className="profile-edit-row self-avatar-row" onClick={onEditAvatar}>
            <span>头像</span>
            <UserAvatar user={user} size="lg" />
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
          <label className="profile-edit-row">
            <span>名字</span>
            <input value={user.displayName} onChange={(event) => onUpdateName(event.target.value || "我")} />
          </label>
          <div className="profile-edit-row profile-choice-row">
            <span>性别</span>
            <GenderSelector value={user.gender} onChange={onUpdateGender} />
          </div>
          <div className="profile-edit-row static-row">
            <span>微信号</span>
            <b>qinghe</b>
          </div>
          <div className="profile-edit-row static-row">
            <span>二维码名片</span>
            <WeIcon name="qr-code" className="profile-qr-icon" size={20} />
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </div>
        </section>
      </div>
      {showActions && (
        <ActionSheet
          title="个人信息"
          onClose={() => setShowActions(false)}
          actions={[
            { label: "更换头像", icon: <WeIcon name="album" size={18} />, onClick: onEditAvatar },
            { label: "朋友圈背景", icon: <WeIcon name="camera" size={18} />, onClick: onEditMomentsCover },
            { label: "设置", icon: <WeIcon name="settings" size={18} />, onClick: onOpenSettings }
          ]}
        />
      )}
    </section>
  );
}

function SettingsPanel({
  state,
  setState,
  onClose,
  onOpenCharacterManager
}: {
  state: AppState;
  setState: (updater: AppState | ((prev: AppState) => AppState)) => void;
  onClose: () => void;
  onOpenCharacterManager: () => void;
}) {
  const [status, setStatus] = useState("");
  const updateSetting = <Key extends keyof AppState["settings"]>(key: Key, value: AppState["settings"][Key]) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
  };

  const importTextArchive = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const archive = JSON.parse(await file.text()) as TextArchive;
      setState((prev) => mergeTextArchive(prev, archive));
      setStatus("已导入文字档案。");
    } catch {
      setStatus("导入失败，请确认文件是文字档案 JSON。");
    } finally {
      event.target.value = "";
    }
  };

  const importFullBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as AppState;
      setState((prev) => ({
        ...backup,
        deletedCharacterIds: backup.deletedCharacterIds || prev.deletedCharacterIds || [],
        characterRelationships: backup.characterRelationships || prev.characterRelationships || [],
        settings: {
          ...prev.settings,
          ...backup.settings,
          apiKey: prev.settings.apiKey,
          globalSkillIds: backup.settings?.globalSkillIds || prev.settings.globalSkillIds || []
        },
        wallet: normalizeWallet(backup.wallet || prev.wallet)
      }));
      setStatus("已恢复完整本机数据。");
    } catch {
      setStatus("恢复失败，请确认文件是完整本机备份 JSON。");
    } finally {
      event.target.value = "";
    }
  };

  const checkUpdateNow = async () => {
    setStatus("正在检查更新...");
    await checkForInternalUpdate(true);
    setStatus("更新检查已完成。");
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel settings-panel">
        <button type="button" className="icon-button modal-close" onClick={onClose}>
          <WeIcon name="close" size={18} />
        </button>
        <h2>设置</h2>

        <section className="settings-section">
          <h3>测试者</h3>
          <label>
            <span>显示名</span>
            <input
              value={state.user.displayName}
              onChange={(event) =>
                setState((prev) => ({ ...prev, user: { ...prev.user, displayName: event.target.value || "我" } }))
              }
              placeholder="我"
            />
          </label>
        </section>

        <section className="settings-section settings-navigation-section">
          <h3>人物</h3>
          <button className="settings-navigation-row" type="button" onClick={onOpenCharacterManager}>
            <span className="settings-navigation-icon character-settings-icon">
              <WeIcon name="group" size={19} />
            </span>
            <span>人物管理</span>
            <small>{state.characters.length} 人</small>
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
        </section>

        <section className="settings-section">
          <h3>接口设置</h3>
          <div className="settings-toggle-row">
            <button
              type="button"
              className={state.settings.providerMode === "openai_compatible" ? "active" : ""}
              onClick={() => updateSetting("providerMode", "openai_compatible")}
            >
              在线回复
            </button>
            <button
              type="button"
              className={state.settings.providerMode === "local_mock" ? "active" : ""}
              onClick={() => updateSetting("providerMode", "local_mock")}
            >
              本机回复
            </button>
          </div>
          <div className="settings-help">
            在线回复会使用这里填写的接口配置；本机回复不需要网络，适合临时调试界面和消息节奏。
          </div>
          <label>
            <span>密钥</span>
            <input
              type="password"
              value={state.settings.apiKey}
              onChange={(event) => updateSetting("apiKey", event.target.value)}
              placeholder="保存在本机"
            />
          </label>
          <label>
            <span>接口地址</span>
            <input
              value={state.settings.apiBaseUrl}
              onChange={(event) => updateSetting("apiBaseUrl", event.target.value)}
              placeholder="https://yunwu.ai/v1"
            />
          </label>
          <label>
            <span>聊天模型</span>
            <input
              list="api-text-model-options"
              value={state.settings.apiTextModel || state.settings.apiModel}
              onChange={(event) => {
                updateSetting("apiTextModel", event.target.value);
                updateSetting("apiModel", event.target.value);
              }}
              placeholder="grok-4.3"
            />
          </label>
          <label>
            <span>图片模型</span>
            <input
              list="api-image-model-options"
              value={state.settings.apiImageModel}
              onChange={(event) => updateSetting("apiImageModel", event.target.value)}
              placeholder="grok-imagine-image-quality"
            />
          </label>
          <label>
            <span>图片规格</span>
            <input
              list="api-image-size-options"
              value={state.settings.apiImageSize}
              onChange={(event) => updateSetting("apiImageSize", event.target.value)}
              placeholder="1k"
            />
          </label>
          <label className="settings-textarea-label">
            <span>全局 Skill</span>
            <textarea
              value={state.settings.globalSkillPrompt}
              onChange={(event) => updateSetting("globalSkillPrompt", event.target.value)}
              placeholder="所有联系人共同遵守的说话方式、能力和边界"
              rows={9}
            />
          </label>
          <button type="button" className="secondary-button" onClick={() => updateSetting("globalSkillPrompt", defaultGlobalSkillPrompt)}>
            使用默认全局 Skill 模板
          </button>
        </section>

        <section className="settings-section">
          <h3>版本更新</h3>
          <button type="button" className="primary-button" onClick={checkUpdateNow}>
            检查更新
          </button>
        </section>

        <section className="settings-section">
          <h3>文字档案</h3>
          <button type="button" className="primary-button" onClick={() => downloadTextArchive(state)}>
            导出文字档案
          </button>
          <label className="file-row">
            <WeIcon name="upload" size={18} />
            导入文字档案
            <input type="file" accept="application/json,.json" onChange={importTextArchive} />
          </label>
          {status && <div className="settings-status">{status}</div>}
        </section>

        <section className="settings-section">
          <h3>本机完整数据</h3>
          <button type="button" className="primary-button" onClick={() => exportAppState(state)}>
            导出完整本机数据
          </button>
          <label className="file-row">
            <WeIcon name="upload" size={18} />
            恢复完整本机数据
            <input type="file" accept="application/json,.json" onChange={importFullBackup} />
          </label>
        </section>
      </div>
    </div>
  );
}

function ModelOptionDatalists() {
  return (
    <>
      <datalist id="api-text-model-options">
        {textModelOptions.map((model) => (
          <option value={model} key={model} />
        ))}
      </datalist>
      <datalist id="api-image-model-options">
        {imageModelOptions.map((model) => (
          <option value={model} key={model} />
        ))}
      </datalist>
      <datalist id="api-image-size-options">
        {imageSizeOptions.map((size) => (
          <option value={size} key={size} />
        ))}
      </datalist>
    </>
  );
}

function ChatBackgroundEditor({
  conversation,
  onClose,
  onSave
}: {
  conversation: Conversation;
  onClose: () => void;
  onSave: (conversationId: string, chatBackgroundUrl: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState(conversation.chatBackgroundUrl || "");

  const save = (chatBackgroundUrl: string) => {
    setPreviewUrl(chatBackgroundUrl);
    onSave(conversation.id, chatBackgroundUrl);
    onClose();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const media = await fileToMediaAsset(file, `chat-background-${conversation.id}`);
    save(media.url);
    event.target.value = "";
  };

  return (
    <section className="profile-page local-image-page">
      <header className="chat-header profile-header">
        <button type="button" className="icon-button" onClick={onClose} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">设置聊天背景</div>
        <span />
      </header>
      <div className="local-image-body">
        <div className="local-image-preview chat-background-preview">
          {previewUrl ? <img src={previewUrl} alt="" /> : <span>默认背景</span>}
        </div>
        <label className="local-image-row">
          <span>从手机相册选择</span>
          <WeIcon name="arrow" size={12} className="native-chevron" />
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>
        {previewUrl && (
          <button type="button" className="local-image-reset" onClick={() => save("")}>
            使用默认背景
          </button>
        )}
      </div>
    </section>
  );
}

function ChatHistorySearchPage({
  messages,
  onBack
}: {
  messages: Message[];
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();
  const results = messages
    .filter((message) => message.senderType !== "system")
    .filter((message) => !keyword || message.content.toLowerCase().includes(keyword))
    .slice()
    .reverse();

  return (
    <section className="profile-page chat-history-search-page">
      <header className="chat-header profile-header">
        <button type="button" className="icon-button" onClick={onBack} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">查找聊天记录</div>
        <span />
      </header>
      <div className="chat-history-search-body">
        <div className="chat-history-search-input">
          <WeIcon name="search" size={18} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" />
        </div>
        <div className="chat-history-search-categories">
          <span>日期</span><span>图片及视频</span><span>链接</span><span>文件</span>
        </div>
        {keyword && (
          <div className="chat-history-results">
            {results.length > 0 ? results.map((message) => (
              <div key={message.id}>
                <span>{message.senderType === "user" ? "我" : "对方"}</span>
                <p>{messagePreview(message)}</p>
                <small>{formatMomentTime(message.createdAt)}</small>
              </div>
            )) : <p className="chat-history-empty">无搜索结果</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function RedPacketPage({
  amount,
  blessing,
  balance,
  isGroup,
  onAmountChange,
  onBlessingChange,
  onBack,
  onSubmit
}: {
  amount: string;
  blessing: string;
  balance: number;
  isGroup: boolean;
  onAmountChange: (value: string) => void;
  onBlessingChange: (value: string) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const [packetType, setPacketType] = useState<"lucky" | "normal">("lucky");
  const [packetCount, setPacketCount] = useState("1");
  const numericAmount = Math.max(0, Number(amount) || 0);
  const canSubmit = numericAmount > 0 && numericAmount <= balance;

  return (
    <form className="profile-page red-packet-page" onSubmit={onSubmit}>
      <header className="chat-header red-packet-header">
        <button type="button" className="icon-button" onClick={onBack} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">发红包</div>
        <span />
      </header>
      <div className="red-packet-page-body">
        {isGroup && (
          <div className="red-packet-type-switch">
            <button type="button" className={packetType === "lucky" ? "active" : ""} onClick={() => setPacketType("lucky")}>拼手气红包</button>
            <button type="button" className={packetType === "normal" ? "active" : ""} onClick={() => setPacketType("normal")}>普通红包</button>
          </div>
        )}
        {isGroup && (
          <label className="red-packet-native-field">
            <span>红包个数</span>
            <input type="number" min="1" max="100" inputMode="numeric" value={packetCount} onChange={(event) => setPacketCount(event.target.value)} />
            <b>个</b>
          </label>
        )}
        <label className="red-packet-native-field">
          <span>{isGroup ? "总金额" : "金额"}</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={balance}
            inputMode="decimal"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="0.00"
            autoFocus
          />
          <b>元</b>
        </label>
        <p className="red-packet-field-hint">{isGroup ? "当前为群红包" : "对方可领取的红包"}</p>
        <label className="red-packet-native-field red-packet-blessing-field">
          <input value={blessing} maxLength={24} onChange={(event) => onBlessingChange(event.target.value)} placeholder="恭喜发财，大吉大利" />
        </label>
        <button type="button" className="red-packet-cover-row">
          <span>红包封面</span>
          <i aria-hidden="true"><b>恭喜发财</b></i>
          <WeIcon name="arrow" size={12} className="native-chevron" />
        </button>
        <div className="red-packet-total"><span>¥</span>{numericAmount.toFixed(2)}</div>
        <button className="red-packet-submit" type="submit" disabled={!canSubmit}>塞钱进红包</button>
        <p className="red-packet-balance">余额 {formatMoney(balance)}</p>
      </div>
    </form>
  );
}

function ChatInfoPage({
  conversation,
  members,
  onBack,
  onOpenProfile,
  onStartGroup,
  onSearch,
  onTogglePinned,
  onToggleMuted,
  onToggleFolded,
  onToggleForceNotify,
  onEditBackground,
  onClear,
  onReport
}: {
  conversation: Conversation;
  members: Character[];
  onBack: () => void;
  onOpenProfile: (characterId: string) => void;
  onStartGroup: () => void;
  onSearch: () => void;
  onTogglePinned: () => void;
  onToggleMuted: () => void;
  onToggleFolded: () => void;
  onToggleForceNotify: () => void;
  onEditBackground: () => void;
  onClear: () => void;
  onReport: () => void;
}) {
  return (
    <section className="profile-page chat-info-page">
      <header className="chat-header profile-header">
        <button type="button" className="icon-button" onClick={onBack} title="返回">
          <WeIcon name="back" size={24} />
        </button>
        <div className="chat-title">聊天信息{members.length > 1 ? `(${members.length})` : ""}</div>
        <span />
      </header>
      <div className="chat-info-scroll">
        <div className="chat-info-members">
          {members.map((member) => (
            <button type="button" key={member.id} onClick={() => onOpenProfile(member.id)}>
              <Avatar character={member} size="md" />
              <span>{member.remarkName}</span>
            </button>
          ))}
          <button type="button" onClick={onStartGroup}>
            <span className="chat-info-add-member"><WeIcon name="add" size={25} /></span>
            <span>添加</span>
          </button>
        </div>

        <div className="native-settings-group">
          <button className="native-settings-row" type="button" onClick={onSearch}>
            <span>查找聊天记录</span>
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
        </div>

        <div className="native-settings-group">
          <button className="native-settings-row" type="button" onClick={onToggleMuted}>
            <span>消息免打扰</span>
            <span className={`native-switch ${conversation.muted ? "active" : ""}`} aria-hidden="true"><i /></span>
          </button>
          <button className="native-settings-row" type="button" onClick={onToggleFolded}>
            <span>折叠该聊天</span>
            <span className={`native-switch ${conversation.folded ? "active" : ""}`} aria-hidden="true"><i /></span>
          </button>
          <button className="native-settings-row" type="button" onClick={onTogglePinned}>
            <span>置顶聊天</span>
            <span className={`native-switch ${conversation.pinned ? "active" : ""}`} aria-hidden="true"><i /></span>
          </button>
          <button className="native-settings-row" type="button" onClick={onToggleForceNotify}>
            <span>提醒</span>
            <span className={`native-switch ${conversation.forceNotify ? "active" : ""}`} aria-hidden="true"><i /></span>
          </button>
        </div>

        <div className="native-settings-group">
          <button className="native-settings-row" type="button" onClick={onEditBackground}>
            <span>设置当前聊天背景</span>
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
        </div>

        <div className="native-settings-group">
          <button className="native-settings-row" type="button" onClick={onClear}>
            <span>清空聊天记录</span>
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
          <button className="native-settings-row" type="button" onClick={onReport}>
            <span>投诉</span>
            <WeIcon name="arrow" size={12} className="native-chevron" />
          </button>
        </div>
      </div>
    </section>
  );
}

function ChatView({
  state,
  conversation,
  close,
  setState,
  isThinking,
  onQueueReply,
  onOpenProfile,
  onOpenUserProfile,
  onEditBackground,
  onStartGroup
}: {
  state: AppState;
  conversation: Conversation;
  close: () => void;
  setState: (updater: AppState | ((prev: AppState) => AppState)) => void;
  isThinking: boolean;
  onQueueReply: (conversationId: string, userMessageId: string, content: string, characterId?: string) => void;
  onOpenProfile: (characterId: string) => void;
  onOpenUserProfile: () => void;
  onEditBackground: () => void;
  onStartGroup: () => void;
}) {
  const [text, setText] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showRedPacketPanel, setShowRedPacketPanel] = useState(false);
  const [redPacketAmount, setRedPacketAmount] = useState("");
  const [redPacketBlessing, setRedPacketBlessing] = useState("恭喜发财，大吉大利");
  const [showChatActions, setShowChatActions] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [toastText, setToastText] = useState("");
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const members = getConversationCharacters(conversation, state.characters);
  const character = members[0] || state.characters.find((item) => item.id === conversation.characterId)!;
  const isGroupConversation = members.length > 1;
  const messages = state.messages.filter((message) => message.conversationId === conversation.id);

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      const element = messageListRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.id, messages.length, isThinking, showStickers, showMoreActions, showRedPacketPanel]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    };
  }, []);

  const appendMessages = (messagesToAdd: Message[]) => {
    const latest = messagesToAdd[messagesToAdd.length - 1];
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, ...messagesToAdd],
      conversations: prev.conversations.map((item) =>
        item.id === conversation.id ? { ...item, lastMessageAt: latest.createdAt, unreadCount: 0 } : item
      )
    }));
  };

  const sendMediaMessage = (asset: MediaAsset, contentType: "image" | "sticker") => {
    const message: Message = {
      id: createId("msg"),
      conversationId: conversation.id,
      senderType: "user",
      contentType,
      content: asset.label || asset.title || (contentType === "sticker" ? "表情" : "图片"),
      media: asset,
      aiGenerated: false,
      riskLevel: "L0",
      createdAt: new Date().toISOString(),
      modelName: "human"
    };
    appendMessages([message]);
    setShowStickers(false);
    setShowMoreActions(false);
    setShowRedPacketPanel(false);
  };

  const sendRedPacket = (event?: FormEvent) => {
    event?.preventDefault();
    const amount = Math.max(0, Math.round(Number(redPacketAmount) * 100) / 100);
    if (!amount || amount > state.wallet.balance) return;
    const blessing = redPacketBlessing.trim() || "恭喜发财，大吉大利";
    const now = new Date().toISOString();
    const message: Message = {
      id: createId("msg"),
      conversationId: conversation.id,
      senderType: "user",
      contentType: "red_packet",
      content: blessing,
      redPacket: {
        amount,
        blessing,
        status: "sent"
      },
      aiGenerated: false,
      riskLevel: "L0",
      createdAt: now,
      modelName: "human"
    };

    setState((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balance: Math.max(0, prev.wallet.balance - amount),
        totalSent: prev.wallet.totalSent + amount
      },
      messages: [...prev.messages, message],
      conversations: prev.conversations.map((item) =>
        item.id === conversation.id ? { ...item, lastMessageAt: now, unreadCount: 0 } : item
      )
    }));
    setShowRedPacketPanel(false);
    setShowMoreActions(false);
    setRedPacketAmount("");
    setRedPacketBlessing("恭喜发财，大吉大利");
    window.setTimeout(() => {
      const replyAt = new Date().toISOString();
      const thanks = [
        "收到了，今天这份仪式感可以。",
        "哈哈我收下了，先记你一笔好。",
        "收到，谢谢老板。",
        "这个红包我就不客气啦。"
      ];
      const reply: Message = {
        id: createId("msg"),
        conversationId: conversation.id,
        senderType: "ai",
        senderCharacterId: character.id,
        contentType: "text",
        content: thanks[Math.floor(Math.abs(character.id.length + amount)) % thanks.length],
        aiGenerated: true,
        riskLevel: "L0",
        createdAt: replyAt,
        modelName: "red-packet-receipt"
      };
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages.map((item) =>
            item.id === message.id && item.redPacket
              ? {
                  ...item,
                  redPacket: {
                    ...item.redPacket,
                    status: "opened" as const,
                    openedAt: replyAt
                  }
                }
              : item
          ),
          reply
        ],
        conversations: prev.conversations.map((item) =>
          item.id === conversation.id ? { ...item, lastMessageAt: replyAt, unreadCount: 0 } : item
        )
      }));
    }, 760);
  };

  const receiveRedPacket = (message: Message) => {
    if (message.senderType !== "ai" || message.contentType !== "red_packet" || message.redPacket?.status !== "unopened") return;
    const amount = Math.max(0, Math.round(message.redPacket.amount || 0));
    const openedAt = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balance: prev.wallet.balance + amount,
        totalReceived: prev.wallet.totalReceived + amount
      },
      messages: prev.messages.map((item) =>
        item.id === message.id
          ? {
              ...item,
              redPacket: {
                ...item.redPacket!,
                status: "opened",
                openedAt
              }
            }
          : item
      )
    }));
  };

  const handleChatImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    sendMediaMessage(await fileToMediaAsset(file, "chat"), "image");
    event.target.value = "";
  };

  const togglePinned = () => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((item) =>
        item.id === conversation.id ? { ...item, pinned: !item.pinned } : item
      )
    }));
  };

  const toggleMuted = () => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((item) =>
        item.id === conversation.id ? { ...item, muted: !item.muted } : item
      )
    }));
  };

  const toggleFolded = () => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((item) =>
        item.id === conversation.id
          ? { ...item, folded: !item.folded, muted: item.folded ? item.muted : true, pinned: item.folded ? item.pinned : false }
          : item
      )
    }));
  };

  const toggleForceNotify = () => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((item) =>
        item.id === conversation.id ? { ...item, forceNotify: !item.forceNotify } : item
      )
    }));
  };

  const clearConversationMessages = () => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((message) => message.conversationId !== conversation.id || message.senderType === "system")
    }));
  };

  const showToast = (message: string) => {
    setToastText(message);
    window.setTimeout(() => {
      setToastText((current) => (current === message ? "" : current));
    }, 1400);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (message: Message) => {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      setActiveMessage(message);
      longPressTimer.current = null;
    }, 520);
  };

  const copyMessage = async (message: Message) => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(messageActionText(message));
      showToast("已复制");
    } catch {
      showToast("复制失败");
    }
  };

  const deleteMessage = (messageId: string) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((message) => message.id !== messageId)
    }));
    showToast("已删除");
  };

  const favoriteMessage = (message: Message) => {
    const content = messageActionText(message);
    const senderCharacter = state.characters.find((item) => item.id === message.senderCharacterId);
    const senderLabel = message.senderType === "user" ? state.user.displayName : senderCharacter?.remarkName || conversation.title;
    setState((prev) => ({
      ...prev,
      memories: [
        {
          id: createId("mem"),
          type: "event" as const,
          title: conversation.title,
          excerpt: content.slice(0, 120),
          conversationTitle: conversation.title,
          senderLabel,
          favoriteKind: "message" as const,
          media: message.media,
          content,
          sensitivity: "low" as const,
          sourceConversationId: message.conversationId,
          createdAt: new Date().toISOString()
        },
        ...prev.memories
      ].slice(0, 16)
    }));
    showToast("已收藏");
  };

  const quoteMessage = (message: Message) => {
    setText(`「${shortMessagePreview(message)}」\n`);
    window.setTimeout(scrollToBottom, 60);
  };

  const forwardMessage = (targetConversationId: string, message: Message) => {
    const now = new Date().toISOString();
    const forwarded: Message = {
      ...message,
      id: createId("msg"),
      conversationId: targetConversationId,
      senderType: "user",
      senderCharacterId: undefined,
      contentType: message.contentType === "red_packet" ? "text" : message.contentType,
      content: message.contentType === "red_packet" ? messageActionText(message) : message.content,
      redPacket: undefined,
      aiGenerated: false,
      riskLevel: "L0",
      createdAt: now,
      modelName: "human-forward"
    };
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, forwarded],
      conversations: prev.conversations.map((item) =>
        item.id === targetConversationId ? { ...item, lastMessageAt: now, unreadCount: 0 } : item
      )
    }));
    showToast("已转发");
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = text.trim();
    if (!content) return;

    const userMessage: Message = {
      id: createId("msg"),
      conversationId: conversation.id,
      senderType: "user",
      contentType: "text",
      content,
      aiGenerated: false,
      riskLevel: "L0",
      createdAt: new Date().toISOString(),
      modelName: "human"
    };

    setText("");
    setState((prev) => {
      const withUser = {
        ...prev,
        messages: [...prev.messages, userMessage],
        conversations: prev.conversations.map((item) =>
          item.id === conversation.id ? { ...item, lastMessageAt: userMessage.createdAt, unreadCount: 0 } : item
        )
      };
      return updateMemoryFromMessage(withUser, conversation.id, content);
    });
    const replyTargets = isGroupConversation
      ? members
          .filter((member) => member.enabled)
          .slice()
          .sort((a, b) => ((content.length + a.id.length) % 7) - ((content.length + b.id.length) % 7))
          .slice(0, content.length > 12 ? 2 : 1)
      : [character];
    replyTargets.forEach((target) => onQueueReply(conversation.id, userMessage.id, content, target.id));
  };

  const chatBackgroundUrl = (conversation.chatBackgroundUrl || "").trim();
  const chatBackgroundStyle = chatBackgroundUrl
    ? { backgroundImage: `url("${chatBackgroundUrl.replace(/"/g, "%22")}")` }
    : undefined;
  const drawerOpen = showStickers || showMoreActions;

  if (showRedPacketPanel) {
    return (
      <RedPacketPage
        amount={redPacketAmount}
        blessing={redPacketBlessing}
        balance={state.wallet.balance}
        isGroup={isGroupConversation}
        onAmountChange={setRedPacketAmount}
        onBlessingChange={setRedPacketBlessing}
        onBack={() => setShowRedPacketPanel(false)}
        onSubmit={sendRedPacket}
      />
    );
  }

  if (showChatSearch) {
    return <ChatHistorySearchPage messages={messages} onBack={() => setShowChatSearch(false)} />;
  }

  if (showChatActions) {
    return (
      <>
        <ChatInfoPage
          conversation={conversation}
          members={members}
          onBack={() => setShowChatActions(false)}
          onOpenProfile={onOpenProfile}
          onStartGroup={onStartGroup}
          onSearch={() => setShowChatSearch(true)}
          onTogglePinned={togglePinned}
          onToggleMuted={toggleMuted}
          onToggleFolded={toggleFolded}
          onToggleForceNotify={toggleForceNotify}
          onEditBackground={onEditBackground}
          onClear={() => setShowClearConfirm(true)}
          onReport={() => setShowReportSheet(true)}
        />
        {showClearConfirm && (
          <ActionSheet
            title="清空后，聊天记录将无法恢复"
            onClose={() => setShowClearConfirm(false)}
            actions={[{ label: "清空聊天记录", danger: true, onClick: clearConversationMessages }]}
          />
        )}
        {showReportSheet && (
          <ActionSheet
            title="投诉"
            onClose={() => setShowReportSheet(false)}
            actions={[
              { label: "发布不适当内容", onClick: () => showToast("已记录") },
              { label: "存在欺诈骗钱行为", onClick: () => showToast("已记录") },
              { label: "其他", onClick: () => showToast("已记录") }
            ]}
          />
        )}
        {toastText && <div className="chat-toast">{toastText}</div>}
      </>
    );
  }

  return (
    <section className={`chat-view ${drawerOpen ? "has-open-drawer" : ""}`}>
      <header className="chat-header">
        <button className="icon-button" onClick={close}>
          <WeIcon name="back" size={24} />
        </button>
        <div>
          <div className="chat-title">
            {conversation.title}
            <AiBadge />
          </div>
          {isThinking && <div className="chat-subtitle">{isGroupConversation ? "有人正在输入..." : "对方正在输入..."}</div>}
          {!isThinking && isGroupConversation && <div className="chat-subtitle">{members.length}人</div>}
        </div>
        <button className="icon-button" onClick={() => setShowChatActions(true)} title="聊天信息">
          <WeIcon name="more" size={24} />
        </button>
      </header>

      <div
        className={`message-list ${chatBackgroundUrl ? "has-custom-background" : ""}`}
        ref={messageListRef}
        style={chatBackgroundStyle}
      >
        {messages.filter((message) => message.senderType !== "system").map((message) => {
          const mine = message.senderType === "user";
          const system = false;
          const senderCharacter =
            state.characters.find((item) => item.id === message.senderCharacterId) || character;
          return (
            <div className={`message-row ${mine ? "mine" : ""} ${system ? "system" : ""}`} key={message.id}>
              {!mine && !system && (
                <button type="button" className="avatar-button" onClick={() => onOpenProfile(senderCharacter.id)} title="查看资料">
                  <Avatar character={senderCharacter} size="sm" />
                </button>
              )}
              <div className="message-content">
                {!mine && isGroupConversation && <span className="message-sender-name">{senderCharacter.remarkName}</span>}
                <div
                  className={`bubble bubble-${message.contentType} ${
                    message.riskLevel === "L3" || message.riskLevel === "L4" ? "risk" : ""
                  }`}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setActiveMessage(message);
                  }}
                  onTouchStart={() => startLongPress(message)}
                  onTouchMove={clearLongPress}
                  onTouchEnd={clearLongPress}
                  onTouchCancel={clearLongPress}
                >
                  {message.contentType === "image" && message.media ? (
                    <img className="message-image" src={message.media.url} alt={message.media.title || ""} />
                  ) : message.contentType === "sticker" && message.media ? (
                    <img className="message-sticker" src={message.media.url} alt={message.media.label || ""} />
                  ) : message.contentType === "red_packet" && message.redPacket ? (
                    <button
                      type="button"
                      className="red-packet-card"
                      onClick={() => receiveRedPacket(message)}
                      disabled={mine || message.redPacket.status !== "unopened"}
                    >
                      <span className="red-packet-mark">¥</span>
                      <span className="red-packet-main">
                        <b>{message.redPacket.blessing || "恭喜发财，大吉大利"}</b>
                        <small>
                          {mine
                            ? message.redPacket.status === "opened"
                              ? `对方已领取 ${formatMoney(message.redPacket.amount)}`
                              : `已发送 ${formatMoney(message.redPacket.amount)}`
                            : message.redPacket.status === "opened"
                              ? `已领取 ${formatMoney(message.redPacket.amount)}`
                              : "微信红包"}
                        </small>
                      </span>
                      {!mine && message.redPacket.status === "unopened" && <span className="red-packet-open">开</span>}
                    </button>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
              {mine && !system && (
                <button type="button" className="avatar-button" onClick={onOpenUserProfile} title="个人信息">
                  <UserAvatar user={state.user} size="sm" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form className="composer" onSubmit={sendMessage}>
        <button type="button" className="tool-button" title="语音">
          <WeIcon name="voice" size={28} />
        </button>
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (event.target.value.trim()) {
              setShowStickers(false);
              setShowMoreActions(false);
              setShowRedPacketPanel(false);
            }
          }}
          onFocus={() => {
            setShowStickers(false);
            setShowMoreActions(false);
            setShowRedPacketPanel(false);
            window.setTimeout(scrollToBottom, 260);
          }}
          placeholder="发消息"
          maxLength={500}
        />
        <button
          type="button"
          className="tool-button"
          onClick={() => {
            setShowStickers((value) => !value);
            setShowMoreActions(false);
            setShowRedPacketPanel(false);
          }}
          title="表情"
        >
          <WeIcon name="emoji" size={28} />
        </button>
        {text.trim() ? (
          <button className="send-button text-send-button" type="submit">
            发送
          </button>
        ) : (
          <button
            type="button"
            className="tool-button plus-tool-button"
            onClick={() => {
              setShowMoreActions((value) => !value);
              setShowStickers(false);
              setShowRedPacketPanel(false);
            }}
            title="更多"
          >
            <WeIcon name="plus-circle" size={28} />
          </button>
        )}
      </form>

      {showStickers && (
        <div className="chat-drawer sticker-drawer">
          {stickerPack.map((sticker) => (
            <button type="button" key={sticker.id} onClick={() => sendMediaMessage(sticker, "sticker")}>
              <img src={sticker.url} alt={sticker.label || ""} />
              <span>{sticker.label}</span>
            </button>
          ))}
        </div>
      )}

      {showMoreActions && (
        <div className="chat-drawer more-drawer">
          <label className="more-drawer-item">
            <span><WeIcon name="album" size={24} /></span>
            <b>照片</b>
            <input type="file" accept="image/*" onChange={handleChatImageFile} />
          </label>
          <button
            type="button"
            onClick={() => {
              setShowRedPacketPanel(true);
              setShowStickers(false);
              setShowMoreActions(false);
            }}
          >
            <span className="red-action-icon">¥</span>
            <b>红包</b>
          </button>
          <button type="button" onClick={() => setShowStickers(true)}>
            <span><WeIcon name="emoji" size={24} /></span>
            <b>表情</b>
          </button>
        </div>
      )}

      {activeMessage && (
        <ActionSheet
          title={shortMessagePreview(activeMessage)}
          onClose={() => setActiveMessage(null)}
          actions={[
            { label: "复制", icon: <WeIcon name="copy" size={18} />, onClick: () => copyMessage(activeMessage) },
            { label: "转发", icon: <WeIcon name="upload" size={18} />, onClick: () => setForwardingMessage(activeMessage) },
            { label: "收藏", icon: <WeIcon name="star" size={18} />, onClick: () => favoriteMessage(activeMessage) },
            { label: "引用", icon: <WeIcon name="comment" size={18} />, onClick: () => quoteMessage(activeMessage) },
            { label: "删除", icon: <WeIcon name="delete" size={18} />, danger: true, onClick: () => deleteMessage(activeMessage.id) }
          ]}
        />
      )}
      {forwardingMessage && (
        <ActionSheet
          title="转发给"
          onClose={() => setForwardingMessage(null)}
          actions={state.conversations
            .filter((item) => item.id !== conversation.id)
            .slice(0, 6)
            .map((item) => {
              return {
                label: item.title,
                icon: <ConversationAvatar conversation={item} characters={state.characters} size="sm" />,
                onClick: () => forwardMessage(item.id, forwardingMessage)
              };
            })}
        />
      )}
      {toastText && <div className="chat-toast">{toastText}</div>}
    </section>
  );
}

function BottomTabs({
  active,
  setActive,
  hasUnreadMoments
}: {
  active: TabKey;
  setActive: (tab: TabKey) => void;
  hasUnreadMoments: boolean;
}) {
  const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: "chats", label: "微信", icon: "tab-chat" },
    { key: "contacts", label: "通讯录", icon: "tab-contacts" },
    { key: "moments", label: "发现", icon: "tab-discover" },
    { key: "me", label: "我", icon: "tab-me" }
  ];
  return (
    <nav className="bottom-tabs">
      {tabs.map((tab) => (
        <button className={active === tab.key ? "active" : ""} key={tab.key} onClick={() => setActive(tab.key)}>
          <span className="bottom-tab-icon">
            <WeIcon name={tab.icon} active={active === tab.key} />
            {tab.key === "moments" && hasUnreadMoments && (
              <span className="bottom-tab-unread-dot" aria-hidden="true" />
            )}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const [state, setState] = useState(loadAppState);
  const [activeTab, setActiveTab] = useState<TabKey>("chats");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeProfileCharacterId, setActiveProfileCharacterId] = useState<string | null>(null);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [isMomentsOpen, setIsMomentsOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [isEditingUserAvatar, setIsEditingUserAvatar] = useState(false);
  const [isEditingMomentsCover, setIsEditingMomentsCover] = useState(false);
  const [editingBackgroundConversationId, setEditingBackgroundConversationId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGeneratingMoment, setIsGeneratingMoment] = useState(false);
  const [isMainActionsOpen, setIsMainActionsOpen] = useState(false);
  const [isGroupCreatorOpen, setIsGroupCreatorOpen] = useState(false);
  const [isRelationshipsOpen, setIsRelationshipsOpen] = useState(false);
  const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState(false);
  const [managedCharacterId, setManagedCharacterId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
  const [pendingReplies, setPendingReplies] = useState<PendingReply[]>([]);
  const historyReady = useRef(false);
  const mainSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const processingReplyIds = useRef(new Set<string>());
  const processingConversationIds = useRef(new Set<string>());

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    setActiveTab("chats");
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setIsUserProfileOpen(false);
    setIsMomentsOpen(false);
    setIsFavoritesOpen(false);
    setState((prev) => ({ ...prev, user: { ...prev.user, lastActiveAt: new Date().toISOString() } }));
    void checkForInternalUpdate();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      setState((prev) => {
        const withActivity = { ...prev, user: { ...prev.user, lastActiveAt: new Date().toISOString() } };
        return isActive ? advanceLocalLife(withActivity) : withActivity;
      });
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);

  useEffect(() => {
    pendingReplies.forEach((pending) => {
      if (processingReplyIds.current.has(pending.id) || processingConversationIds.current.has(pending.conversationId)) return;
      const conversationSnapshot = state.conversations.find((item) => item.id === pending.conversationId);
      if (!conversationSnapshot) {
        setPendingReplies((prev) => prev.filter((item) => item.id !== pending.id));
        return;
      }
      const characterSnapshot = state.characters.find((item) => item.id === (pending.characterId || conversationSnapshot.characterId));
      if (!characterSnapshot) {
        setPendingReplies((prev) => prev.filter((item) => item.id !== pending.id));
        return;
      }

      processingReplyIds.current.add(pending.id);
      processingConversationIds.current.add(pending.conversationId);

      const run = async () => {
        try {
          const memorySummary = state.memories
            .slice(0, 5)
            .map((memory) => memory.content)
            .join("\n");
          const recentMessages = state.messages
            .filter((message) => message.conversationId === pending.conversationId && message.senderType !== "system")
            .slice(-12);
          const memberIds = new Set(getConversationMemberIds(conversationSnapshot));
          const relationshipContext = state.characterRelationships
            .filter(
              (relationship) =>
                memberIds.has(relationship.characterAId) && memberIds.has(relationship.characterBId)
            )
            .map((relationship) => {
              const characterA = state.characters.find((character) => character.id === relationship.characterAId);
              const characterB = state.characters.find((character) => character.id === relationship.characterBId);
              if (!characterA || !characterB) return "";
              return `- ${characterA.remarkName}与${characterB.remarkName}：${relationship.label}${
                relationship.note ? `；${relationship.note}` : ""
              }`;
            })
            .filter(Boolean)
            .join("\n");
          const speakerLabels = Object.fromEntries(
            state.characters.map((character) => [character.id, character.remarkName])
          );
          const characterSettings = modelSettingsForCharacter(state.settings, characterSnapshot);
          const activeProvider =
            characterSettings.providerMode === "openai_compatible" && hasConfiguredProvider(characterSettings)
              ? makeConfiguredProvider(characterSettings)
              : localProvider;
          const result = await activeProvider
            .chat({
              character: characterSnapshot,
              userMessage: pending.content,
              recentMessages,
              memorySummary,
              relationshipContext,
              speakerLabels,
              globalSkillPrompt: state.settings.globalSkillPrompt,
              globalSkillIds: []
            })
            .catch(async () => {
              const fallback = await localProvider.chat({
                character: characterSnapshot,
                userMessage: pending.content,
                recentMessages,
                memorySummary,
                relationshipContext,
                speakerLabels,
                globalSkillPrompt: state.settings.globalSkillPrompt,
                globalSkillIds: []
              });
              return { ...fallback, modelName: "local-fallback-v1" };
            });

          const delay = Math.min(2200, 520 + pending.content.length * 18 + characterSnapshot.personality.warmth * 22);
          await new Promise((resolve) => window.setTimeout(resolve, delay));

          const aiMessage: Message = {
            id: createId("msg"),
            conversationId: pending.conversationId,
            senderType: "ai",
            senderCharacterId: characterSnapshot.id,
            contentType: "text",
            content: result.content,
            aiGenerated: true,
            riskLevel: result.riskLevel,
            createdAt: new Date().toISOString(),
            modelName: result.modelName
          };
          const outgoing: Message[] = [aiMessage];
          const redPacketCue = /红包|钱|奖励|打赏|恭喜|生日|开心|加油|辛苦|难过|安慰|哄我|鼓励/.test(
            `${pending.content} ${result.content}`
          );
          const redPacketEnabled =
            hasSkill(characterSnapshot, [], "red_packet") || hasSkill(characterSnapshot, [], "playful_combo");
          if (
            result.riskLevel !== "L3" &&
            result.riskLevel !== "L4" &&
            (redPacketCue || (redPacketEnabled && /加油|辛苦|难过|开心|恭喜|生日/.test(pending.content)))
          ) {
            const amount = pickRedPacketAmount(`${characterSnapshot.id}${pending.content}${outgoing.length}`);
            outgoing.push({
              id: createId("msg"),
              conversationId: pending.conversationId,
              senderType: "ai",
              senderCharacterId: characterSnapshot.id,
              contentType: "red_packet",
              content: "一点心意，收一下",
              redPacket: {
                amount,
                blessing: "一点心意，收一下",
                status: "unopened"
              },
              aiGenerated: true,
              riskLevel: "L0",
              createdAt: new Date().toISOString(),
              modelName: "red-packet-skill"
            });
          }

          if (shouldAttachImageFromText(pending.content) && result.riskLevel !== "L3" && result.riskLevel !== "L4") {
            const imagePrompt = imageQueryFromText(pending.content, characterSnapshot);
            const generated = await generateImageAsset(characterSettings, imagePrompt).catch(() => null);
            const images = generated ? [] : await searchImages(imagePrompt, 8).catch(() => []);
            const asset = generated || (images[0] ? await cacheImageAsset(images[0]) : undefined);
            if (asset) {
              outgoing.push({
                id: createId("msg"),
                conversationId: pending.conversationId,
                senderType: "ai",
                senderCharacterId: characterSnapshot.id,
                contentType: "image",
                content: asset.title || imagePrompt || "图片",
                media: asset,
                aiGenerated: true,
                riskLevel: "L0",
                createdAt: new Date().toISOString(),
                modelName: generated ? characterSettings.apiImageModel || "image-generation" : "image-search"
              });
            }
          }

          const lastOutgoingAt = outgoing[outgoing.length - 1].createdAt;
          const isOpenConversation = activeConversationIdRef.current === pending.conversationId;
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, ...outgoing],
            conversations: prev.conversations.map((item) =>
              item.id === pending.conversationId
                ? {
                    ...item,
                    lastMessageAt: lastOutgoingAt,
                    unreadCount: isOpenConversation ? 0 : item.unreadCount + 1
                  }
                : item
            ),
            auditEvents:
              result.riskLevel === "L3" || result.riskLevel === "L4"
                ? [
                    {
                      id: createId("audit"),
                      eventType: "risk",
                      riskLevel: result.riskLevel,
                      summary: `${characterSnapshot.remarkName} 对话触发 ${result.riskLevel} 安全模式。`,
                      evidenceMessageIds: [pending.userMessageId, aiMessage.id],
                      createdAt: aiMessage.createdAt
                    },
                    ...prev.auditEvents
                  ]
                : prev.auditEvents
          }));
        } finally {
          processingReplyIds.current.delete(pending.id);
          processingConversationIds.current.delete(pending.conversationId);
          setPendingReplies((prev) => prev.filter((item) => item.id !== pending.id));
        }
      };

      void run();
    });
  }, [pendingReplies, state]);

  useEffect(() => {
    const publishAutoMoment = () => {
      setState((prev) => {
        if (!prev.settings.momentsEnabled) return prev;
        const now = Date.now();
        const recentAutoMoment = prev.moments.some(
          (post) =>
            post.aiGenerated &&
            post.generationReason === "auto_local_moment" &&
            now - new Date(post.createdAt).getTime() < 20 * 60 * 1000
        );
        if (recentAutoMoment) return prev;

        const today = new Date().toDateString();
        const candidates = prev.characters.filter((character) => {
          if (!character.enabled || !character.momentsPolicy.enabled || character.momentsPolicy.maxPostsPerDay <= 0) return false;
          const todayPosts = prev.moments.filter(
            (post) =>
              post.authorCharacterId === character.id &&
              post.aiGenerated &&
              post.generationReason === "auto_local_moment" &&
              new Date(post.createdAt).toDateString() === today
          ).length;
          return todayPosts < character.momentsPolicy.maxPostsPerDay;
        });
        if (candidates.length === 0) return prev;

        const character = candidates[(prev.moments.length + new Date().getMinutes()) % candidates.length];
        const post = generateMoment(prev, character);
        return {
          ...prev,
          moments: [{ ...post, generationReason: "auto_local_moment" }, ...prev.moments]
        };
      });
    };

    const firstRun = window.setTimeout(publishAutoMoment, 2500);
    const timer = window.setInterval(publishAutoMoment, 2 * 60 * 1000);
    return () => {
      window.clearTimeout(firstRun);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!historyReady.current) {
      window.history.replaceState(
        { app: "weichat", tab: "chats", conversationId: null, profileCharacterId: null, userProfileOpen: false, momentsOpen: false },
        ""
      );
      historyReady.current = true;
    }

    const onPopState = (event: PopStateEvent) => {
      const view = event.state;
      if (view?.app === "weichat") {
        setActiveTab((view.tab as TabKey) || "chats");
        setActiveConversationId(view.conversationId || null);
        setActiveProfileCharacterId(view.profileCharacterId || null);
        setIsUserProfileOpen(Boolean(view.userProfileOpen));
        setIsMomentsOpen(Boolean(view.momentsOpen));
        setIsFavoritesOpen(Boolean(view.favoritesOpen));
      } else {
        setActiveConversationId(null);
        setActiveProfileCharacterId(null);
        setIsUserProfileOpen(false);
        setIsMomentsOpen(false);
        setIsFavoritesOpen(false);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener("backButton", () => {
      if (editingCharacterId) {
        setEditingCharacterId(null);
        return;
      }
      if (isEditingUserAvatar) {
        setIsEditingUserAvatar(false);
        return;
      }
      if (isEditingMomentsCover) {
        setIsEditingMomentsCover(false);
        return;
      }
      if (editingBackgroundConversationId) {
        setEditingBackgroundConversationId(null);
        return;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return;
      }
      if (isWalletOpen) {
        setIsWalletOpen(false);
        return;
      }
      if (isSearchOpen) {
        setIsSearchOpen(false);
        return;
      }
      if (isMainActionsOpen) {
        setIsMainActionsOpen(false);
        return;
      }
      if (isGroupCreatorOpen) {
        setIsGroupCreatorOpen(false);
        return;
      }
      if (isRelationshipsOpen) {
        setIsRelationshipsOpen(false);
        return;
      }
      if (managedCharacterId) {
        setManagedCharacterId(null);
        return;
      }
      if (isCharacterManagerOpen) {
        setIsCharacterManagerOpen(false);
        return;
      }
      if (activeTool) {
        setActiveTool(null);
        return;
      }
      if (activeConversationId || activeProfileCharacterId || isUserProfileOpen || isMomentsOpen || isFavoritesOpen) {
        window.history.back();
        return;
      }
      CapacitorApp.exitApp();
    });

    return () => {
      listener.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [
    activeConversationId,
    activeProfileCharacterId,
    activeTool,
    editingBackgroundConversationId,
    editingCharacterId,
    isEditingUserAvatar,
    isEditingMomentsCover,
    isCharacterManagerOpen,
    isGroupCreatorOpen,
    isMainActionsOpen,
    isMomentsOpen,
    isRelationshipsOpen,
    isFavoritesOpen,
    isSearchOpen,
    isSettingsOpen,
    isWalletOpen,
    isUserProfileOpen,
    managedCharacterId
  ]);

  const activeConversation = useMemo(
    () => state.conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, state.conversations]
  );

  const activeProfileCharacter = useMemo(
    () => state.characters.find((character) => character.id === activeProfileCharacterId),
    [activeProfileCharacterId, state.characters]
  );

  const managedCharacter = useMemo(
    () => state.characters.find((character) => character.id === managedCharacterId),
    [managedCharacterId, state.characters]
  );

  const managedCharacterMemories = useMemo(() => {
    if (!managedCharacter) return [];
    const conversationIds = new Set(
      state.conversations
        .filter((conversation) => getConversationMemberIds(conversation).includes(managedCharacter.id))
        .map((conversation) => conversation.id)
    );
    return state.memories
      .filter((memory) => memory.sourceConversationId && conversationIds.has(memory.sourceConversationId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [managedCharacter, state.conversations, state.memories]);

  const activeBackgroundConversation = useMemo(
    () => state.conversations.find((conversation) => conversation.id === editingBackgroundConversationId),
    [editingBackgroundConversationId, state.conversations]
  );

  const navigateTab = (tab: TabKey) => {
    if (
      tab === activeTab &&
      !activeConversationId &&
      !activeProfileCharacterId &&
      !isUserProfileOpen &&
      !isMomentsOpen &&
      !isFavoritesOpen
    ) {
      return;
    }
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setIsUserProfileOpen(false);
    setIsMomentsOpen(false);
    setIsFavoritesOpen(false);
    setActiveTab(tab);
    window.history.pushState(
      { app: "weichat", tab, conversationId: null, profileCharacterId: null, userProfileOpen: false, momentsOpen: false },
      ""
    );
  };

  const openConversation = (conversationId: string) => {
    setActiveTab("chats");
    setActiveConversationId(conversationId);
    setActiveProfileCharacterId(null);
    setIsUserProfileOpen(false);
    setIsMomentsOpen(false);
    setIsFavoritesOpen(false);
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      ),
      lifeEvents: prev.lifeEvents.map((event) =>
        event.conversationId === conversationId ? { ...event, seen: true } : event
      )
    }));
    window.history.pushState(
      { app: "weichat", tab: "chats", conversationId, profileCharacterId: null, userProfileOpen: false, momentsOpen: false },
      ""
    );
  };

  const closeConversation = () => {
    if (window.history.state?.app === "weichat" && window.history.state?.conversationId) {
      window.history.back();
      return;
    }
    setActiveConversationId(null);
  };

  const openCharacterProfile = (characterId: string) => {
    setActiveProfileCharacterId(characterId);
    setActiveConversationId(null);
    setIsUserProfileOpen(false);
    setIsMomentsOpen(false);
    setIsFavoritesOpen(false);
    setActiveTab("contacts");
    window.history.pushState(
      { app: "weichat", tab: "contacts", conversationId: null, profileCharacterId: characterId, userProfileOpen: false, momentsOpen: false },
      ""
    );
  };

  const closeCharacterProfile = () => {
    if (window.history.state?.app === "weichat" && window.history.state?.profileCharacterId) {
      window.history.back();
      return;
    }
    setActiveProfileCharacterId(null);
  };

  const openUserProfile = () => {
    setIsUserProfileOpen(true);
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setIsMomentsOpen(false);
    setIsFavoritesOpen(false);
    setActiveTab("me");
    window.history.pushState(
      { app: "weichat", tab: "me", conversationId: null, profileCharacterId: null, userProfileOpen: true, momentsOpen: false },
      ""
    );
  };

  const closeUserProfile = () => {
    if (window.history.state?.app === "weichat" && window.history.state?.userProfileOpen) {
      window.history.back();
      return;
    }
    setIsUserProfileOpen(false);
  };

  const openFavoritesPage = () => {
    setIsFavoritesOpen(true);
    setIsUserProfileOpen(false);
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setIsMomentsOpen(false);
    setActiveTab("me");
    window.history.pushState(
      { app: "weichat", tab: "me", conversationId: null, profileCharacterId: null, userProfileOpen: false, momentsOpen: false, favoritesOpen: true },
      ""
    );
  };

  const closeFavoritesPage = () => {
    if (window.history.state?.app === "weichat" && window.history.state?.favoritesOpen) {
      window.history.back();
      return;
    }
    setIsFavoritesOpen(false);
  };

  const deleteFavorite = (memoryId: string) => {
    setState((prev) => ({ ...prev, memories: prev.memories.filter((memory) => memory.id !== memoryId) }));
  };

  const saveToolCard = (title: string, content: string) => {
    setState((prev) => ({
      ...prev,
      memories: [
        {
          id: createId("mem"),
          type: "event" as const,
          title,
          excerpt: content.split("\n").filter(Boolean).slice(0, 3).join(" / "),
          content,
          favoriteKind: "tool" as const,
          sensitivity: "low" as const,
          createdAt: new Date().toISOString()
        },
        ...prev.memories
      ].slice(0, 24)
    }));
  };

  const applyDefaultChatBackground = (url: string) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, chatBackgroundUrl: url },
      conversations: prev.conversations.map((conversation) => ({
        ...conversation,
        chatBackgroundUrl: conversation.chatBackgroundUrl || url
      }))
    }));
    setActiveTool(null);
  };

  const createRoleFromTemplate = (template: "neighbor" | "mentor" | "night") => {
    const presets = {
      neighbor: {
        name: "小许",
        role: "楼下邻居",
        signature: "刚好路过，顺手问一句。",
        background: "住在附近的熟人，聊天自然，常常从生活小事切入。",
        avatarColor: "#20b8a7"
      },
      mentor: {
        name: "闻舟",
        role: "年长朋友",
        signature: "先稳住，再决定。",
        background: "经验更丰富的朋友，说话不急，适合复盘、提醒和做决定前聊一聊。",
        avatarColor: "#576b95"
      },
      night: {
        name: "南灯",
        role: "深夜朋友",
        signature: "夜里可以慢一点。",
        background: "适合睡前聊天的朋友，语气安静，不催促，能接住零散的表达。",
        avatarColor: "#8b6be8"
      }
    }[template];
    const character: Character = {
      ...seedCharacters[0],
      id: createId("c_template"),
      displayName: presets.name,
      remarkName: presets.name,
      initials: presets.name.slice(0, 1),
      avatarColor: presets.avatarColor,
      avatarUrl: `https://i.pravatar.cc/300?u=${encodeURIComponent(presets.name + Date.now())}`,
      relationshipToUser: "朋友",
      roleType: presets.role,
      gender: "unknown",
      region: "未设置",
      occupation: presets.role,
      signature: presets.signature,
      tags: ["模板", presets.role],
      background: presets.background,
      skillPrompt: "",
      skillIds: ["memory_callback"],
      proactivePolicy: { ...seedCharacters[0].proactivePolicy },
      momentsPolicy: { ...seedCharacters[0].momentsPolicy }
    };
    addCharacter(character);
    setActiveTool(null);
    setActiveTab("contacts");
  };

  const openMomentsPage = () => {
    setState((prev) => ({
      ...prev,
      lifeEvents: prev.lifeEvents.map((event) =>
        event.type === "moment" ? { ...event, seen: true } : event
      )
    }));
    setIsMomentsOpen(true);
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setIsUserProfileOpen(false);
    setIsFavoritesOpen(false);
    setActiveTab("moments");
    window.history.pushState(
      { app: "weichat", tab: "moments", conversationId: null, profileCharacterId: null, userProfileOpen: false, momentsOpen: true },
      ""
    );
  };

  const closeMomentsPage = () => {
    if (window.history.state?.app === "weichat" && window.history.state?.momentsOpen) {
      window.history.back();
      return;
    }
    setIsMomentsOpen(false);
  };

  const openCharacterConversation = (characterId: string) => {
    const existing = state.conversations.find((conversation) => conversation.characterId === characterId);
    if (existing) {
      setActiveConversationId(existing.id);
      setActiveProfileCharacterId(null);
      setIsUserProfileOpen(false);
      setIsMomentsOpen(false);
      setIsFavoritesOpen(false);
      setActiveTab("chats");
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((conversation) =>
          conversation.id === existing.id ? { ...conversation, unreadCount: 0 } : conversation
        )
      }));
      window.history.pushState(
        { app: "weichat", tab: "chats", conversationId: existing.id, profileCharacterId: null, userProfileOpen: false, momentsOpen: false },
        ""
      );
    }
  };

  const openGroupCreator = () => {
    setIsMainActionsOpen(false);
    setIsGroupCreatorOpen(true);
  };

  const createGroupConversation = (characterIds: string[]) => {
    if (characterIds.length < 2) return;
    const memberKey = [...characterIds].sort().join("|");
    const existing = state.conversations.find(
      (conversation) =>
        getConversationMemberIds(conversation).length > 1 &&
        [...getConversationMemberIds(conversation)].sort().join("|") === memberKey
    );
    if (existing) {
      setIsGroupCreatorOpen(false);
      openConversation(existing.id);
      return;
    }

    const members = characterIds
      .map((characterId) => state.characters.find((character) => character.id === characterId))
      .filter((character): character is Character => Boolean(character));
    if (members.length < 2) return;
    const now = new Date().toISOString();
    const title = `${members
      .slice(0, 3)
      .map((member) => member.remarkName)
      .join("、")}${members.length > 3 ? `等${members.length}人` : ""}`;
    const conversation: Conversation = {
      id: createId("conv_group"),
      characterId: members[0].id,
      memberCharacterIds: members.map((member) => member.id),
      title,
      pinned: false,
      muted: false,
      unreadCount: 0,
      lastMessageAt: now,
      chatBackgroundUrl: ""
    };
    const systemMessage: Message = {
      id: createId("msg"),
      conversationId: conversation.id,
      senderType: "system",
      contentType: "system",
      content: "已开始聊天。",
      aiGenerated: false,
      riskLevel: "L0",
      createdAt: now,
      modelName: "system"
    };
    setState((prev) => ({
      ...prev,
      conversations: [...prev.conversations, conversation],
      messages: [...prev.messages, systemMessage]
    }));
    setIsGroupCreatorOpen(false);
    setActiveTab("chats");
    setActiveConversationId(conversation.id);
    setActiveProfileCharacterId(null);
    setIsUserProfileOpen(false);
    setIsMomentsOpen(false);
    setIsFavoritesOpen(false);
    window.history.pushState(
      { app: "weichat", tab: "chats", conversationId: conversation.id, profileCharacterId: null, userProfileOpen: false, momentsOpen: false },
      ""
    );
  };

  const addCharacter = (character: Character) => {
    const conversation: Conversation = {
      id: `conv_${character.id}`,
      characterId: character.id,
      memberCharacterIds: [character.id],
      title: character.remarkName,
      pinned: false,
      muted: false,
      unreadCount: 0,
      lastMessageAt: new Date().toISOString(),
      chatBackgroundUrl: ""
    };
    const systemMessage: Message = {
      id: createId("msg"),
      conversationId: conversation.id,
      senderType: "system",
      contentType: "system",
      content: "已开始聊天。",
      aiGenerated: false,
      riskLevel: "L0",
      createdAt: new Date().toISOString(),
      modelName: "system"
    };
    setState((prev) => ({
      ...prev,
      characters: [...prev.characters, character],
      deletedCharacterIds: prev.deletedCharacterIds.filter((characterId) => characterId !== character.id),
      conversations: [...prev.conversations, conversation],
      messages: [...prev.messages, systemMessage]
    }));
  };

  const createManagedCharacter = (requestedName: string) => {
    const id = createId("c_custom");
    const name = requestedName.trim() || `新人物${state.characters.length + 1}`;
    const character: Character = {
      ...seedCharacters[0],
      id,
      displayName: name,
      remarkName: name,
      initials: "新",
      avatarColor: ["#18b97b", "#4e8df5", "#f06f54", "#8b6be8", "#d59d2a"][state.characters.length % 5],
      avatarUrl: "",
      relationshipToUser: "朋友",
      roleType: "自定义人物",
      gender: "unknown",
      region: "未设置",
      occupation: "",
      signature: "",
      tags: ["自定义"],
      album: [],
      background: `${name}是一个新创建的人物。`,
      skillPrompt: "",
      skillIds: ["memory_callback"],
      proactivePolicy: { ...seedCharacters[0].proactivePolicy },
      momentsPolicy: { ...seedCharacters[0].momentsPolicy },
      enabled: true
    };
    addCharacter(character);
    setManagedCharacterId(id);
  };

  const updateCharacterAvatar = (characterId: string, avatarUrl: string) => {
    setState((prev) => ({
      ...prev,
      characters: prev.characters.map((character) =>
        character.id === characterId ? { ...character, avatarUrl } : character
      )
    }));
  };

  const updateCharacter = (nextCharacter: Character) => {
    setState((prev) => ({
      ...prev,
      characters: prev.characters.map((character) =>
        character.id === nextCharacter.id ? nextCharacter : character
      ),
      conversations: prev.conversations.map((conversation) =>
        conversation.characterId === nextCharacter.id && getConversationMemberIds(conversation).length <= 1
          ? { ...conversation, title: nextCharacter.remarkName || nextCharacter.displayName }
          : conversation
      )
    }));
  };

  const deleteCharacter = (characterId: string) => {
    setState((prev) => {
      const removedConversationIds = new Set<string>();
      const conversations: Conversation[] = [];

      prev.conversations.forEach((conversation) => {
        const memberIds = getConversationMemberIds(conversation);
        if (!memberIds.includes(characterId)) {
          conversations.push(conversation);
          return;
        }

        const remainingIds = memberIds.filter((memberId) => memberId !== characterId);
        if (memberIds.length <= 1 || remainingIds.length < 2) {
          removedConversationIds.add(conversation.id);
          return;
        }

        const remainingMembers = remainingIds
          .map((memberId) => prev.characters.find((character) => character.id === memberId))
          .filter((character): character is Character => Boolean(character));
        conversations.push({
          ...conversation,
          characterId: remainingIds[0],
          memberCharacterIds: remainingIds,
          title: `${remainingMembers
            .slice(0, 3)
            .map((member) => member.remarkName)
            .join("、")}${remainingMembers.length > 3 ? `等${remainingMembers.length}人` : ""}`
        });
      });

      return {
        ...prev,
        characters: prev.characters.filter((character) => character.id !== characterId),
        deletedCharacterIds: Array.from(new Set([...prev.deletedCharacterIds, characterId])),
        characterRelationships: prev.characterRelationships.filter(
          (relationship) => relationship.characterAId !== characterId && relationship.characterBId !== characterId
        ),
        conversations,
        messages: prev.messages.filter(
          (message) => !removedConversationIds.has(message.conversationId) && message.senderCharacterId !== characterId
        ),
        moments: prev.moments
          .filter((post) => post.authorCharacterId !== characterId)
          .map((post) => ({
            ...post,
            interactions: post.interactions.filter((interaction) => interaction.actorCharacterId !== characterId)
          })),
        lifeEvents: prev.lifeEvents
          .filter((event) => !event.conversationId || !removedConversationIds.has(event.conversationId))
          .map((event) => ({
            ...event,
            characterIds: event.characterIds.filter((id) => id !== characterId)
          }))
          .filter((event) => event.characterIds.length > 0),
        memories: prev.memories.filter(
          (memory) => !memory.sourceConversationId || !removedConversationIds.has(memory.sourceConversationId)
        )
      };
    });
    setPendingReplies((prev) => prev.filter((reply) => reply.characterId !== characterId));
    setManagedCharacterId(null);
    setEditingCharacterId(null);
  };

  const saveCharacterRelationship = (nextRelationship: CharacterRelationship) => {
    setState((prev) => {
      const exists = prev.characterRelationships.some((relationship) => relationship.id === nextRelationship.id);
      return {
        ...prev,
        characterRelationships: exists
          ? prev.characterRelationships.map((relationship) =>
              relationship.id === nextRelationship.id ? nextRelationship : relationship
            )
          : [...prev.characterRelationships, nextRelationship]
      };
    });
  };

  const deleteCharacterRelationship = (relationshipId: string) => {
    setState((prev) => ({
      ...prev,
      characterRelationships: prev.characterRelationships.filter((relationship) => relationship.id !== relationshipId)
    }));
  };

  const addCharacterMemory = (characterId: string, content: string) => {
    const conversation = state.conversations.find((item) => getConversationMemberIds(item).includes(characterId));
    setState((prev) => ({
      ...prev,
      memories: [
        {
          id: createId("mem"),
          type: "event" as const,
          title: "印象",
          excerpt: content,
          content,
          favoriteKind: "note" as const,
          sensitivity: "low" as const,
          sourceConversationId: conversation?.id,
          createdAt: new Date().toISOString()
        },
        ...prev.memories
      ].slice(0, 24)
    }));
  };

  const deleteMemory = (memoryId: string) => {
    setState((prev) => ({ ...prev, memories: prev.memories.filter((memory) => memory.id !== memoryId) }));
  };

  const updateUserAvatar = (avatarUrl: string) => {
    setState((prev) => ({ ...prev, user: { ...prev.user, avatarUrl } }));
  };

  const updateUserName = (displayName: string) => {
    setState((prev) => ({ ...prev, user: { ...prev.user, displayName: displayName || "我" } }));
  };

  const updateUserGender = (gender: NonNullable<UserProfile["gender"]>) => {
    setState((prev) => ({ ...prev, user: { ...prev.user, gender } }));
  };

  const updateMomentsCover = (momentsCoverUrl: string) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, momentsCoverUrl } }));
  };

  const updateConversationBackground = (conversationId: string, chatBackgroundUrl: string) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, chatBackgroundUrl } : conversation
      )
    }));
  };

  const handleMainTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select")) {
      mainSwipeStart.current = null;
      return;
    }
    const touch = event.touches[0];
    mainSwipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleMainTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = mainSwipeStart.current;
    mainSwipeStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    const currentIndex = tabOrder.indexOf(activeTab);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const nextTab = tabOrder[nextIndex];
    if (nextTab) navigateTab(nextTab);
  };

  const publishMoment = (content: string, media: MediaAsset[]) => {
    const post: MomentPost = {
      id: createId("post"),
      ownerUserId: state.user.id,
      authorUserId: state.user.id,
      content,
      media,
      visibility: "only_owner",
      aiGenerated: false,
      generationReason: "manual",
      riskLevel: "L0",
      createdAt: new Date().toISOString(),
      interactions: []
    };
    setState((prev) => ({ ...prev, moments: [post, ...prev.moments] }));
  };

  const generateNewMoment = async () => {
    if (isGeneratingMoment) return;
    setIsGeneratingMoment(true);
    const available = state.characters.filter((character) => character.enabled && character.momentsPolicy.enabled);
    const character = available[state.moments.length % available.length] ?? state.characters[0];
    const post = generateMoment(state, character);
    const imagePrompt = momentImageQuery(post.content, character);
    const characterSettings = modelSettingsForCharacter(state.settings, character);
    const generated = await generateImageAsset(characterSettings, imagePrompt).catch(() => null);
    const images = generated ? [] : await searchImages(imagePrompt, 8).catch(() => []);
    const image = generated || (images[0] ? await cacheImageAsset(images[0]) : undefined);
    setState((prev) => ({
      ...prev,
      moments: [{ ...post, media: image ? [image] : post.media }, ...prev.moments]
    }));
    setIsGeneratingMoment(false);
  };

  const toggleMomentLike = (postId: string) => {
    setState((prev) => ({
      ...prev,
      moments: prev.moments.map((post) => {
        if (post.id !== postId) return post;
        const actor = prev.characters.find((character) => character.id !== post.authorCharacterId) ?? prev.characters[0];
        const existing = post.interactions.find(
          (item) => item.type === "like" && item.actorCharacterId === actor.id
        );
        return {
          ...post,
          interactions: existing
            ? post.interactions.filter((item) => item.id !== existing.id)
            : [
                ...post.interactions,
                {
                  id: createId("interaction"),
                  actorCharacterId: actor.id,
                  type: "like",
                  aiGenerated: true,
                  createdAt: new Date().toISOString()
                }
              ]
        };
      })
    }));
  };

  const addMomentComment = (postId: string) => {
    setState((prev) => ({
      ...prev,
      moments: prev.moments.map((post) => {
        if (post.id !== postId) return post;
        const actor = prev.characters.find((character) => character.id !== post.authorCharacterId) ?? prev.characters[0];
        return {
          ...post,
          interactions: [
            ...post.interactions,
            {
              id: createId("interaction"),
              actorCharacterId: actor.id,
              type: "comment",
              content: "这句留一下。",
              aiGenerated: true,
              createdAt: new Date().toISOString()
            }
          ]
        };
      })
    }));
  };

  const triggerProactive = () => {
    setState((prev) => {
      if (!prev.settings.proactiveEnabled) return prev;
      const today = todayKey();
      const count = prev.counters.lastProactiveDate === today ? prev.counters.todayProactiveCount : 0;
      if (count >= prev.settings.dailyProactiveLimit) return prev;
      const character = prev.characters.find((item) => item.enabled && item.proactivePolicy.enabled) ?? prev.characters[0];
      const conversation = prev.conversations.find((item) => item.characterId === character.id)!;
      const message: Message = {
        id: createId("msg"),
        conversationId: conversation.id,
        senderType: "ai",
        senderCharacterId: character.id,
        contentType: "text",
        content: makeProactiveMessage(character),
        aiGenerated: true,
        riskLevel: "L0",
        createdAt: new Date().toISOString(),
        modelName: "local-proactive-v1"
      };
      return {
        ...prev,
        messages: [...prev.messages, message],
        conversations: prev.conversations.map((item) =>
          item.id === conversation.id
            ? { ...item, unreadCount: item.unreadCount + 1, lastMessageAt: message.createdAt }
            : item
        ),
        counters: {
          lastProactiveDate: today,
          todayProactiveCount: count + 1
        }
      };
    });
  };

  const queueReply = (conversationId: string, userMessageId: string, content: string, characterId?: string) => {
    setPendingReplies((prev) => [
      ...prev,
      {
        id: createId("pending"),
        conversationId,
        userMessageId,
        characterId,
        content,
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const activeTabIndex = Math.max(0, tabOrder.indexOf(activeTab));
  const unreadMomentEvents = state.lifeEvents
    .filter((event) => event.type === "moment" && !event.seen)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latestUnreadMomentEvent = unreadMomentEvents[0];
  const hasUnreadMoments = unreadMomentEvents.length > 0;
  const unreadMomentAuthor = state.characters.find(
    (character) => character.id === latestUnreadMomentEvent?.characterIds[0]
  );

  return (
    <div className="app-shell">
      <ModelOptionDatalists />
      {isGroupCreatorOpen ? (
        <GroupCreatorPage
          characters={state.characters}
          onBack={() => setIsGroupCreatorOpen(false)}
          onCreate={createGroupConversation}
        />
      ) : isRelationshipsOpen ? (
        <RelationshipManagerPage
          characters={state.characters}
          relationships={state.characterRelationships}
          onBack={() => setIsRelationshipsOpen(false)}
          onSave={saveCharacterRelationship}
          onDelete={deleteCharacterRelationship}
        />
      ) : managedCharacter ? (
        <CharacterEditorPage
          character={managedCharacter}
          memories={managedCharacterMemories}
          onBack={() => setManagedCharacterId(null)}
          onEditAvatar={() => setEditingCharacterId(managedCharacter.id)}
          onUpdate={updateCharacter}
          onAddMemory={(content) => addCharacterMemory(managedCharacter.id, content)}
          onDeleteMemory={deleteMemory}
          onDelete={() => deleteCharacter(managedCharacter.id)}
        />
      ) : isCharacterManagerOpen ? (
        <CharacterManagerPage
          characters={state.characters}
          relationships={state.characterRelationships}
          onBack={() => setIsCharacterManagerOpen(false)}
          onCreate={createManagedCharacter}
          onEdit={setManagedCharacterId}
          onManageRelationships={() => setIsRelationshipsOpen(true)}
        />
      ) : activeConversation ? (
        <ChatView
          state={state}
          conversation={activeConversation}
          close={closeConversation}
          setState={setState}
          isThinking={pendingReplies.some((reply) => reply.conversationId === activeConversation.id)}
          onQueueReply={queueReply}
          onOpenProfile={openCharacterProfile}
          onOpenUserProfile={openUserProfile}
          onEditBackground={() => setEditingBackgroundConversationId(activeConversation.id)}
          onStartGroup={openGroupCreator}
        />
      ) : isUserProfileOpen ? (
        <UserProfilePage
          user={state.user}
          onBack={closeUserProfile}
          onEditAvatar={() => setIsEditingUserAvatar(true)}
          onEditMomentsCover={() => setIsEditingMomentsCover(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUpdateName={updateUserName}
          onUpdateGender={updateUserGender}
        />
      ) : isFavoritesOpen ? (
        <FavoritesPage
          state={state}
          onBack={closeFavoritesPage}
          onOpenConversation={openConversation}
          onDelete={deleteFavorite}
        />
      ) : activeProfileCharacter ? (
        <CharacterProfilePage
          character={activeProfileCharacter}
          moments={state.moments}
          onBack={closeCharacterProfile}
          onMessage={() => openCharacterConversation(activeProfileCharacter.id)}
          onOpenMoments={openMomentsPage}
        />
      ) : isMomentsOpen ? (
        <MomentsTab
          state={state}
          onBack={closeMomentsPage}
          onGenerate={generateNewMoment}
          onPublish={publishMoment}
          onToggleLike={toggleMomentLike}
          onComment={addMomentComment}
          onEditCover={() => setIsEditingMomentsCover(true)}
          generating={isGeneratingMoment}
        />
      ) : activeTool ? (
        <LocalToolPanel
          tool={activeTool}
          onClose={() => setActiveTool(null)}
          onSaveCard={saveToolCard}
          onApplyBackground={applyDefaultChatBackground}
          onCreateRole={createRoleFromTemplate}
        />
      ) : (
        <div className="main-stack" onTouchStart={handleMainTouchStart} onTouchEnd={handleMainTouchEnd}>
          {activeTab !== "me" && (
            <header className={`app-header app-header-${activeTab}`}>
              <div className="title-row">
                <h1>
                  {activeTab === "chats" ? "微信" : activeTab === "contacts" ? "通讯录" : "发现"}
                </h1>
                <div className="header-actions">
                  {activeTab === "chats" && (
                    <button className="icon-button" onClick={() => setIsSearchOpen(true)} title="搜索">
                      <WeIcon name="search" size={24} />
                    </button>
                  )}
                  {activeTab === "chats" && (
                    <button className="icon-button" onClick={() => setIsMainActionsOpen(true)} title="更多功能">
                      <WeIcon name="add" size={24} className="main-header-add" />
                    </button>
                  )}
                  {activeTab === "contacts" && (
                    <button className="icon-button" onClick={() => setIsCharacterManagerOpen(true)} title="添加朋友">
                      <WeIcon name="contact-add" size={24} className="contacts-header-add" />
                    </button>
                  )}
                </div>
              </div>
            </header>
          )}

          <div className="tab-pager">
            <div className="tab-track" style={{ transform: `translate3d(-${activeTabIndex * 100}%, 0, 0)` }}>
              <div className={`tab-slide ${activeTab === "chats" ? "active" : ""}`} aria-hidden={activeTab !== "chats"}>
                <ChatsTab state={state} openConversation={openConversation} />
              </div>
              <div className={`tab-slide ${activeTab === "contacts" ? "active" : ""}`} aria-hidden={activeTab !== "contacts"}>
                <ContactsTab
                  state={state}
                  onOpen={openCharacterProfile}
                  onStartGroup={openGroupCreator}
                />
              </div>
              <div className={`tab-slide ${activeTab === "moments" ? "active" : ""}`} aria-hidden={activeTab !== "moments"}>
                <DiscoverTab
                  onOpenMoments={openMomentsPage}
                  hasUnreadMoments={hasUnreadMoments}
                  unreadMomentAuthor={unreadMomentAuthor}
                />
              </div>
              <div className={`tab-slide ${activeTab === "me" ? "active" : ""}`} aria-hidden={activeTab !== "me"}>
                <MeTab
                  state={state}
                  onOpenProfile={openUserProfile}
                  onOpenWallet={() => setIsWalletOpen(true)}
                  onOpenFavorites={openFavoritesPage}
                  onOpenMoments={openMomentsPage}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              </div>
            </div>
          </div>
          <BottomTabs active={activeTab} setActive={navigateTab} hasUnreadMoments={hasUnreadMoments} />
        </div>
      )}
      {isWalletOpen && <WalletPanel wallet={state.wallet} onBack={() => setIsWalletOpen(false)} />}
      {isSettingsOpen && (
        <SettingsPanel
          state={state}
          setState={setState}
          onClose={() => setIsSettingsOpen(false)}
          onOpenCharacterManager={() => {
            setIsSettingsOpen(false);
            setIsCharacterManagerOpen(true);
          }}
        />
      )}
      {isSearchOpen && (
        <GlobalSearchPanel
          state={state}
          onClose={() => setIsSearchOpen(false)}
          onOpenConversation={openConversation}
          onOpenProfile={openCharacterProfile}
        />
      )}
      {activeBackgroundConversation && (
        <ChatBackgroundEditor
          conversation={activeBackgroundConversation}
          onClose={() => setEditingBackgroundConversationId(null)}
          onSave={updateConversationBackground}
        />
      )}
      {editingCharacterId && (
        <AvatarEditor
          title="设置头像"
          initialUrl={state.characters.find((character) => character.id === editingCharacterId)?.avatarUrl}
          onClose={() => setEditingCharacterId(null)}
          onSave={(avatarUrl) => updateCharacterAvatar(editingCharacterId!, avatarUrl)}
        />
      )}
      {isEditingUserAvatar && (
        <AvatarEditor
          title="设置头像"
          initialUrl={state.user.avatarUrl}
          onClose={() => setIsEditingUserAvatar(false)}
          onSave={updateUserAvatar}
        />
      )}
      {isEditingMomentsCover && (
        <MomentCoverPicker
          onClose={() => setIsEditingMomentsCover(false)}
          onSave={(coverUrl) => {
            updateMomentsCover(coverUrl);
            setIsEditingMomentsCover(false);
          }}
        />
      )}
      {isMainActionsOpen && (
        <MainPlusMenu
          onClose={() => setIsMainActionsOpen(false)}
          actions={[
            { label: "发起群聊", icon: "group", onClick: openGroupCreator },
            { label: "添加朋友", icon: "contact-add", onClick: () => setIsCharacterManagerOpen(true) },
            { label: "收付款", icon: "services", onClick: () => setIsWalletOpen(true) }
          ]}
        />
      )}
      <div className="debug-summary" aria-hidden="true">
        {messageSummary(state.messages).slice(0, 0)}
      </div>
    </div>
  );
}
