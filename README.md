# AI Chat Sandbox

私人 Android 测试 App。当前版本不再内置任何模型 API key；每台手机在应用内自行填写 OpenAI-compatible 接口配置。

## 当前能力

- Android 侧载 APK
- 微信风格聊天、通讯录、发现、朋友圈、我
- AI 角色资料和性格可编辑
- 远程 OpenAI-compatible 模型或本地模拟回退
- 私有 APK 更新检查
- 只含 AI 形象和文字对话的档案导出、导入、电脑备份

## 安装

APK 位于：

```text
release/AIChatSandbox-debug.apk
```

这是 debug 包，只适合内部测试。

## 配置模型

手机里进入：

```text
我 -> 设置 -> 模型接口
```

示例：

```text
Base URL: https://api.x.ai/v1
模型: grok-4.3
API Key: 你自己的 key
```

API key 保存在手机本地，不会打进 APK。

## 构建

```powershell
npm.cmd run android:debug
```

生成在线更新文件：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-internal-update.ps1 -VersionCode 4 -VersionName "1.3" -BaseUrl "https://qinghev.github.io/aichat" -Notes "Internal test update"
```

提交源码并发布 GitHub Pages 更新通道：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-github-pages.ps1
```

## 文字备份到电脑

电脑运行：

```powershell
npm.cmd run backup:server
```

手机里进入：

```text
我 -> 设置 -> 文字档案
```

填入电脑显示的 `http://电脑IP:8787/upload` 后发送。保存内容只包含 AI 角色文字设定和用户/AI 文字消息，不包含图片、语音、朋友圈或 API key。
