import {
  BellOff,
  Bookmark,
  BriefcaseBusiness,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Compass,
  Download,
  Eye,
  Gamepad2,
  Heart,
  Image,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Tags,
  ThumbsUp,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  Users,
  X
} from "lucide-react";
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
import type { AppState, Character, Conversation, MediaAsset, Message, MomentPost, SkillId, TabKey, UserProfile } from "./types";

const localProvider = new LocalPersonaProvider();

const iconSize = 20;
const tabOrder: TabKey[] = ["chats", "contacts", "moments", "me"];

const uiIconAssets = {
  "tab-chat": new URL("../assets/wechat-ui-icons/outlined/my_audit_comment.svg", import.meta.url).href,
  "tab-chat-filled": new URL("../assets/wechat-ui-icons/filled/my_audit_comment.svg", import.meta.url).href,
  "tab-contacts": new URL("../assets/wechat-ui-icons/outlined/my_audit_contacts.svg", import.meta.url).href,
  "tab-contacts-filled": new URL("../assets/wechat-ui-icons/filled/my_audit_contacts.svg", import.meta.url).href,
  "tab-discover": new URL("../assets/wechat-ui-icons/outlined/my_audit_discover.svg", import.meta.url).href,
  "tab-discover-filled": new URL("../assets/wechat-ui-icons/filled/my_audit_discover.svg", import.meta.url).href,
  "tab-me": new URL("../assets/wechat-ui-icons/outlined/my_audit_me.svg", import.meta.url).href,
  "tab-me-filled": new URL("../assets/wechat-ui-icons/filled/my_audit_me.svg", import.meta.url).href,
  "new-friend": new URL("../assets/wechat-ui-icons/filled/my_audit_add_friends.svg", import.meta.url).href,
  group: new URL("../assets/wechat-ui-icons/filled/my_audit_contacts.svg", import.meta.url).href,
  official: new URL("../assets/wechat-ui-icons/weixin-homepage/my_audit_official_account.svg", import.meta.url).href,
  moments: new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_moments_filled.svg", import.meta.url).href,
  channels: new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_channels_finder.svg", import.meta.url).href,
  live: new URL("../assets/wechat-ui-icons/filled/my_audit_channels_tv.svg", import.meta.url).href,
  scan: new URL("../assets/wechat-ui-icons/filled/my_audit_scan_qr_code.svg", import.meta.url).href,
  look: new URL("../assets/wechat-ui-icons/weixin-apk/my_audit_channels_friends_love.svg", import.meta.url).href,
  "search-grid": new URL("../assets/wechat-ui-icons/filled/my_audit_search.svg", import.meta.url).href,
  search: new URL("../assets/wechat-ui-icons/outlined/my_audit_search.svg", import.meta.url).href,
  shop: new URL("../assets/wechat-ui-icons/filled/my_audit_shop.svg", import.meta.url).href,
  game: new URL("../assets/wechat-ui-icons/weixin-homepage/my_audit_mini_game.png", import.meta.url).href,
  mini: new URL("../assets/wechat-ui-icons/weixin-homepage/my_audit_mini_program.png", import.meta.url).href,
  services: new URL("../assets/wechat-ui-icons/filled/my_audit_transfer.svg", import.meta.url).href,
  favorite: new URL("../assets/wechat-ui-icons/filled/my_audit_like.svg", import.meta.url).href,
  card: new URL("../assets/wechat-ui-icons/filled/my_audit_transfer.svg", import.meta.url).href,
  sticker: new URL("../assets/wechat-ui-icons/filled/my_audit_sticker.svg", import.meta.url).href,
  camera: new URL("../assets/wechat-ui-icons/filled/my_audit_camera.svg", import.meta.url).href,
  more: new URL("../assets/wechat-ui-icons/filled/my_audit_more.svg", import.meta.url).href,
  comment: new URL("../assets/wechat-ui-icons/filled/my_audit_comment.svg", import.meta.url).href,
  like: new URL("../assets/wechat-ui-icons/filled/my_audit_like.svg", import.meta.url).href,
  share: new URL("../assets/wechat-ui-icons/filled/my_audit_share.svg", import.meta.url).href
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

const fallbackMomentImages = [
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=640&q=80"
];

const fallbackMomentImage = (id: string) => {
  const index = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % fallbackMomentImages.length;
  return fallbackMomentImages[index];
};

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

function AiBadge() {
  return null;
}

function WeIcon({
  name,
  tone,
  active = false,
  className = ""
}: {
  name: string;
  tone?: string;
  active?: boolean;
  className?: string;
}) {
  const activeName = `${name}-filled` as keyof typeof uiIconAssets;
  const asset = uiIconAssets[active ? activeName : (name as keyof typeof uiIconAssets)] || uiIconAssets[name as keyof typeof uiIconAssets];
  const style = asset ? ({ "--we-icon-url": `url("${asset}")` } as CSSProperties) : undefined;
  return (
    <span
      className={`wechat-icon ${asset ? "wechat-icon-asset" : `wechat-icon-${name}`} ${tone ? `wechat-icon-${tone}` : ""} ${className}`}
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
          <Search size={17} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" />
          {query && (
            <button type="button" onClick={() => setQuery("")}>
              <X size={15} />
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

function ImageSearchPanel({
  initialQuery,
  onPick
}: {
  initialQuery: string;
  onPick: (asset: MediaAsset) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickingId, setPickingId] = useState("");

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    try {
      setResults(await searchImages(query, 12));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const pick = async (asset: MediaAsset) => {
    setPickingId(asset.id);
    onPick(await cacheImageAsset(asset));
    setPickingId("");
  };

  return (
    <div className="image-search-panel">
      <form className="image-search-row" onSubmit={runSearch}>
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索图片" />
        <button type="submit" disabled={loading}>
          {loading ? <Loader2 size={17} /> : "搜索"}
        </button>
      </form>
      {results.length > 0 && (
        <div className="image-results">
          {results.map((asset) => (
            <button type="button" key={asset.id} onClick={() => pick(asset)} title={asset.title || "图片"}>
              {pickingId === asset.id ? <Loader2 className="spin" size={18} /> : <img src={asset.thumbUrl || asset.url} alt="" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AvatarEditor({
  title,
  initialUrl,
  searchHint,
  filePrefix = "avatar",
  onClose,
  onSave
}: {
  title: string;
  initialUrl?: string;
  searchHint: string;
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
    <div className="modal-backdrop">
      <div className="modal-panel avatar-panel">
        <button type="button" className="icon-button modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <h2>{title}</h2>
        <div className="avatar-preview">
          {url ? <img src={url} alt="" /> : <Image size={28} />}
        </div>
        <label className="file-row">
          <Upload size={18} />
          从手机相册选择
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>
        <ImageSearchPanel
          initialQuery={searchHint}
          onPick={(asset) => {
            setUrl(asset.url);
            onSave(asset.url);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

function ChatsTab({
  state,
  openConversation
}: {
  state: AppState;
  openConversation: (conversationId: string) => void;
}) {
  const sorted = [...state.conversations].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  return (
    <section className="screen-body list-body">
      <div className="search-row">
        <Search size={17} />
        <span>搜索</span>
      </div>
      {sorted.map((conversation) => {
        const character = state.characters.find((item) => item.id === conversation.characterId)!;
        const lastMessage = [...state.messages]
          .reverse()
          .find((message) => message.conversationId === conversation.id && message.senderType !== "system");
        return (
          <button className="chat-row" key={conversation.id} onClick={() => openConversation(conversation.id)}>
            <Avatar character={character} />
            <div className="row-main">
              <div className="row-title-line">
                <span className="row-title">{conversation.title}</span>
                <span className="row-time">{formatTime(conversation.lastMessageAt)}</span>
              </div>
              <div className="row-sub-line">
                <span className="row-preview">{messagePreview(lastMessage)}</span>
                <span className="row-icons">
                  {conversation.pinned && <Pin size={13} />}
                  {conversation.muted && <BellOff size={13} />}
                  {conversation.unreadCount > 0 && <span className="unread-dot">{conversation.unreadCount}</span>}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}

function ContactsTab({
  state,
  onOpen,
  onAddCharacter,
  addRequest,
  isActive
}: {
  state: AppState;
  onOpen: (characterId: string) => void;
  onAddCharacter: (character: Character) => void;
  addRequest: number;
  isActive: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("自定义朋友");

  useEffect(() => {
    if (addRequest > 0) setIsAdding(true);
  }, [addRequest]);

  useEffect(() => {
    if (!isActive) setIsAdding(false);
  }, [isActive]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const character: Character = {
      ...seedCharacters[0],
      id: createId("c_custom"),
      displayName: trimmed,
      remarkName: trimmed,
      initials: trimmed.slice(0, 1),
      avatarColor: ["#18b97b", "#4e8df5", "#f06f54", "#8b6be8", "#d59d2a"][state.characters.length % 5],
      avatarUrl: `https://i.pravatar.cc/300?u=${encodeURIComponent(trimmed)}`,
      roleType: role.trim() || "自定义朋友",
      gender: "unknown",
      region: "未设置",
      occupation: role.trim() || "自定义朋友",
      signature: "这个人很神秘，什么都没有留下。",
      tags: ["自定义"],
      album: [
        { id: createId("album"), type: "image", url: `https://picsum.photos/seed/${encodeURIComponent(trimmed)}-1/480/480` },
        { id: createId("album"), type: "image", url: `https://picsum.photos/seed/${encodeURIComponent(trimmed)}-2/480/480` },
        { id: createId("album"), type: "image", url: `https://picsum.photos/seed/${encodeURIComponent(trimmed)}-3/480/480` }
      ],
      background: `${trimmed} 是用户自定义的联系人。`,
      skillPrompt: "",
      skillIds: ["memory_callback", "playful_combo"],
      proactivePolicy: { ...seedCharacters[0].proactivePolicy },
      momentsPolicy: { ...seedCharacters[0].momentsPolicy }
    };
    onAddCharacter(character);
    setName("");
    setRole("自定义朋友");
    setIsAdding(false);
  };

  return (
    <section className="screen-body list-body">
      <button className="utility-row" onClick={() => setIsAdding(true)}>
        <WeIcon name="new-friend" tone="green" />
        <span>新的朋友</span>
      </button>
      <div className="utility-row static">
        <WeIcon name="group" tone="blue" />
        <span>群聊</span>
      </div>
      <div className="utility-row static">
        <WeIcon name="tag" tone="yellow" />
        <span>标签</span>
      </div>
      <div className="utility-row static">
        <WeIcon name="official" tone="teal" />
        <span>公众号</span>
      </div>
      <div className="section-label">联系人</div>
      {state.characters.map((character) => (
        <button className="contact-row contact-open-row" key={character.id} onClick={() => onOpen(character.id)}>
          <Avatar character={character} size="sm" />
          <div>
            <div className="contact-name">
              {character.remarkName}
              <AiBadge />
            </div>
            <div className="contact-role">{character.signature || character.roleType}</div>
          </div>
        </button>
      ))}
      <div className="contact-index" aria-hidden="true">↑ ABCDEFGHIJKLMNOPQRSTUVWXYZ#</div>

      {isAdding && (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submit}>
            <button type="button" className="icon-button modal-close" onClick={() => setIsAdding(false)}>
              <X size={18} />
            </button>
            <h2>新的朋友</h2>
            <label>
              昵称
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={12} autoFocus />
            </label>
            <label>
              角色类型
              <input value={role} onChange={(event) => setRole(event.target.value)} maxLength={24} />
            </label>
            <button className="primary-button" type="submit">
              保存
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function MomentComposer({
  onClose,
  onPublish
}: {
  onClose: () => void;
  onPublish: (content: string, media: MediaAsset[]) => void;
}) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaAsset[]>([]);

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

  return (
    <div className="modal-backdrop">
      <div className="modal-panel moment-compose-panel">
        <button type="button" className="icon-button modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <h2>发朋友圈</h2>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="这一刻的想法..." />
        {media.length > 0 && (
          <div className="compose-media-grid">
            {media.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setMedia((prev) => prev.filter((mediaItem) => mediaItem.id !== item.id))}
              >
                <img src={item.url} alt="" />
                <X size={15} />
              </button>
            ))}
          </div>
        )}
        <label className="file-row">
          <Upload size={18} />
          从手机相册选择
          <input type="file" accept="image/*" multiple onChange={handleFile} />
        </label>
        <ImageSearchPanel
          initialQuery={content || "生活 风景"}
          onPick={(asset) => setMedia((prev) => [...prev, asset].slice(0, 9))}
        />
        <button className="primary-button" type="button" onClick={publish} disabled={!content.trim() && media.length === 0}>
          发布
        </button>
      </div>
    </div>
  );
}

function DiscoverTab({ onOpenMoments }: { onOpenMoments: () => void }) {
  const rows = [
    { label: "朋友圈", icon: "moments", tone: "blue", onClick: onOpenMoments },
    { label: "视频号", icon: "channels", tone: "orange" },
    { label: "直播", icon: "live", tone: "orange" },
    { label: "扫一扫", icon: "scan", tone: "green", gap: true },
    { label: "看一看", icon: "look", tone: "yellow" },
    { label: "搜一搜", icon: "search-grid", tone: "teal" },
    { label: "小程序", icon: "mini", tone: "green", gap: true }
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
          <WeIcon name={row.icon} tone={row.tone} />
          <span>{row.label}</span>
          <ChevronRight size={18} />
        </button>
      ))}
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
  const [coverScrolled, setCoverScrolled] = useState(false);
  const posts = [...state.moments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <section className="moments-page">
      <header className={`moments-nav ${coverScrolled ? "is-scrolled" : ""}`}>
        <button className="icon-button" onClick={onBack}>
          <ChevronLeft size={22} />
        </button>
        <div className="moments-nav-title">朋友圈</div>
        <button className="icon-button" onClick={() => setIsComposing(true)} onDoubleClick={onGenerate} disabled={generating}>
          <WeIcon name="camera" />
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
            onClick={onEditCover}
            title="更换朋友圈背景"
            style={state.settings.momentsCoverUrl ? { backgroundImage: `url("${state.settings.momentsCoverUrl.replace(/"/g, "%22")}")` } : undefined}
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
        {isComposing && <MomentComposer onClose={() => setIsComposing(false)} onPublish={onPublish} />}
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
  onBack,
  onMessage,
  onEditAvatar,
  onUpdate
}: {
  character: Character;
  onBack: () => void;
  onMessage: () => void;
  onEditAvatar: () => void;
  onUpdate: (character: Character) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const updateField = (field: keyof Character, value: string) => {
    onUpdate({ ...character, [field]: value });
  };

  const updatePersonality = (key: keyof Character["personality"], value: number) => {
    onUpdate({ ...character, personality: { ...character.personality, [key]: value } });
  };

  return (
    <section className="profile-page">
      <header className="chat-header profile-header">
        <button className="icon-button" onClick={onBack}>
          <ChevronLeft size={22} />
        </button>
        <div className="chat-title">详细资料</div>
        <button className="icon-button" onClick={() => setShowActions(true)} title="更多">
          <MoreHorizontal size={22} />
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
            <Image size={18} />
            朋友圈
            <ChevronRight size={18} />
          </div>
          <div className="album-strip">
            {(character.album || []).slice(0, 4).map((item) => (
              <img key={item.id} src={item.url} alt="" />
            ))}
          </div>
        </section>

        <section className="wechat-card">
          <div className="profile-card-title">
            <Tags size={18} />
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
            <BriefcaseBusiness size={18} />
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
            <span>专属 Skill</span>
            <textarea
              value={character.skillPrompt || ""}
              onChange={(event) => onUpdate({ ...character, skillPrompt: event.target.value })}
              placeholder="只对这个联系人生效的说话方式、能力和边界"
              rows={4}
            />
          </label>
          <div className="profile-skill-row">
            <span>专属 Skills</span>
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
            <SlidersHorizontal size={18} />
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

        <button className="profile-message-button" onClick={onMessage}>
          <MessageCircle size={19} />
          发消息
        </button>
      </div>
      {showActions && (
        <ActionSheet
          title={character.remarkName}
          onClose={() => setShowActions(false)}
          actions={[
            { label: "设置头像", icon: <Image size={18} />, onClick: onEditAvatar },
            { label: "发消息", icon: <MessageCircle size={18} />, onClick: onMessage },
            {
              label: character.enabled ? "停用联系人" : "启用联系人",
              icon: character.enabled ? <Trash2 size={18} /> : <RefreshCw size={18} />,
              danger: character.enabled,
              onClick: () => onUpdate({ ...character, enabled: !character.enabled })
            }
          ]}
        />
      )}
    </section>
  );
}

function MeTab({
  state,
  onOpenProfile,
  onOpenWallet,
  onOpenSettings
}: {
  state: AppState;
  onOpenProfile: () => void;
  onOpenWallet: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <section className="screen-body me-body">
      <button type="button" className="profile-row me-profile-row" onClick={onOpenProfile} title="个人信息">
        <span className="profile-avatar-button">
          <UserAvatar user={state.user} size="lg" />
        </span>
        <div>
          <div className="profile-name">{state.user.displayName}</div>
          <div className="profile-sub">微信号：qinghe</div>
        </div>
        <QrCode className="profile-qr-icon" size={19} />
        <ChevronRight className="profile-edit-icon" size={18} />
      </button>

      <div className="settings-block me-list-block">
        <button className="setting-row" type="button" onClick={onOpenWallet}>
          <WeIcon name="services" tone="green" />
          服务
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="settings-block me-list-block">
        <button className="setting-row">
          <WeIcon name="favorite" tone="orange" />
          收藏
          <ChevronRight size={18} />
        </button>
        <button className="setting-row">
          <WeIcon name="moments" tone="blue" />
          朋友圈
          <ChevronRight size={18} />
        </button>
        <button className="setting-row">
          <WeIcon name="card" tone="green" />
          卡包
          <ChevronRight size={18} />
        </button>
        <button className="setting-row">
          <WeIcon name="sticker" tone="yellow" />
          表情
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="settings-block me-list-block">
        <button
          className="setting-row"
          onClick={onOpenSettings}
        >
          <WeIcon name="settings" tone="gray" />
          设置
          <ChevronRight size={18} />
        </button>
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
          <ChevronLeft size={22} />
        </button>
        <div className="chat-title">服务</div>
        <button className="icon-button" type="button" title="更多">
          <MoreHorizontal size={22} />
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
  onUpdateName
}: {
  user: UserProfile;
  onBack: () => void;
  onEditAvatar: () => void;
  onEditMomentsCover: () => void;
  onOpenSettings: () => void;
  onUpdateName: (name: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <section className="profile-page">
      <header className="chat-header profile-header">
        <button className="icon-button" onClick={onBack}>
          <ChevronLeft size={22} />
        </button>
        <div className="chat-title">个人信息</div>
        <button className="icon-button" onClick={() => setShowActions(true)} title="更多">
          <MoreHorizontal size={22} />
        </button>
      </header>

      <div className="profile-scroll">
        <section className="wechat-card self-info-card">
          <button type="button" className="profile-edit-row self-avatar-row" onClick={onEditAvatar}>
            <span>头像</span>
            <UserAvatar user={user} size="lg" />
            <ChevronRight size={18} />
          </button>
          <label className="profile-edit-row">
            <span>名字</span>
            <input value={user.displayName} onChange={(event) => onUpdateName(event.target.value || "我")} />
          </label>
          <div className="profile-edit-row static-row">
            <span>微信号</span>
            <b>qinghe</b>
          </div>
          <div className="profile-edit-row static-row">
            <span>二维码名片</span>
            <QrCode size={19} />
            <ChevronRight size={18} />
          </div>
        </section>
      </div>
      {showActions && (
        <ActionSheet
          title="个人信息"
          onClose={() => setShowActions(false)}
          actions={[
            { label: "更换头像", icon: <Image size={18} />, onClick: onEditAvatar },
            { label: "朋友圈背景", icon: <Camera size={18} />, onClick: onEditMomentsCover },
            { label: "设置", icon: <SlidersHorizontal size={18} />, onClick: onOpenSettings }
          ]}
        />
      )}
    </section>
  );
}

function SettingsPanel({
  state,
  setState,
  onClose
}: {
  state: AppState;
  setState: (updater: AppState | ((prev: AppState) => AppState)) => void;
  onClose: () => void;
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
          <X size={18} />
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

        <section className="settings-section">
          <h3>模型接口</h3>
          <div className="settings-toggle-row">
            <button
              type="button"
              className={state.settings.providerMode === "openai_compatible" ? "active" : ""}
              onClick={() => updateSetting("providerMode", "openai_compatible")}
            >
              远程模型
            </button>
            <button
              type="button"
              className={state.settings.providerMode === "local_mock" ? "active" : ""}
              onClick={() => updateSetting("providerMode", "local_mock")}
            >
              本地模拟
            </button>
          </div>
          <div className="settings-help">
            远程模型会使用你填写的云雾 API 和模型，聊天与生图都走真实接口；本地模拟只用手机里的固定模板回复，适合没填 API 时测试界面。
          </div>
          <label>
            <span>API Key</span>
            <input
              type="password"
              value={state.settings.apiKey}
              onChange={(event) => updateSetting("apiKey", event.target.value)}
              placeholder="在手机本地保存，不会打进 APK"
            />
          </label>
          <label>
            <span>Base URL</span>
            <input
              value={state.settings.apiBaseUrl}
              onChange={(event) => updateSetting("apiBaseUrl", event.target.value)}
              placeholder="https://yunwu.ai/v1"
            />
          </label>
          <label>
            <span>文字模型</span>
            <input
              list="api-text-model-options"
              value={state.settings.apiTextModel || state.settings.apiModel}
              onChange={(event) => {
                updateSetting("apiTextModel", event.target.value);
                updateSetting("apiModel", event.target.value);
              }}
              placeholder="grok-4.3"
            />
            <datalist id="api-text-model-options">
              <option value="grok-4.3" />
              <option value="grok-4" />
              <option value="grok-3" />
              <option value="grok-3-mini" />
              <option value="deepseek-chat" />
            </datalist>
          </label>
          <label>
            <span>生图模型</span>
            <input
              list="api-image-model-options"
              value={state.settings.apiImageModel}
              onChange={(event) => updateSetting("apiImageModel", event.target.value)}
              placeholder="grok-imagine-image-quality"
            />
            <datalist id="api-image-model-options">
              <option value="grok-imagine-image-quality" />
              <option value="grok-2-image" />
            </datalist>
          </label>
          <label>
            <span>图片规格</span>
            <input
              list="api-image-size-options"
              value={state.settings.apiImageSize}
              onChange={(event) => updateSetting("apiImageSize", event.target.value)}
              placeholder="1k"
            />
            <datalist id="api-image-size-options">
              <option value="1k" />
              <option value="2k" />
              <option value="1024x1024" />
              <option value="1792x1024" />
              <option value="1024x1792" />
            </datalist>
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
            <Upload size={18} />
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
            <Upload size={18} />
            恢复完整本机数据
            <input type="file" accept="application/json,.json" onChange={importFullBackup} />
          </label>
        </section>
      </div>
    </div>
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
    <div className="modal-backdrop">
      <div className="modal-panel avatar-panel">
        <button type="button" className="icon-button modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <h2>设置聊天背景</h2>
        <div className="chat-background-preview">
          {previewUrl ? <img src={previewUrl} alt="" /> : <span>默认背景</span>}
        </div>
        <label className="file-row">
          <Upload size={18} />
          从手机相册选择
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>
        <ImageSearchPanel
          initialQuery={`${conversation.title} 聊天背景 壁纸`}
          onPick={(asset) => save(asset.url)}
        />
        {previewUrl && (
          <button type="button" className="secondary-button" onClick={() => save("")}>
            使用默认背景
          </button>
        )}
      </div>
    </div>
  );
}

function ChatView({
  state,
  conversation,
  close,
  setState,
  onOpenProfile,
  onOpenUserProfile,
  onEditBackground
}: {
  state: AppState;
  conversation: Conversation;
  close: () => void;
  setState: (updater: AppState | ((prev: AppState) => AppState)) => void;
  onOpenProfile: (characterId: string) => void;
  onOpenUserProfile: () => void;
  onEditBackground: () => void;
}) {
  const [text, setText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showRedPacketPanel, setShowRedPacketPanel] = useState(false);
  const [redPacketAmount, setRedPacketAmount] = useState("88");
  const [redPacketBlessing, setRedPacketBlessing] = useState("恭喜发财，大吉大利");
  const [showChatActions, setShowChatActions] = useState(false);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const character = state.characters.find((item) => item.id === conversation.characterId)!;
  const messages = state.messages.filter((message) => message.conversationId === conversation.id);
  const memorySummary = state.memories
    .slice(0, 4)
    .map((memory) => memory.content)
    .join("\n");

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      const element = messageListRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.id, messages.length, isThinking, showImagePicker, showStickers, showMoreActions, showRedPacketPanel]);

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
    setShowImagePicker(false);
    setShowMoreActions(false);
    setShowRedPacketPanel(false);
  };

  const sendRedPacket = (event?: FormEvent) => {
    event?.preventDefault();
    const amount = Math.max(0, Math.round(Number(redPacketAmount)));
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
    setRedPacketAmount("88");
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
        content: thanks[Math.abs(character.id.length + amount) % thanks.length],
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

  const clearConversationMessages = () => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((message) => message.conversationId !== conversation.id || message.senderType === "system")
    }));
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = text.trim();
    if (!content || isThinking) return;

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
    setIsThinking(true);
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

    const activeProvider =
      state.settings.providerMode === "openai_compatible" && hasConfiguredProvider(state.settings)
        ? makeConfiguredProvider(state.settings)
        : localProvider;

    let result = await activeProvider
      .chat({
        character,
        userMessage: content,
        recentMessages: messages.slice(-12),
        memorySummary,
        globalSkillPrompt: state.settings.globalSkillPrompt,
        globalSkillIds: []
      })
      .catch(async () => {
        const fallback = await localProvider.chat({
          character,
          userMessage: content,
          recentMessages: messages.slice(-12),
          memorySummary,
          globalSkillPrompt: state.settings.globalSkillPrompt,
          globalSkillIds: []
        });
        return { ...fallback, modelName: "local-fallback-v1" };
      });

    window.setTimeout(async () => {
      const aiMessage: Message = {
        id: createId("msg"),
        conversationId: conversation.id,
        senderType: "ai",
        senderCharacterId: character.id,
        contentType: "text",
        content: result.content,
        aiGenerated: true,
        riskLevel: result.riskLevel,
        createdAt: new Date().toISOString(),
        modelName: result.modelName
      };
      const outgoing: Message[] = [aiMessage];
      const redPacketCue = /红包|钱|奖励|打赏|恭喜|生日|开心|加油|辛苦|难过|安慰|哄我|鼓励/.test(`${content} ${result.content}`);
      const redPacketEnabled =
        hasSkill(character, [], "red_packet") ||
        hasSkill(character, [], "playful_combo");
      if (result.riskLevel !== "L3" && result.riskLevel !== "L4" && (redPacketCue || (redPacketEnabled && /加油|辛苦|难过|开心|恭喜|生日/.test(content)))) {
        const amount = pickRedPacketAmount(`${character.id}${content}${outgoing.length}`);
        outgoing.push({
          id: createId("msg"),
          conversationId: conversation.id,
          senderType: "ai",
          senderCharacterId: character.id,
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

      if (shouldAttachImageFromText(content) && result.riskLevel !== "L3" && result.riskLevel !== "L4") {
        const imagePrompt = imageQueryFromText(content, character);
        const generated = await generateImageAsset(state.settings, imagePrompt).catch(() => null);
        const images = generated ? [] : await searchImages(imagePrompt, 8).catch(() => []);
        const asset = generated || (images[0] ? await cacheImageAsset(images[0]) : undefined);
        if (asset) {
          outgoing.push({
            id: createId("msg"),
            conversationId: conversation.id,
            senderType: "ai",
            senderCharacterId: character.id,
            contentType: "image",
            content: asset.title || imagePrompt || "图片",
            media: asset,
            aiGenerated: true,
            riskLevel: "L0",
            createdAt: new Date().toISOString(),
            modelName: generated ? state.settings.apiImageModel || "image-generation" : "image-search"
          });
        }
      }

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, ...outgoing],
        conversations: prev.conversations.map((item) =>
          item.id === conversation.id
            ? { ...item, lastMessageAt: outgoing[outgoing.length - 1].createdAt, unreadCount: 0 }
            : item
        ),
        auditEvents:
          result.riskLevel === "L3" || result.riskLevel === "L4"
            ? [
                {
                  id: createId("audit"),
                  eventType: "risk",
                  riskLevel: result.riskLevel,
                  summary: `${character.remarkName} 对话触发 ${result.riskLevel} 安全模式。`,
                  evidenceMessageIds: [userMessage.id, aiMessage.id],
                  createdAt: aiMessage.createdAt
                },
                ...prev.auditEvents
              ]
            : prev.auditEvents
      }));
      setIsThinking(false);
    }, 520);
  };

  const chatBackgroundUrl = (conversation.chatBackgroundUrl || "").trim();
  const chatBackgroundStyle = chatBackgroundUrl
    ? { backgroundImage: `url("${chatBackgroundUrl.replace(/"/g, "%22")}")` }
    : undefined;
  const drawerOpen = showStickers || showImagePicker || showMoreActions || showRedPacketPanel;

  return (
    <section className={`chat-view ${drawerOpen ? "has-open-drawer" : ""}`}>
      <header className="chat-header">
        <button className="icon-button" onClick={close}>
          <ChevronLeft size={22} />
        </button>
        <div>
          <div className="chat-title">
            {conversation.title}
            <AiBadge />
          </div>
        </div>
        <button className="icon-button" onClick={() => setShowChatActions(true)} title="聊天信息">
          <MoreHorizontal size={22} />
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
          return (
            <div className={`message-row ${mine ? "mine" : ""} ${system ? "system" : ""}`} key={message.id}>
              {!mine && !system && (
                <button type="button" className="avatar-button" onClick={() => onOpenProfile(character.id)} title="查看资料">
                  <Avatar character={character} size="sm" />
                </button>
              )}
              <div
                className={`bubble bubble-${message.contentType} ${
                  message.riskLevel === "L3" || message.riskLevel === "L4" ? "risk" : ""
                }`}
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
              {mine && !system && (
                <button type="button" className="avatar-button" onClick={onOpenUserProfile} title="个人信息">
                  <UserAvatar user={state.user} size="sm" />
                </button>
              )}
            </div>
          );
        })}
        {isThinking && (
          <div className="message-row">
            <Avatar character={character} size="sm" />
            <div className="bubble typing">正在输入...</div>
          </div>
        )}
      </div>

      <form className="composer" onSubmit={sendMessage}>
        <button type="button" className="tool-button" title="语音">
          <Mic size={iconSize} />
        </button>
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (event.target.value.trim()) {
              setShowStickers(false);
              setShowImagePicker(false);
              setShowMoreActions(false);
              setShowRedPacketPanel(false);
            }
          }}
          onFocus={() => {
            setShowStickers(false);
            setShowImagePicker(false);
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
            setShowImagePicker(false);
            setShowMoreActions(false);
            setShowRedPacketPanel(false);
          }}
          title="表情"
        >
          <Smile size={iconSize} />
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
              setShowImagePicker(false);
              setShowStickers(false);
              setShowRedPacketPanel(false);
            }}
            title="更多"
          >
            <Plus size={iconSize} />
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

      {showImagePicker && (
        <div className="chat-drawer image-drawer">
          <label className="file-row compact">
            <Upload size={18} />
            从手机相册选择
            <input type="file" accept="image/*" onChange={handleChatImageFile} />
          </label>
          <ImageSearchPanel
            initialQuery={imageQueryFromText(text, character)}
            onPick={(asset) => sendMediaMessage(asset, "image")}
          />
        </div>
      )}

      {showMoreActions && (
        <div className="chat-drawer more-drawer">
          <button
            type="button"
            onClick={() => {
              setShowImagePicker(true);
              setShowStickers(false);
              setShowRedPacketPanel(false);
              setShowMoreActions(false);
            }}
          >
            <span><Image size={24} /></span>
            <b>照片</b>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowRedPacketPanel(true);
              setShowImagePicker(false);
              setShowStickers(false);
              setShowMoreActions(false);
            }}
          >
            <span className="red-action-icon">¥</span>
            <b>红包</b>
          </button>
          <button type="button" onClick={() => setShowStickers(true)}>
            <span><Smile size={24} /></span>
            <b>表情</b>
          </button>
        </div>
      )}

      {showRedPacketPanel && (
        <form className="chat-drawer red-packet-panel" onSubmit={sendRedPacket}>
          <div className="red-packet-panel-title">
            <b>红包</b>
            <span>余额 {formatMoney(state.wallet.balance)}</span>
          </div>
          <label className="red-packet-field">
            <span>单个金额</span>
            <div className="red-packet-money-input">
              <input
                type="number"
                min="1"
                max={state.wallet.balance}
                value={redPacketAmount}
                onChange={(event) => setRedPacketAmount(event.target.value)}
              />
              <b>元</b>
            </div>
          </label>
          <label className="red-packet-field">
            <span>留言</span>
            <input
              value={redPacketBlessing}
              maxLength={24}
              onChange={(event) => setRedPacketBlessing(event.target.value)}
            />
          </label>
          <div className="red-packet-amount-preview">{formatMoney(Number(redPacketAmount) || 0)}</div>
          <button type="submit" disabled={!Number(redPacketAmount) || Number(redPacketAmount) > state.wallet.balance}>
            塞钱进红包
          </button>
        </form>
      )}
      {showChatActions && (
        <ActionSheet
          title={conversation.title}
          onClose={() => setShowChatActions(false)}
          actions={[
            { label: "查看资料", icon: <UserRound size={18} />, onClick: () => onOpenProfile(character.id) },
            { label: conversation.pinned ? "取消置顶" : "置顶聊天", icon: <Pin size={18} />, onClick: togglePinned },
            { label: conversation.muted ? "关闭免打扰" : "消息免打扰", icon: <BellOff size={18} />, onClick: toggleMuted },
            { label: "设置聊天背景", icon: <Image size={18} />, onClick: onEditBackground },
            { label: "清空聊天记录", icon: <Trash2 size={18} />, danger: true, onClick: clearConversationMessages }
          ]}
        />
      )}
    </section>
  );
}

function BottomTabs({ active, setActive }: { active: TabKey; setActive: (tab: TabKey) => void }) {
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
          <WeIcon name={tab.icon} active={active === tab.key} />
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
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [isEditingUserAvatar, setIsEditingUserAvatar] = useState(false);
  const [isEditingMomentsCover, setIsEditingMomentsCover] = useState(false);
  const [editingBackgroundConversationId, setEditingBackgroundConversationId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGeneratingMoment, setIsGeneratingMoment] = useState(false);
  const [isMainActionsOpen, setIsMainActionsOpen] = useState(false);
  const [addFriendRequest, setAddFriendRequest] = useState(0);
  const historyReady = useRef(false);
  const mainSwipeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    setActiveTab("chats");
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setIsUserProfileOpen(false);
    setIsMomentsOpen(false);
    setState((prev) => ({ ...prev, user: { ...prev.user, lastActiveAt: new Date().toISOString() } }));
    void checkForInternalUpdate();
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
      } else {
        setActiveConversationId(null);
        setActiveProfileCharacterId(null);
        setIsUserProfileOpen(false);
        setIsMomentsOpen(false);
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
      if (activeConversationId || activeProfileCharacterId || isUserProfileOpen || isMomentsOpen) {
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
    editingBackgroundConversationId,
    editingCharacterId,
    isEditingUserAvatar,
    isEditingMomentsCover,
    isMainActionsOpen,
    isMomentsOpen,
    isSearchOpen,
    isSettingsOpen,
    isWalletOpen,
    isUserProfileOpen
  ]);

  const activeConversation = useMemo(
    () => state.conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, state.conversations]
  );

  const activeProfileCharacter = useMemo(
    () => state.characters.find((character) => character.id === activeProfileCharacterId),
    [activeProfileCharacterId, state.characters]
  );

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
      !isMomentsOpen
    ) {
      return;
    }
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setIsUserProfileOpen(false);
    setIsMomentsOpen(false);
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

  const openMomentsPage = () => {
    setIsMomentsOpen(true);
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setIsUserProfileOpen(false);
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
      setActiveTab("chats");
      window.history.pushState(
        { app: "weichat", tab: "chats", conversationId: existing.id, profileCharacterId: null, userProfileOpen: false, momentsOpen: false },
        ""
      );
    }
  };

  const addCharacter = (character: Character) => {
    const conversation: Conversation = {
      id: `conv_${character.id}`,
      characterId: character.id,
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
      conversations: [...prev.conversations, conversation],
      messages: [...prev.messages, systemMessage]
    }));
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
        conversation.characterId === nextCharacter.id
          ? { ...conversation, title: nextCharacter.remarkName || nextCharacter.displayName }
          : conversation
      )
    }));
  };

  const updateUserAvatar = (avatarUrl: string) => {
    setState((prev) => ({ ...prev, user: { ...prev.user, avatarUrl } }));
  };

  const updateUserName = (displayName: string) => {
    setState((prev) => ({ ...prev, user: { ...prev.user, displayName: displayName || "我" } }));
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
    const generated = await generateImageAsset(state.settings, imagePrompt).catch(() => null);
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

  const activeTabIndex = Math.max(0, tabOrder.indexOf(activeTab));

  return (
    <div className="app-shell">
      {activeConversation ? (
        <ChatView
          state={state}
          conversation={activeConversation}
          close={closeConversation}
          setState={setState}
          onOpenProfile={openCharacterProfile}
          onOpenUserProfile={openUserProfile}
          onEditBackground={() => setEditingBackgroundConversationId(activeConversation.id)}
        />
      ) : isUserProfileOpen ? (
        <UserProfilePage
          user={state.user}
          onBack={closeUserProfile}
          onEditAvatar={() => setIsEditingUserAvatar(true)}
          onEditMomentsCover={() => setIsEditingMomentsCover(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUpdateName={updateUserName}
        />
      ) : activeProfileCharacter ? (
        <CharacterProfilePage
          character={activeProfileCharacter}
          onBack={closeCharacterProfile}
          onMessage={() => openCharacterConversation(activeProfileCharacter.id)}
          onEditAvatar={() => setEditingCharacterId(activeProfileCharacter.id)}
          onUpdate={updateCharacter}
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
      ) : (
        <div className="main-stack" onTouchStart={handleMainTouchStart} onTouchEnd={handleMainTouchEnd}>
          <header className="app-header">
            <div className="title-row">
              <h1>
                {activeTab === "chats"
                  ? "微信"
                  : activeTab === "contacts"
                    ? "通讯录"
                    : activeTab === "moments"
                      ? "发现"
                      : "我"}
              </h1>
              <div className="header-actions">
                {activeTab !== "me" && (
                  <button className="icon-button" onClick={() => setIsSearchOpen(true)} title="搜索">
                    <WeIcon name="search" />
                  </button>
                )}
                {activeTab !== "me" && (
                  <button className="icon-button" onClick={() => setIsMainActionsOpen(true)} title="更多功能">
                    <Plus size={20} />
                  </button>
                )}
              </div>
            </div>
          </header>

          <div className="tab-pager">
            <div className="tab-track" style={{ transform: `translate3d(-${activeTabIndex * 100}%, 0, 0)` }}>
              <div className={`tab-slide ${activeTab === "chats" ? "active" : ""}`} aria-hidden={activeTab !== "chats"}>
                <ChatsTab state={state} openConversation={openConversation} />
              </div>
              <div className={`tab-slide ${activeTab === "contacts" ? "active" : ""}`} aria-hidden={activeTab !== "contacts"}>
                <ContactsTab
                  state={state}
                  onOpen={openCharacterProfile}
                  onAddCharacter={addCharacter}
                  addRequest={addFriendRequest}
                  isActive={activeTab === "contacts"}
                />
              </div>
              <div className={`tab-slide ${activeTab === "moments" ? "active" : ""}`} aria-hidden={activeTab !== "moments"}>
                <DiscoverTab onOpenMoments={openMomentsPage} />
              </div>
              <div className={`tab-slide ${activeTab === "me" ? "active" : ""}`} aria-hidden={activeTab !== "me"}>
                <MeTab
                  state={state}
                  onOpenProfile={openUserProfile}
                  onOpenWallet={() => setIsWalletOpen(true)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              </div>
            </div>
          </div>
          <BottomTabs active={activeTab} setActive={navigateTab} />
        </div>
      )}
      {isWalletOpen && <WalletPanel wallet={state.wallet} onBack={() => setIsWalletOpen(false)} />}
      {isSettingsOpen && <SettingsPanel state={state} setState={setState} onClose={() => setIsSettingsOpen(false)} />}
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
          searchHint={state.characters.find((character) => character.id === editingCharacterId)?.remarkName || "头像"}
          onClose={() => setEditingCharacterId(null)}
          onSave={(avatarUrl) => updateCharacterAvatar(editingCharacterId!, avatarUrl)}
        />
      )}
      {isEditingUserAvatar && (
        <AvatarEditor
          title="设置头像"
          initialUrl={state.user.avatarUrl}
          searchHint={`${state.user.displayName} 头像`}
          onClose={() => setIsEditingUserAvatar(false)}
          onSave={updateUserAvatar}
        />
      )}
      {isEditingMomentsCover && (
        <AvatarEditor
          title="设置朋友圈背景"
          initialUrl={state.settings.momentsCoverUrl}
          searchHint="朋友圈 封面 风景"
          filePrefix="moments-background"
          onClose={() => setIsEditingMomentsCover(false)}
          onSave={updateMomentsCover}
        />
      )}
      {isMainActionsOpen && (
        <MainPlusMenu
          onClose={() => setIsMainActionsOpen(false)}
          actions={[
            {
              label: "新的聊天",
              icon: "tab-chat",
              onClick: () => {
                triggerProactive();
                navigateTab("chats");
              }
            },
            {
              label: "添加朋友",
              icon: "new-friend",
              tone: "green",
              onClick: () => {
                setAddFriendRequest((value) => value + 1);
                navigateTab("contacts");
              }
            },
            { label: "朋友圈", icon: "moments", tone: "blue", onClick: openMomentsPage },
            { label: "设置", icon: "settings", tone: "gray", onClick: () => setIsSettingsOpen(true) }
          ]}
        />
      )}
      <div className="debug-summary" aria-hidden="true">
        {messageSummary(state.messages).slice(0, 0)}
      </div>
    </div>
  );
}
