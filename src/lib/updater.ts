import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";

interface NativeAppInfo {
  versionCode: number;
  versionName: string;
  canRequestPackageInstalls: boolean;
}

interface InternalUpdaterPlugin {
  getInfo(): Promise<NativeAppInfo>;
  openInstallPermission(): Promise<void>;
  downloadAndInstall(options: { url: string; fileName?: string; sha256?: string }): Promise<{ path: string }>;
}

export interface UpdateManifest {
  versionCode: number;
  versionName?: string;
  apkUrl?: string;
  url?: string;
  sha256?: string;
  notes?: string;
  mandatory?: boolean;
}

const InternalUpdater = registerPlugin<InternalUpdaterPlugin>("InternalUpdater");
const manifestUrl = import.meta.env.VITE_UPDATE_MANIFEST_URL || "";
const checkIntervalMs = Number(import.meta.env.VITE_UPDATE_CHECK_INTERVAL_MS || 10 * 60 * 1000);
const lastCheckKey = "weichat-last-update-check-at";
const pendingUpdateVersionKey = "weichat-pending-update-version";

const parseManifest = (data: unknown): UpdateManifest => {
  if (typeof data === "string") return JSON.parse(data) as UpdateManifest;
  return data as UpdateManifest;
};

const resolveUrl = (value: string, baseUrl: string) => new URL(value, baseUrl).toString();

const fetchManifest = async (): Promise<UpdateManifest> => {
  const response = Capacitor.isNativePlatform()
    ? await CapacitorHttp.get({
        url: manifestUrl,
        headers: {
          "Cache-Control": "no-cache"
        }
      })
    : { status: 200, data: await fetch(manifestUrl, { cache: "no-store" }).then((item) => item.json()) };

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Update manifest failed with HTTP ${response.status}.`);
  }

  const manifest = parseManifest(response.data);
  const apkUrl = manifest.apkUrl || manifest.url;
  if (!manifest.versionCode || !apkUrl) {
    throw new Error("Update manifest must include versionCode and apkUrl.");
  }

  return {
    ...manifest,
    apkUrl: resolveUrl(apkUrl, manifestUrl)
  };
};

export const checkForInternalUpdate = async (force = false) => {
  if (!Capacitor.isNativePlatform() || !manifestUrl) return;

  const now = Date.now();
  const lastCheckAt = Number(localStorage.getItem(lastCheckKey) || 0);
  if (!force && now - lastCheckAt < checkIntervalMs) return;

  try {
    const [appInfo, manifest] = await Promise.all([InternalUpdater.getInfo(), fetchManifest()]);
    localStorage.setItem(lastCheckKey, String(now));
    if (manifest.versionCode <= appInfo.versionCode) {
      localStorage.removeItem(pendingUpdateVersionKey);
      if (force) window.alert("当前已是最新版本。");
      return;
    }

    localStorage.setItem(pendingUpdateVersionKey, String(manifest.versionCode));
    const title = manifest.versionName ? `发现新版本 ${manifest.versionName}` : "发现新版本";
    const notes = manifest.notes ? `\n\n${manifest.notes}` : "";
    const confirmed = manifest.mandatory || window.confirm(`${title}${notes}\n\n是否现在更新？`);
    if (!confirmed) return;

    if (!appInfo.canRequestPackageInstalls) {
      window.alert("需要先允许本应用安装未知应用。打开设置后，请允许“微聊”，再回到应用重新更新。");
      await InternalUpdater.openInstallPermission();
      return;
    }

    const fileName = `weichat-${manifest.versionCode}.apk`;
    await InternalUpdater.downloadAndInstall({
      url: manifest.apkUrl!,
      fileName,
      sha256: manifest.sha256
    });
  } catch (error) {
    if (force) {
      const message = error instanceof Error ? error.message : "更新检查失败。";
      window.alert(message);
    }
  }
};
