# 私有自动更新

Android 普通侧载应用不能静默安装新版 APK。当前实现是：应用启动时自动检查远程 `update.json`，发现更高 `versionCode` 后自动下载 APK，并弹出系统安装确认页。

## 启用方式

1. 找一个你自己可控的 HTTPS 目录，例如：

```text
https://your-domain.example/aichat/
```

2. 在 `.env.local` 增加更新清单地址：

```text
VITE_UPDATE_MANIFEST_URL=https://your-domain.example/aichat/update.json
```

3. 第一次需要手动安装带更新器的 APK。之后每次发新版都执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-internal-update.ps1 -VersionCode 3 -VersionName "1.2" -BaseUrl "https://your-domain.example/aichat" -Notes "Internal test update"
```

4. 把这两个文件上传到同一个 HTTPS 目录：

```text
release/AIChatSandbox-debug.apk
release/update.json
```

后续版本必须递增 `VersionCode`，否则 Android 不会把 APK 当成升级包。
