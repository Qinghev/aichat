# API、GitHub 更新和文字档案备份

## 1. API Key 不再打进 APK

新版 APK 不再内置 DeepSeek 或任何其它模型 API key。

手机里进入：

```text
我 -> 设置 -> 模型接口
```

填写：

```text
Base URL: https://api.x.ai/v1
模型: grok-4.3
API Key: 你自己的 xAI key
```

也可以填 OpenAI-compatible 中转地址。只要中转服务兼容 `/chat/completions`，就能用于文字聊天。

模型字段直接填服务商给你的模型 ID。App 会把它原样放进请求体的 `model` 字段，例如：

```text
grok-4.3
grok-4
gpt-4.1
claude-sonnet-4
deepseek-chat
```

Base URL 可以填：

```text
https://中转站域名/v1
```

也可以直接填完整地址：

```text
https://中转站域名/v1/chat/completions
```

价格和可用模型以你使用的官方平台或中转站后台为准。当前应用的聊天接口先接文字聊天；图片发送、朋友圈图片搜索仍走现有图片搜索逻辑。若要让 Grok 真正理解用户发来的图片，需要再接对应服务商的图文输入格式。

## 2. 全局 Skill 和角色 Skill

全局 Skill：

```text
我 -> 设置 -> 模型接口 -> 全局 Skill
```

适合写所有角色共同遵守的规则，例如回复长度、关系边界、你偏好的分析方式。

角色专属 Skill：

```text
通讯录 -> 选择角色 -> 详细资料 -> 专属 Skill
```

适合写单个角色的能力、口吻、关系设定和禁区。

实际请求优先级：

```text
全局 Skill -> 角色专属 Skill -> 人物资料 -> 长期记忆
```

## 3. 国内中转 API 怎么选

优先级建议：

1. 官方 xAI API：最干净，价格透明，隐私风险最低。
2. OpenRouter 这类公开聚合平台：通常兼容 OpenAI API，模型多，但价格和可用性会变化。
3. 国内个人或小团队中转：能解决网络和支付问题，但要谨慎。不要把敏感聊天、朋友测试数据、长期心理画像直接交给不可信中转。

不要把中转 key 打包进 APK。每个测试者自己在手机设置里填自己的 key。

## 4. 用 GitHub Pages 做在线更新

你已经创建了仓库：

```text
git@github.com:Qinghev/aichat.git
```

生成更新文件：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-internal-update.ps1 -VersionCode 4 -VersionName "1.3" -BaseUrl "https://qinghev.github.io/aichat" -Notes "Internal test update"
```

发布到 GitHub Pages：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-github-pages.ps1
```

这个脚本会把 `release` 里的这些文件推到 `gh-pages` 分支根目录：

```text
AIChatSandbox-debug.apk
update.json
index.html
.nojekyll
```

然后到 GitHub 仓库：

```text
Settings -> Pages -> Build and deployment -> Deploy from a branch
```

选择：

```text
Branch: gh-pages
Folder: /root
```

发布后地址是：

```text
https://qinghev.github.io/aichat/
```

然后 `.env.local` 写：

```text
VITE_UPDATE_MANIFEST_URL=https://qinghev.github.io/aichat/update.json
```

第一次需要手动安装这个带更新器的 APK。之后每次更新：递增 `VersionCode`，运行构建脚本，再运行部署脚本。手机打开应用后会自动检查。

## 5. 文字档案备份到这台电脑

电脑上运行：

```powershell
npm.cmd run backup:server
```

终端会显示类似：

```text
http://192.168.1.10:8787/upload
http://192.168.1.10:8787/viewer
```

手机和电脑连同一个 Wi-Fi。手机进入：

```text
我 -> 设置 -> 文字档案 -> 电脑接收地址
```

填上这个地址，然后点：

```text
发送到电脑
```

电脑会保存到：

```text
backups/text/
```

也可以直接用 API 查看：

```text
GET http://电脑IP:8787/archives
GET http://电脑IP:8787/archives/某个档案.json
GET http://电脑IP:8787/archives/某个档案.json/transcript
```

浏览器查看页面：

```text
http://电脑IP:8787/viewer
```

保存内容只包括：

```text
用户显示名
AI 角色文字设定
会话索引
用户和 AI 的文字消息
```

不会保存：

```text
图片
语音
朋友圈
头像图片文件
API key
完整应用状态
```

朋友测试时，让朋友导出文字档案或直接发到你的电脑。你之后可以用这些 JSON 做性格分析、长期主题分析、关系模式分析。
