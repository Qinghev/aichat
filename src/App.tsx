import {
  Bell,
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
  Link,
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
  Send,
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
import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import {
  cacheImageAsset,
  fileToMediaAsset,
  imageQueryFromText,
  momentImageQuery,
  searchImages,
  shouldAttachImageFromText,
  stickerPack
} from "./lib/media";
import { downloadTextArchive, mergeTextArchive, sendTextArchive, type TextArchive } from "./lib/textArchive";
import { checkForInternalUpdate } from "./lib/updater";
import type { AppState, Character, Conversation, MediaAsset, Message, MomentPost, TabKey, UserProfile } from "./types";

const localProvider = new LocalPersonaProvider();

const iconSize = 20;

const createId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const messagePreview = (message?: Message) => {
  if (!message) return "还没有消息";
  if (message.contentType === "image") return "[图片]";
  if (message.contentType === "sticker") return `[表情] ${message.media?.label || message.content}`;
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
  onClose,
  onSave
}: {
  title: string;
  initialUrl?: string;
  searchHint: string;
  onClose: () => void;
  onSave: (avatarUrl: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl || "");

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const media = await fileToMediaAsset(file, "avatar");
    onSave(media.url);
    onClose();
  };

  const saveUrl = () => {
    onSave(url.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel avatar-panel">
        <button type="button" className="icon-button modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <h2>{title}</h2>
        <div className="avatar-preview" style={url ? { backgroundImage: `url(${url})` } : undefined}>
          {!url && <Image size={28} />}
        </div>
        <label className="file-row">
          <Upload size={18} />
          从手机相册选择
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>
        <label>
          <span className="label-with-icon">
            <Link size={15} />
            图片地址
          </span>
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
        </label>
        <button className="primary-button" type="button" onClick={saveUrl}>
          保存
        </button>
        <ImageSearchPanel
          initialQuery={searchHint}
          onPick={(asset) => {
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
  onAddCharacter
}: {
  state: AppState;
  onOpen: (characterId: string) => void;
  onAddCharacter: (character: Character) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("自定义朋友");

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
        <div className="utility-icon green">
          <UserPlus size={18} />
        </div>
        <span>新的朋友</span>
      </button>
      <div className="utility-row static">
        <div className="utility-icon blue">
          <Users size={18} />
        </div>
        <span>群聊</span>
      </div>
      <div className="utility-row static">
        <div className="utility-icon yellow">
          <Tags size={18} />
        </div>
        <span>标签</span>
      </div>
      <div className="utility-row static">
        <div className="utility-icon teal">
          <Bookmark size={18} />
        </div>
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
    { label: "朋友圈", icon: <Camera size={20} />, className: "blue", onClick: onOpenMoments },
    { label: "视频号", icon: <Eye size={20} />, className: "orange" },
    { label: "扫一扫", icon: <QrCode size={20} />, className: "green", gap: true },
    { label: "看一看", icon: <Sparkles size={20} />, className: "yellow" },
    { label: "搜一搜", icon: <Search size={20} />, className: "teal" },
    { label: "购物", icon: <ShoppingBag size={20} />, className: "red", gap: true },
    { label: "游戏", icon: <Gamepad2 size={20} />, className: "purple" },
    { label: "小程序", icon: <Plus size={20} />, className: "green", gap: true }
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
          <div className={`utility-icon ${row.className}`}>{row.icon}</div>
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
  generating
}: {
  state: AppState;
  onBack: () => void;
  onGenerate: () => void;
  onPublish: (content: string, media: MediaAsset[]) => void;
  onToggleLike: (postId: string) => void;
  onComment: (postId: string) => void;
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
          <Camera size={21} />
        </button>
      </header>
      <div
        className="screen-body moments-body moments-full-body"
        onScroll={(event) => setCoverScrolled(event.currentTarget.scrollTop > 210)}
      >
        <div className="moments-cover">
          <div className="moments-cover-photo" />
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
            <MoreHorizontal size={16} />
          </button>
          {showActions && (
            <div className="moment-action-pop">
              <button
                onClick={() => {
                  onToggleLike(post.id);
                  setShowActions(false);
                }}
              >
                <Heart size={15} />
                赞
              </button>
              <button
                onClick={() => {
                  onComment(post.id);
                  setShowActions(false);
                }}
              >
                <MessageSquare size={15} />
                评论
              </button>
            </div>
          )}
        </div>
        {(likes.length > 0 || comments.length > 0) && (
          <div className="interaction-panel">
            {likes.length > 0 && (
              <div className="likes-line">
                <Heart size={13} />
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
        <button className="icon-button" onClick={onEditAvatar} title="设置头像">
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
    </section>
  );
}

function MeTab({
  state,
  onEditAvatar,
  onOpenSettings
}: {
  state: AppState;
  onEditAvatar: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <section className="screen-body me-body">
      <div className="profile-row me-profile-row" onClick={onEditAvatar}>
        <button className="profile-avatar-button" onClick={onEditAvatar} title="设置头像">
          <UserAvatar user={state.user} size="lg" />
        </button>
        <div>
          <div className="profile-name">{state.user.displayName}</div>
          <div className="profile-sub">微信号：qinghe</div>
        </div>
        <QrCode className="profile-qr-icon" size={19} />
        <ChevronRight className="profile-edit-icon" size={18} />
      </div>

      <div className="settings-block me-list-block">
        <button className="setting-row">
          <ShoppingBag size={20} />
          服务
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="settings-block me-list-block">
        <button className="setting-row">
          <Heart size={20} />
          收藏
          <ChevronRight size={18} />
        </button>
        <button className="setting-row">
          <Camera size={20} />
          朋友圈
          <ChevronRight size={18} />
        </button>
        <button className="setting-row">
          <QrCode size={20} />
          卡包
          <ChevronRight size={18} />
        </button>
        <button className="setting-row">
          <Smile size={20} />
          表情
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="settings-block me-list-block">
        <button
          className="setting-row"
          onClick={onOpenSettings}
        >
          <SlidersHorizontal size={20} />
          设置
          <ChevronRight size={18} />
        </button>
      </div>
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
          apiKey: prev.settings.apiKey
        }
      }));
      setStatus("已恢复完整本机数据。");
    } catch {
      setStatus("恢复失败，请确认文件是完整本机备份 JSON。");
    } finally {
      event.target.value = "";
    }
  };

  const sendBackup = async () => {
    setStatus("正在发送到电脑...");
    try {
      await sendTextArchive(state, state.settings.textBackupEndpoint);
      setStatus("已发送到电脑。");
    } catch {
      setStatus("发送失败，请确认电脑接收脚本正在运行，且手机和电脑在同一网络。");
    }
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
              placeholder="https://api.x.ai/v1"
            />
          </label>
          <label>
            <span>模型</span>
            <input
              list="api-model-options"
              value={state.settings.apiModel}
              onChange={(event) => updateSetting("apiModel", event.target.value)}
              placeholder="grok-4.3 / 中转站模型 ID"
            />
            <datalist id="api-model-options">
              <option value="grok-4.3" />
              <option value="grok-4" />
              <option value="grok-3" />
              <option value="gpt-4.1" />
              <option value="claude-sonnet-4" />
              <option value="deepseek-chat" />
            </datalist>
          </label>
          <label className="settings-textarea-label">
            <span>全局 Skill</span>
            <textarea
              value={state.settings.globalSkillPrompt}
              onChange={(event) => updateSetting("globalSkillPrompt", event.target.value)}
              placeholder="所有联系人共同遵守的说话方式、能力和边界"
              rows={5}
            />
          </label>
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
          <label>
            <span>电脑接收地址</span>
            <input
              value={state.settings.textBackupEndpoint}
              onChange={(event) => updateSetting("textBackupEndpoint", event.target.value)}
              placeholder="http://电脑IP:8787/upload"
            />
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.settings.autoTextBackup}
              onChange={(event) => updateSetting("autoTextBackup", event.target.checked)}
            />
            <span>有新文字聊天时自动发送到电脑</span>
          </label>
          <button type="button" className="primary-button" onClick={sendBackup}>
            发送到电脑
          </button>
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

function ChatView({
  state,
  conversation,
  close,
  setState
}: {
  state: AppState;
  conversation: Conversation;
  close: () => void;
  setState: (updater: AppState | ((prev: AppState) => AppState)) => void;
}) {
  const [text, setText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
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
  }, [conversation.id, messages.length, isThinking, showImagePicker, showStickers]);

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
  };

  const handleChatImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    sendMediaMessage(await fileToMediaAsset(file, "chat"), "image");
    event.target.value = "";
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
        globalSkillPrompt: state.settings.globalSkillPrompt
      })
      .catch(async () => {
        const fallback = await localProvider.chat({
          character,
          userMessage: content,
          recentMessages: messages.slice(-12),
          memorySummary,
          globalSkillPrompt: state.settings.globalSkillPrompt
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

      if (shouldAttachImageFromText(content) && result.riskLevel !== "L3" && result.riskLevel !== "L4") {
        const images = await searchImages(imageQueryFromText(content, character), 8).catch(() => []);
        if (images[0]) {
          const asset = await cacheImageAsset(images[0]);
          outgoing.push({
            id: createId("msg"),
            conversationId: conversation.id,
            senderType: "ai",
            senderCharacterId: character.id,
            contentType: "image",
            content: asset.title || "图片",
            media: asset,
            aiGenerated: true,
            riskLevel: "L0",
            createdAt: new Date().toISOString(),
            modelName: "image-search"
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

  return (
    <section className="chat-view">
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
        <button className="icon-button">
          <MoreHorizontal size={22} />
        </button>
      </header>

      <div className="message-list" ref={messageListRef}>
        {messages.filter((message) => message.senderType !== "system").map((message) => {
          const mine = message.senderType === "user";
          const system = false;
          return (
            <div className={`message-row ${mine ? "mine" : ""} ${system ? "system" : ""}`} key={message.id}>
              {!mine && !system && <Avatar character={character} size="sm" />}
              <div
                className={`bubble bubble-${message.contentType} ${
                  message.riskLevel === "L3" || message.riskLevel === "L4" ? "risk" : ""
                }`}
              >
                {message.contentType === "image" && message.media ? (
                  <img className="message-image" src={message.media.url} alt={message.media.title || ""} />
                ) : message.contentType === "sticker" && message.media ? (
                  <img className="message-sticker" src={message.media.url} alt={message.media.label || ""} />
                ) : (
                  message.content
                )}
              </div>
              {mine && !system && <UserAvatar user={state.user} size="sm" />}
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

      <form className="composer" onSubmit={sendMessage}>
        <button type="button" className="tool-button" title="语音">
          <Mic size={iconSize} />
        </button>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => window.setTimeout(scrollToBottom, 260)}
          placeholder="发消息"
          maxLength={500}
        />
        <button
          type="button"
          className="tool-button"
          onClick={() => {
            setShowStickers((value) => !value);
            setShowImagePicker(false);
          }}
          title="表情"
        >
          <Smile size={iconSize} />
        </button>
        <button
          type="button"
          className="tool-button"
          onClick={() => {
            setShowImagePicker((value) => !value);
            setShowStickers(false);
          }}
          title="图片"
        >
          <Image size={iconSize} />
        </button>
        <button className="send-button" type="submit" disabled={!text.trim()}>
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}

function BottomTabs({ active, setActive }: { active: TabKey; setActive: (tab: TabKey) => void }) {
  const tabs: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
    { key: "chats", label: "聊天", icon: <MessageCircle size={22} /> },
    { key: "contacts", label: "通讯录", icon: <UserRound size={22} /> },
    { key: "moments", label: "发现", icon: <Compass size={22} /> },
    { key: "me", label: "我", icon: <CircleUserRound size={22} /> }
  ];
  return (
    <nav className="bottom-tabs">
      {tabs.map((tab) => (
        <button className={active === tab.key ? "active" : ""} key={tab.key} onClick={() => setActive(tab.key)}>
          {tab.icon}
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
  const [isMomentsOpen, setIsMomentsOpen] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [isEditingUserAvatar, setIsEditingUserAvatar] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGeneratingMoment, setIsGeneratingMoment] = useState(false);
  const lastAutoBackupMessageCount = useRef(0);
  const historyReady = useRef(false);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    setState((prev) => ({ ...prev, user: { ...prev.user, lastActiveAt: new Date().toISOString() } }));
    void checkForInternalUpdate();
  }, []);

  useEffect(() => {
    const textMessageCount = state.messages.filter((message) => message.contentType === "text").length;
    if (!state.settings.autoTextBackup || !state.settings.textBackupEndpoint || textMessageCount === lastAutoBackupMessageCount.current) {
      lastAutoBackupMessageCount.current = textMessageCount;
      return;
    }
    lastAutoBackupMessageCount.current = textMessageCount;
    const timer = window.setTimeout(() => {
      void sendTextArchive(state, state.settings.textBackupEndpoint).catch(() => undefined);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [state, state.messages.length, state.settings.autoTextBackup, state.settings.textBackupEndpoint]);

  useEffect(() => {
    if (!historyReady.current) {
      window.history.replaceState(
        { app: "weichat", tab: "chats", conversationId: null, profileCharacterId: null, momentsOpen: false },
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
        setIsMomentsOpen(Boolean(view.momentsOpen));
      } else {
        setActiveConversationId(null);
        setActiveProfileCharacterId(null);
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
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return;
      }
      if (activeConversationId || activeProfileCharacterId || isMomentsOpen) {
        window.history.back();
        return;
      }
      CapacitorApp.exitApp();
    });

    return () => {
      listener.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [activeConversationId, activeProfileCharacterId, editingCharacterId, isEditingUserAvatar, isMomentsOpen, isSettingsOpen]);

  const activeConversation = useMemo(
    () => state.conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, state.conversations]
  );

  const activeProfileCharacter = useMemo(
    () => state.characters.find((character) => character.id === activeProfileCharacterId),
    [activeProfileCharacterId, state.characters]
  );

  const navigateTab = (tab: TabKey) => {
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setIsMomentsOpen(false);
    setActiveTab(tab);
    window.history.pushState({ app: "weichat", tab, conversationId: null, profileCharacterId: null, momentsOpen: false }, "");
  };

  const openConversation = (conversationId: string) => {
    setActiveTab("chats");
    setActiveConversationId(conversationId);
    setActiveProfileCharacterId(null);
    setIsMomentsOpen(false);
    window.history.pushState({ app: "weichat", tab: "chats", conversationId, profileCharacterId: null, momentsOpen: false }, "");
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
    setIsMomentsOpen(false);
    setActiveTab("contacts");
    window.history.pushState(
      { app: "weichat", tab: "contacts", conversationId: null, profileCharacterId: characterId, momentsOpen: false },
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

  const openMomentsPage = () => {
    setIsMomentsOpen(true);
    setActiveConversationId(null);
    setActiveProfileCharacterId(null);
    setActiveTab("moments");
    window.history.pushState(
      { app: "weichat", tab: "moments", conversationId: null, profileCharacterId: null, momentsOpen: true },
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
      setIsMomentsOpen(false);
      setActiveTab("chats");
      window.history.pushState(
        { app: "weichat", tab: "chats", conversationId: existing.id, profileCharacterId: null, momentsOpen: false },
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
      lastMessageAt: new Date().toISOString()
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
    const images = await searchImages(momentImageQuery(post.content, character), 8).catch(() => []);
    const image = images[0] ? await cacheImageAsset(images[0]) : undefined;
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

  return (
    <div className="app-shell">
      {activeConversation ? (
        <ChatView
          state={state}
          conversation={activeConversation}
          close={closeConversation}
          setState={setState}
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
          generating={isGeneratingMoment}
        />
      ) : (
        <>
          <header className="app-header">
            <div className="title-row">
              <h1>
                {activeTab === "chats"
                  ? "聊天"
                  : activeTab === "contacts"
                    ? "通讯录"
                    : activeTab === "moments"
                      ? "发现"
                      : "我"}
              </h1>
              <div className="header-actions">
                {activeTab === "chats" && (
                  <button className="icon-button" onClick={triggerProactive} title="模拟主动问候">
                    <Bell size={20} />
                  </button>
                )}
                <button className="icon-button">
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>
          </header>

          {activeTab === "chats" && <ChatsTab state={state} openConversation={openConversation} />}
          {activeTab === "contacts" && (
            <ContactsTab
              state={state}
              onOpen={openCharacterProfile}
              onAddCharacter={addCharacter}
            />
          )}
          {activeTab === "moments" && <DiscoverTab onOpenMoments={openMomentsPage} />}
          {activeTab === "me" && (
            <MeTab
              state={state}
              onEditAvatar={() => setIsEditingUserAvatar(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}
          <BottomTabs active={activeTab} setActive={navigateTab} />
        </>
      )}
      {isSettingsOpen && <SettingsPanel state={state} setState={setState} onClose={() => setIsSettingsOpen(false)} />}
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
      <div className="debug-summary" aria-hidden="true">
        {messageSummary(state.messages).slice(0, 0)}
      </div>
    </div>
  );
}
