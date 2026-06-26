import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { MediaAsset, Settings } from "../types";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const imagesGenerationsUrl = (baseUrl?: string) => {
  const base = trimTrailingSlash(baseUrl || "https://yunwu.ai/v1");
  return base.endsWith("/images/generations") ? base : `${base}/images/generations`;
};

const imageBody = (settings: Pick<Settings, "apiImageModel" | "apiImageSize">, prompt: string) => {
  const size = settings.apiImageSize || "1k";
  const body: Record<string, unknown> = {
    model: settings.apiImageModel || "grok-imagine-image-quality",
    prompt,
    n: 1,
    response_format: "b64_json"
  };

  if (/^\d+x\d+$/i.test(size)) {
    body.size = size;
  } else {
    body.resolution = size;
  }

  return body;
};

const responseToAsset = (data: any, prompt: string): MediaAsset | null => {
  const item = data?.data?.[0];
  if (!item) return null;
  const base64 = item.b64_json || item.image_base64;
  const url = base64 ? `data:image/png;base64,${base64}` : item.url;
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
  const body = imageBody(settings, prompt);

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      method: "POST",
      url,
      headers,
      data: body,
      responseType: "json"
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`Image provider failed with HTTP ${response.status}.`);
    return responseToAsset(response.data, prompt);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Image provider failed with HTTP ${response.status}.`);
  return responseToAsset(await response.json(), prompt);
};
