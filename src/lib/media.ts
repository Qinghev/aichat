import type { Character, MediaAsset } from "../types";

const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php";
const MAX_CACHED_IMAGE_BYTES = 1_600_000;
const SEARCH_TIMEOUT_MS = 6500;
const IMAGE_CACHE_TIMEOUT_MS = 4500;

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
};

const fallbackKeywords = (query: string) => {
  if (/头像|人像|自拍/.test(query)) return "portrait,person";
  if (/猫/.test(query)) return "cat";
  if (/狗/.test(query)) return "dog";
  if (/咖啡|店/.test(query)) return "cafe,coffee";
  if (/夜|晚安|窗/.test(query)) return "night,window";
  if (/街|路|城市/.test(query)) return "street,city";
  if (/饭|吃|面/.test(query)) return "food,noodles";
  if (/花|植物/.test(query)) return "flowers,plants";
  if (/海|风景|天空|夕阳/.test(query)) return "landscape,sunset";
  return "city,life";
};

const fallbackImageAssets = (query: string, limit: number): MediaAsset[] => {
  const keywords = fallbackKeywords(query);
  return Array.from({ length: Math.min(limit, 12) }, (_, index) => {
    const lock = 1200 + index;
    const url = `https://loremflickr.com/900/900/${encodeURIComponent(keywords)}?lock=${lock}`;
    return {
      id: `fallback_${lock}`,
      type: "image",
      url,
      thumbUrl: `https://loremflickr.com/360/360/${encodeURIComponent(keywords)}?lock=${lock}`,
      title: query || keywords,
      sourceUrl: "https://loremflickr.com"
    };
  });
};

const stickerSvg = (emoji: string, label: string, tone: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <rect width="240" height="240" rx="38" fill="${tone}"/>
  <circle cx="120" cy="96" r="64" fill="#fff7dc" opacity=".96"/>
  <text x="120" y="118" text-anchor="middle" font-size="72" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${emoji}</text>
  <text x="120" y="188" text-anchor="middle" font-size="24" font-weight="700" fill="#26322e" font-family="Microsoft YaHei, Arial, sans-serif">${label}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const stickerPack: MediaAsset[] = [
  { id: "stk_hao", type: "sticker", emoji: "👌", label: "收到", tone: "#c7f3d4", url: stickerSvg("👌", "收到", "#c7f3d4") },
  { id: "stk_xiao", type: "sticker", emoji: "🙂", label: "好呀", tone: "#ffe7a3", url: stickerSvg("🙂", "好呀", "#ffe7a3") },
  { id: "stk_lei", type: "sticker", emoji: "😵", label: "有点累", tone: "#d6e3ff", url: stickerSvg("😵", "有点累", "#d6e3ff") },
  { id: "stk_wen", type: "sticker", emoji: "🫶", label: "抱一下", tone: "#ffd7df", url: stickerSvg("🫶", "抱一下", "#ffd7df") },
  { id: "stk_chi", type: "sticker", emoji: "🍜", label: "先吃饭", tone: "#f9d1a8", url: stickerSvg("🍜", "先吃饭", "#f9d1a8") },
  { id: "stk_kan", type: "sticker", emoji: "👀", label: "我看看", tone: "#ccefe8", url: stickerSvg("👀", "我看看", "#ccefe8") },
  { id: "stk_zan", type: "sticker", emoji: "✨", label: "可以", tone: "#e9d8ff", url: stickerSvg("✨", "可以", "#e9d8ff") },
  { id: "stk_shui", type: "sticker", emoji: "💤", label: "晚安", tone: "#cfd7e6", url: stickerSvg("💤", "晚安", "#cfd7e6") }
];

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const fileToMediaAsset = async (file: File, prefix = "media"): Promise<MediaAsset> => ({
  id: `${prefix}_${crypto.randomUUID()}`,
  type: "image",
  url: await readBlobAsDataUrl(file),
  title: file.name
});

type CommonsPage = {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    mime?: string;
    descriptionurl?: string;
  }>;
};

export const searchImages = async (query: string, limit = 12): Promise<MediaAsset[]> => {
  const normalized = query.trim() || "城市 生活 风景";
  const url = new URL(COMMONS_API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("origin", "*");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(limit));
  url.searchParams.set("gsrsearch", normalized);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime");
  url.searchParams.set("iiurlwidth", "900");

  try {
    const response = await fetchWithTimeout(url.toString(), SEARCH_TIMEOUT_MS);
    if (!response.ok) throw new Error(`图片搜索失败：${response.status}`);
    const data = (await response.json()) as { query?: { pages?: Record<string, CommonsPage> } };
    const pages = Object.values(data.query?.pages ?? {});

    const assets = pages
      .map((page): MediaAsset | null => {
        const info = page.imageinfo?.[0];
        const displayUrl = info?.thumburl || info?.url;
        if (!displayUrl || !info?.mime?.startsWith("image/")) return null;
        return {
          id: `web_${page.pageid}`,
          type: "image",
          url: displayUrl,
          thumbUrl: info.thumburl || displayUrl,
          title: page.title.replace(/^File:/, ""),
          sourceUrl: info.descriptionurl,
          width: info.thumbwidth,
          height: info.thumbheight
        };
      })
      .filter(Boolean) as MediaAsset[];

    return assets.length > 0 ? assets : fallbackImageAssets(normalized, limit);
  } catch {
    return fallbackImageAssets(normalized, limit);
  }
};

export const cacheImageAsset = async (asset: MediaAsset): Promise<MediaAsset> => {
  if (asset.url.startsWith("data:")) return asset;
  try {
    const response = await fetchWithTimeout(asset.thumbUrl || asset.url, IMAGE_CACHE_TIMEOUT_MS);
    if (!response.ok) return asset;
    const blob = await response.blob();
    if (blob.size > MAX_CACHED_IMAGE_BYTES) return asset;
    return {
      ...asset,
      id: `media_${crypto.randomUUID()}`,
      url: await readBlobAsDataUrl(blob)
    };
  } catch {
    return { ...asset, id: `media_${crypto.randomUUID()}` };
  }
};

export const shouldAttachImageFromText = (text: string) =>
  /图片|照片|图|表情包|看看|风景|壁纸|头像|朋友圈|发张|来张|找张|搜/.test(text);

export const imageQueryFromText = (text: string, character?: Character) => {
  const cleaned = text
    .replace(/发|来|给我|帮我|搜索|搜|找|一张|张|图片|照片|图|看看|用于|朋友圈|头像|表情包/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) return cleaned;
  if (character?.roleType.includes("理性")) return "desk notes city";
  if (character?.roleType.includes("树洞")) return "night window quiet";
  if (character?.roleType.includes("朋友")) return "daily life cafe";
  return "city life";
};

export const momentImageQuery = (content: string, character: Character) => {
  if (/天色|路上|慢/.test(content)) return "street sunset";
  if (/答案|问题|变量|笔记/.test(content)) return "notebook desk";
  if (/边界|站稳/.test(content)) return "quiet street";
  return imageQueryFromText(content, character);
};
