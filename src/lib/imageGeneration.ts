import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { MediaAsset, Settings } from "../types";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const imagesGenerationsUrl = (baseUrl?: string) => {
  const base = trimTrailingSlash(baseUrl || "https://yunwu.ai/v1");
  return base.endsWith("/images/generations") ? base : `${base}/images/generations`;
};

const imageBodies = (settings: Pick<Settings, "apiImageModel" | "apiImageSize">, prompt: string) => {
  const size = settings.apiImageSize || "1k";
  const baseBody: Record<string, unknown> = {
    model: settings.apiImageModel || "grok-imagine-image-quality",
    prompt,
    n: 1
  };

  const sizedBody = { ...baseBody };
  if (/^\d+x\d+$/i.test(size)) {
    sizedBody.size = size;
  } else {
    sizedBody.resolution = size;
  }

  const openAiSize = { ...baseBody, size: /^\d+x\d+$/i.test(size) ? size : "1024x1024" };
  return [
    { ...sizedBody, response_format: "b64_json" },
    sizedBody,
    { ...openAiSize, response_format: "b64_json" },
    openAiSize
  ];
};

const responseToAsset = (data: any, prompt: string): MediaAsset | null => {
  const item = data?.data?.[0] || data?.images?.[0] || data?.output?.[0]?.content?.[0] || data?.image || data;
  if (!item) return null;
  const stringValue = (value: unknown) => (typeof value === "string" ? value : "");
  const base64 =
    stringValue(item.b64_json) ||
    stringValue(item.image_base64) ||
    stringValue(item.base64) ||
    stringValue(item.data) ||
    (typeof item === "string" && !item.startsWith("http") && !item.startsWith("data:") ? item : "");
  const rawUrl =
    stringValue(item.url) ||
    stringValue(item.image_url) ||
    stringValue(item.output_url) ||
    stringValue(item?.content?.[0]?.url) ||
    (typeof item === "string" && (item.startsWith("http") || item.startsWith("data:")) ? item : "");
  const mime = item.mime_type || item.mime || "image/png";
  const url = base64 ? `data:${mime};base64,${base64}` : rawUrl;
  if (!url) return null;
  return {
    id: `gen_${crypto.randomUUID()}`,
    type: "image",
    url,
    title: prompt.slice(0, 40) || "生成图片",
    sourceUrl: item.url
  };
};

export const canGenerateImage = (settings: Pick<Settings, "apiKey" | "apiBaseUrl" | "apiImageModel">) =>
  Boolean(settings.apiKey && settings.apiBaseUrl && settings.apiImageModel);

export const generateImageAsset = async (
  settings: Pick<Settings, "apiKey" | "apiBaseUrl" | "apiImageModel" | "apiImageSize">,
  prompt: string
): Promise<MediaAsset | null> => {
  if (!canGenerateImage(settings)) return null;
  const url = imagesGenerationsUrl(settings.apiBaseUrl);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${settings.apiKey}`
  };
  let lastError: unknown;
  for (const body of imageBodies(settings, prompt)) {
    try {
      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.request({
          method: "POST",
          url,
          headers,
          data: body,
          responseType: "json"
        });
        if (response.status < 200 || response.status >= 300) throw new Error(`Image provider failed with HTTP ${response.status}.`);
        const asset = responseToAsset(response.data, prompt);
        if (asset) return asset;
        throw new Error("Image provider returned no image.");
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`Image provider failed with HTTP ${response.status}.`);
      const asset = responseToAsset(await response.json(), prompt);
      if (asset) return asset;
      throw new Error("Image provider returned no image.");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Image provider failed.");
};
