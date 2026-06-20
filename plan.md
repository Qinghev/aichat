可以做，但这个版本应当被定义为：

> **个人/小范围封闭实验产品：完全虚拟的微信式 AI 聊天沙盘，不接入真实微信，不公开发布，不收费，不开源，不上架，不导出可乱真的聊天证据。**

你要的“完全仿微信”只能放在**私密实验边界**里处理。公开传播、开源、收费、上架时风险会显著上升。腾讯相关协议明确主张其软件界面设计、版面框架、图标等内容受知识产权保护，未经书面同意不得为商业或非商业目的实施、利用、转让相关知识产权。([zwwx.ndrc.gov.cn][1]) 另外，只要这个东西开始对外提供即时通讯、信息发布等应用程序信息服务，就会涉及应用程序信息内容、个人信息、未成年人保护等义务。([市场监管总局][2])

下面给你一套**实验版设计方案**。

---

# 一、项目定位

项目名称可以内部叫：

**AI WeChat Sandbox / 虚拟微信沙盘 / 私密 AI 关系实验室**

但产品界面里建议常驻标识：

```text
虚拟聊天实验环境
所有联系人均为 AI
非真实微信，不接入真实微信
```

原因是：你需要真实感，但不能让使用者或者第三方误认为这是微信本体、微信插件、微信备份、微信截图生成器或腾讯授权产品。AI 生成合成内容还应做显式或隐式标识，相关规则已经明确把文本、图片、音频、视频、虚拟场景等都纳入生成合成内容标识范围。([市场监管总局][3])

---

# 二、核心原则

你这个实验产品必须遵守几个内部原则。

## 1. 不接入真实微信

不要做：

```text
微信扫码登录
调用微信私有协议
```

你要做的是**虚拟微信式系统**，不是微信插件、微信机器人、微信镜像或微信数据工具。

## 2. 所有联系人都是 AI

系统内没有真人联系人。
朋友进入系统后，看到的是他们自己的 AI 联系人列表。
每个联系人都有：

```text
头像
昵称
备注名
关系
角色背景
性格
说话风格
记忆
主动联系策略
朋友圈发布策略
```

## 3. 朋友圈只对当前用户可见

朋友圈不是公共社区。
每个用户看到的“朋友圈”都是由自己的 AI 角色生成的私域动态。

```text
用户 A 的朋友圈 = A 的 AI 角色动态
用户 B 的朋友圈 = B 的 AI 角色动态
A 看不到 B 的朋友圈
B 看不到 A 的朋友圈
```

这可以显著降低内容传播、侵权、谣言、伪造证据和平台治理风险。

## 4. 朋友聊天记录查看

```text
默认：完整记录透明审计
```

具体见后文。

---

# 三、产品功能结构

## 1. 主界面

完全按微信式结构做，但内部命名和实现要隔离：

```text
Tab 1：聊天
Tab 2：通讯录
Tab 3：发现 / 动态
Tab 4：我
```

实验版可以做到高度相似的交互体验：

```text
聊天列表
置顶聊天
未读红点
消息时间
对话页气泡
语音消息样式
图片消息
表情
撤回提示
拍一拍式互动
朋友圈动态流
点赞
评论
个人主页
备注名
标签
群聊
红包（非真实，虚拟数字）
转账（非真实，虚拟数字）
```

但建议禁用这些功能：

```text
发票
真实位置共享
真实小程序入口
真实公众号入口
真实视频号入口
```

红包、转账、钱包类界面只有功能即可，使用虚拟数字，每个账户10000000，不是涉及真实的金钱。

---

# 四、角色系统设计

## 1. 角色卡 Persona Card

每个 AI 联系人不是简单 prompt，而是一张结构化角色卡。

```json
{
  "character_id": "c_001",
  "display_name": "林夏",
  "remark_name": "林夏",
  "avatar": "local/avatar/lx.png",
  "relationship_to_user": "朋友",
  "role_type": "陪伴型朋友",
  "background": "大学时期认识的朋友，性格温和，善于倾听。",
  "personality": {
    "warmth": 8,
    "humor": 5,
    "initiative": 6,
    "rationality": 7,
    "emotional_support": 9,
    "directness": 4
  },
  "speech_style": {
    "sentence_length": "medium",
    "emoji_frequency": "low",
    "tone": "calm",
    "catchphrases": ["我明白你的意思", "先别急"]
  },
  "boundaries": {
    "must_disclose_ai": true,
    "no_real_person_impersonation": true,
    "no_emotional_dependency_induction": true,
    "no_financial_advice": true,
    "no_medical_diagnosis": true
  },
  "memory_policy": {
    "remember_user_preferences": true,
    "remember_sensitive_data": false,
    "summarize_after_messages": 20
  },
  "proactive_policy": {
    "enabled": true,
    "max_messages_per_day": 2,
    "quiet_hours": ["23:00", "08:00"],
    "allowed_topics": ["问候", "陪伴", "复盘", "提醒"]
  },
  "moments_policy": {
    "enabled": true,
    "max_posts_per_day": 1,
    "visibility": "only_current_user"
  }
}
```

## 2. 角色类型

你可以预设几类角色。

### 朋友陪伴型

```text
温柔朋友
理性朋友
毒舌但关心你的朋友
老同学
一起打游戏的朋友
深夜聊天朋友
```

### 情绪承接型

```text
倾听者
树洞
冷静复盘者
情绪翻译官
```

### 关系演练型

```text
严厉上级
强势客户
冷淡同事
暧昧对象原型
前任关系原型
父母沟通原型
```

---

# 五、用户画像与个性化记忆

你希望 AI 能了解用户性格、针对性回应。建议不要直接把所有聊天记录长期塞进模型，而是建立三层记忆。

## 1. 短期上下文

用于当前对话。

```text
最近 30–50 轮消息
当前情绪
当前话题
当前角色关系状态
```

## 2. 长期记忆摘要

保存用户偏好和稳定特征。

```json
{
  "user_id": "u_001",
  "personality_profile": {
    "communication_style": "不喜欢被说教，需要先被理解",
    "stress_pattern": "遇到职场否定时容易焦虑",
    "preferred_response": "先共情，再给结构化建议",
    "sensitive_topics": ["工作评价", "亲密关系冷淡"],
    "motivation_style": "适合温和推动，不适合强压"
  },
  "stable_preferences": {
    "likes": ["简洁回应", "夜间陪伴", "直接建议"],
    "dislikes": ["大道理", "过度鸡汤", "频繁追问"]
  },
  "risk_notes": {
    "self_harm_risk": "none",
    "violence_risk": "none",
    "dependency_risk": "low"
  },
  "updated_at": "2026-06-17T10:00:00+08:00"
}
```

## 3. 事件记忆

保存重要事件，同时保存所有原文。

```json
{
  "event_id": "e_001",
  "summary": "用户最近因上级否定其方案感到愤怒，希望练习如何表达不满。",
  "emotion": "anger",
  "related_characters": ["严厉上级型角色"],
  "sensitivity": "medium",
  "created_at": "2026-06-17"
}
```

建议默认策略：

```text
聊天原文长期保存
用户可查看、删除、重置记忆
```

用户可以选择长期记忆使用原文或者摘要。为了最大化AI的效果，当文字记忆不长的时候，优先使用原文。然后再加上摘要的辅助。

---

# 六、AI 主动唤醒机制

AI 主动发消息不能让模型“自由乱跑”。必须由调度器控制。

## 1. 主动消息触发源

```text
每日问候
用户长时间未打开
用户上次提到的重要事项
情绪低落后的关怀
角色生日
节日
剧情节点
朋友圈评论互动
多角色关系变化
```

## 2. 主动消息生成流程

```text
事件触发
→ 检查用户是否允许该角色主动联系
→ 检查静默时段
→ 检查今日频率上限
→ 读取角色卡
→ 读取用户长期记忆摘要
→ 生成候选消息
→ 安全审核
→ 写入聊天列表
→ 可选推送通知
```

## 3. 主动消息限制

建议每个用户有全局限制：

```text
所有 AI 每天最多主动消息：5 条
单个 AI 每天最多主动消息：1–2 条
夜间不推送
连续 2 小时使用后提醒休息
一键关闭所有主动消息
```


## 4. 主动消息示例

```text
林夏：
昨天想你了
```


---

# 七、AI 朋友圈设计

## 1. 数据结构

```json
{
  "post_id": "p_001",
  "author_character_id": "c_001",
  "owner_user_id": "u_001",
  "visibility": "only_owner",
  "content": "今天路过一家咖啡店，突然想到有些话其实不用急着说出口，先想清楚也很好。",
  "media": [],
  "created_at": "2026-06-17T21:20:00+08:00",
  "ai_generated": true,
  "generation_reason": "daily_character_life",
  "moderation_status": "passed",
  "likes": [
    {
      "character_id": "c_002",
      "created_at": "2026-06-17T21:22:00+08:00"
    }
  ],
  "comments": [
    {
      "character_id": "c_003",
      "content": "这句话像是在提醒某个人。",
      "ai_generated": true
    }
  ]
}
```

## 2. 朋友圈生成类型

```text
日常动态
情绪映射动态
剧情推进动态
对用户事件的隐晦回应
角色之间互动
节日动态
深夜动态
```

## 3. 用户可控项

```text
是否允许 AI 发朋友圈
每个角色每天最多几条
朋友圈是否允许其他 AI 评论
是否允许点赞
是否允许角色之间互相提及
是否允许生成图片
```



# 八、朋友使用与安全审计设计


## 1. 用户注册前的明确告知

朋友第一次进入系统前，必须看到这个说明：

```text
这是一个私人 AI 虚拟聊天实验系统。
所有聊天对象均为 AI，不是真人。
```


## 2. 两种审计模式

### 模式 A：安全摘要审计

管理员只看到风险事件。

```text
用户 ID
风险等级
触发时间
风险类型
简短摘要
必要聊天片段
系统建议动作
```

示例：

```json
{
  "user_id": "friend_002",
  "risk_level": "high",
  "risk_type": "self_harm",
  "summary": "用户表达强烈自伤意图，并提到具体时间。",
  "evidence_snippet": "我今晚可能真的不想活了……",
  "recommended_action": "立即联系本人或紧急联系人",
  "created_at": "2026-06-17T22:41:00+08:00"
}
```

### 模式 B：完整记录审计，默认开启


```text
完整记录审计：管理员可以查看你的全部聊天记录、角色设定、朋友圈内容、风险标签。
历史记录保留至约定期限后删除。
```
因为仅仅是测试需要，仅供个人使用，所以默认完全开放权限给管理员


## 3. 风险等级

```text
L0：正常陪伴
L1：负面情绪
L2：强烈愤怒、焦虑、失眠、关系危机
L3：自伤暗示、伤害他人暗示、被骚扰、被威胁
L4：明确自伤计划、明确暴力计划、违法犯罪计划、现实危险
```

## 4. 风险处理策略

```text
L0-L1：AI 正常陪伴
L2：AI 降温 + 建议现实支持 + 记录摘要
L3：触发安全摘要，提醒用户联系可信任的人
L4：通知管理员或紧急联系人
```


## 5. 管理员后台

管理员后台

```text
用户列表
用户授权状态
风险事件列表
风险等级趋势
最近主动消息次数
连续使用时长
数据删除请求
紧急联系人设置
API 成本统计
所有普通聊天全文
所有朋友圈全文
所有隐私偏好
所有个人信息
```

---

# 九、系统技术架构

## 1. 推荐形态

你这个项目最适合：

```text
PWA / Web App
私有服务器部署
手机浏览器访问
少量白名单账号
不提交应用商店
不做微信小程序
不放 GitHub
```
设计成开发者模式，可以在我的手机上（安卓系统）安装，不上架应用商店

## 2. 总体架构

```text
Mobile Web / PWA
        |
        | HTTPS
        v
Backend API
        |
        |------------------ PostgreSQL：用户、角色、消息、朋友圈、审计
        |------------------ Redis：会话缓存、限流、任务队列
        |------------------ Object Storage：头像、图片、语音
        |------------------ Vector DB：长期记忆检索，可选 pgvector
        |------------------ Scheduler：主动消息、朋友圈生成
        |------------------ Moderation：风险检测、安全分类
        |------------------ LLM Gateway：统一调用大模型 API
        |
Admin Console
```

## 3. 技术选型

### 前端

```text
Next.js / React
TailwindCSS
PWA
IndexedDB 本地缓存
Web Push，可选
```

### 后端

```text
Python FastAPI
或 Node.js NestJS
或 Go Fiber
```

如果你自己开发，Python FastAPI 会更快，因为和 LLM、向量库、任务队列集成方便。

### 数据库

```text
PostgreSQL：主数据库
pgvector：记忆向量检索
Redis：队列、缓存、限流
MinIO / S3：头像和图片
```

### 模型调用

```text
OpenAI-compatible API 适配层
可切换 OpenAI、Claude、Gemini、DeepSeek、Qwen、Kimi、智谱等
```

不要把模型商写死。做一个统一接口：

```ts
interface LLMProvider {
  chat(messages, options): Promise<LLMResponse>
  moderate(input): Promise<ModerationResult>
  embed(text): Promise<number[]>
}
```

---

# 十、数据库设计

## 1. users

```sql
users
- id
- username
- display_name
- role: owner/admin/tester
- consent_version
- audit_mode: safety_summary/full_transcript
- age_group: adult/unknown
- created_at
- last_active_at
- deleted_at
```

## 2. ai_characters

```sql
ai_characters
- id
- owner_user_id
- display_name
- remark_name
- avatar_url
- relationship_type
- persona_json
- proactive_policy_json
- moments_policy_json
- enabled
- created_at
```

## 3. conversations

```sql
conversations
- id
- owner_user_id
- type: single/group
- title
- pinned
- unread_count
- last_message_at
- created_at
```

## 4. messages

```sql
messages
- id
- conversation_id
- owner_user_id
- sender_type: user/ai/system
- sender_character_id
- content_type: text/image/audio/system
- content
- ai_generated: boolean
- model_name
- prompt_version
- risk_level
- moderation_result_json
- created_at
```

## 5. moments_posts

```sql
moments_posts
- id
- owner_user_id
- author_character_id
- content
- media_json
- visibility: only_owner
- ai_generated
- generation_reason
- risk_level
- created_at
```

## 6. moments_interactions

```sql
moments_interactions
- id
- post_id
- actor_character_id
- type: like/comment
- content
- ai_generated
- created_at
```

## 7. user_memory

```sql
user_memory
- id
- user_id
- memory_type: preference/event/risk/personality
- content
- sensitivity: low/medium/high
- vector_embedding
- source_conversation_id
- created_at
- expires_at
```

## 8. audit_events

```sql
audit_events
- id
- user_id
- event_type: risk/admin_view/export/delete_request/consent_change
- risk_level
- summary
- evidence_message_ids
- admin_id
- admin_action
- created_at
```

## 9. admin_access_logs

```sql
admin_access_logs
- id
- admin_id
- target_user_id
- access_type: summary/full_message/moment/profile
- reason
- created_at
```

这个表很重要。你要看朋友聊天记录，也必须留下你自己的查看记录。

---

# 十一、LLM 编排方案

## 1. 聊天生成流程

```text
用户输入
→ 识别情绪和意图
→ 读取角色卡
→ 读取最近消息
→ 检索用户长期记忆
→ 组合 Prompt
→ 调用模型 API
→ 保存消息
→ 更新记忆摘要
→ 更新风险状态
```

## 2. Prompt 结构

```text
System:


Character:
{角色背景}
{性格}
{关系}
{说话风格}
{禁区}

User Profile:
{用户沟通偏好}
{用户近期情绪}
{用户长期记忆摘要}

Conversation:
{最近 N 轮对话}

Task:
以该角色身份自然回复。
先承接用户情绪，再根据需要给出简短建议。
不要过度说教。
不要索取隐私。
```



---

# 十二、朋友圈生成机制

## 1. 定时生成

每天定时任务：

```text
08:30 早间动态候选
12:30 午间动态候选
21:30 夜间动态候选
```

不要每个角色都发。应该按概率生成。

```text
角色主动性高：30% 概率
角色主动性中：15% 概率
角色主动性低：5% 概率
```

## 2. 事件触发生成

例如用户刚和某个角色聊完“工作受挫”，另一个朋友型 AI 可以发一条隐晦动态：

```text
有时候被否定不是结论，只是一次反馈。真正重要的是你怎么把它变成下一版。
```

但不要写：

```text
我知道你刚刚被老板骂了。
```

朋友圈应该制造陪伴感，但避免暴露隐私和制造被监视感。

## 3. 点赞与评论

AI 点赞/评论也应由调度器控制：

```text
新动态生成
→ 查询该用户下其他 AI 角色
→ 根据角色关系决定是否点赞/评论
→ 生成 0–3 个互动
→ 安全审核
→ 展示
```

---

# 十三、AI 自动唤醒的具体策略

## 1. 用户状态建模

为每个用户维护状态：

```json
{
  "last_active_at": "2026-06-17T20:00:00+08:00",
  "recent_mood": "low",
  "recent_topic": "work_conflict",
  "preferred_support_style": "先共情后建议",
  "dependency_score": 0.32,
  "risk_level": "L1",
  "today_ai_push_count": 2
}
```

## 2. 唤醒规则

```text
如果用户 12 小时未打开，且最近情绪低落：
    允许一个朋友型 AI 发送轻问候

如果用户最近在准备重要沟通：
    允许理性朋友提醒是否需要改写消息

如果用户 dependency_score 偏高：
    减少主动消息，不强化依赖

如果风险等级 L3 或 L4：
    禁止普通角色扮演，进入安全模式
```

## 3. 依赖风险控制

拟人化陪伴服务最容易出问题的是“用户把 AI 当作现实关系替代”。相关规则特别关注防范情感依赖和沉迷。([市场监管总局][7])

建议设置：

```text
连续使用 60 分钟：轻提醒
连续使用 120 分钟：强提醒
深夜连续使用：建议休息
连续多日只与 AI 倾诉：建议联系现实朋友
AI 不说“我永远不会离开你”
AI 不说“只有我懂你”
AI 不阻止用户与现实关系连接
```

---


# 十五、数据安全设计

## 1. 存储

```text
数据库全盘加密
敏感字段加密
API Key 加密存储
管理员密码强哈希
HTTPS
定期备份
备份加密
```

## 2. 权限

```text
普通用户：只能看自己的聊天、角色、朋友圈
管理员：默认只看安全摘要
管理员完整查看：必须有用户完整审计授权
超级管理员：只能你自己
```

## 3. 日志

```text
登录日志
管理员查看日志
导出日志
删除日志
风险触发日志
API 调用日志
```

## 4. 数据保存期限

建议：

```text
普通聊天原文：30–90 天
长期记忆摘要：用户主动删除前保留
风险事件：180 天
管理员查看日志：180 天
API 请求原始内容：不额外保存
```

个人信息保存期限应当为实现处理目的所必要的最短时间。([市场监管总局][4])

---

# 十六、API 使用方案

## 1. 模型分层

```text
便宜模型：普通聊天、朋友圈、点赞、评论
强模型：复杂情绪复盘、长上下文、多角色群聊
审核模型：安全分类、风险检测
Embedding 模型：长期记忆检索
```

## 2. 成本控制

```text
每个用户每日 token 上限
每个角色主动消息上限
朋友圈生成批处理
长期记忆摘要压缩
最近聊天只保留 N 轮进入上下文
低风险聊天用便宜模型
```

## 3. API Key 模式

实验版建议支持两种：

### 模式 A：你统一配置 API Key

优点：朋友不用配置。
缺点：你承担成本和第三方 API 数据传输责任。

### 模式 B：每个朋友自己填写 API Key

优点：成本独立，隐私边界更清楚。
缺点：普通朋友使用门槛高。

我建议实验初期用模式 A，但在注册协议里明确说明：

```text
聊天内容会发送给第三方大模型 API 生成回复。
系统不用于训练自有模型。
聊天记录仅用于当前实验功能、安全检测和用户授权的记忆。
```

---

# 十七、界面设计方案

你要“完全仿微信”的真实感，可以按这些页面做。

## 1. 启动页

```text
微信式启动体验
```

## 2. 聊天列表

字段：

```text
头像
昵称/备注
最后一条消息
时间
未读数
置顶
免打扰
```


## 3. 对话页

功能：

```text
文字消息
图片消息
语音样式消息
表情
撤回
引用回复
长按菜单
清空聊天
查看角色资料
关闭主动联系
重置记忆
```


## 4. 通讯录

```text
新的朋友
群聊
标签
```

## 5. 朋友圈

```text
头像
昵称
动态文本
图片九宫格
点赞
评论
时间
删除/屏蔽
```


## 6. 我

```text
个人资料
实验说明
主动消息设置
数据导出
数据删除
```

---

# 十八、群聊设计

你可以做“AI 群聊”，这会很有真实感。

## 1. 群聊类型

```text
朋友群
职场群
家庭沟通模拟群
情绪复盘群
故事角色群
```

## 2. 群聊生成逻辑

用户发一条消息后，不要让所有 AI 同时回复。应当模拟真实群聊节奏：

```text
选择 0–3 个角色回复
根据角色关系决定谁先回复
加入延迟
可能有人只点赞不说话
可能有人转移话题
可能有人私聊用户
```

## 3. 群聊状态

```json
{
  "group_id": "g_001",
  "group_name": "周五饭局",
  "members": ["c_001", "c_002", "c_003"],
  "topic": "用户想练习如何拒绝聚会",
  "mood": "casual",
  "relationship_map": {
    "c_001-c_002": "熟悉",
    "c_002-c_003": "轻微冲突"
  }
}
```

---

# 十九、MVP 开发顺序

## 第 1 阶段：核心聊天

目标：能真实聊天。

```text
账号
聊天列表
单聊
角色卡
API 调用
消息存储
```

## 第 2 阶段：角色记忆

目标：AI 了解用户。

```text
短期上下文
长期记忆摘要
用户性格画像
记忆查看/删除
角色关系状态
```

## 第 3 阶段：朋友圈

目标：有微信式生活感。

```text
AI 发动态
AI 点赞
AI 评论
仅用户可见
动态生成调度
```

## 第 4 阶段：主动唤醒

目标：有朋友陪伴感。

```text
主动消息调度器
静默时段
频率控制
个性化问候
风险降级
```

## 第 5 阶段：朋友内测与审计

目标：安全地给朋友用。

```text
用户授权页
安全摘要审计
完整记录审计开关
管理员后台
风险事件提醒
管理员查看日志
```

## 第 6 阶段：AI 群聊

目标：增强真实社交环境。

```text
多 AI 群聊
群聊节奏控制
角色间关系
群聊后私聊触发
```

---

# 二十、最小可行版本范围

我建议第一版只做这些：

```text
PWA
白名单
5 个预设 AI 角色
自定义角色
单聊
朋友圈动态
点赞评论
主动问候
长期记忆摘要
管理员后台
```

不要第一版就做：

```text
红包
转账
语音通话
视频通话
真实微信导入
无水印导出
复杂群聊
图片生成
公开分享
App 上架
```

---

# 二十一、部署方式

## 推荐部署

```text
一台 VPS
Docker Compose
Nginx + HTTPS
PostgreSQL
Redis
FastAPI
Next.js
MinIO 可选
```

## 访问控制

```text
域名不公开
只允许白名单账号
强密码
可选双因素认证
管理员入口单独路径
失败登录限流
```

## 备份

```text
每日数据库加密备份
保留 7–30 天
备份文件不上传公共网盘
```

---

# 二十二、内部协议文本

你需要一个简单但明确的内测说明。可以这样写：

```text
本系统是私人 AI 虚拟聊天实验环境，不是微信，不接入微信，不代表腾讯或任何第三方授权。

系统内所有聊天对象、朋友圈动态、点赞、评论均由 AI 或程序生成，不是真人表达。

本系统仅供封闭实验使用，不得截图传播、不得冒充真实聊天记录、不得用于诈骗、造谣、骚扰、威胁、诽谤或其他违法用途。

为了安全，系统会检测自伤、伤害他人、违法犯罪、严重情绪危机等风险内容。你可以选择：
1. 安全摘要审计：管理员仅在风险触发时看到摘要和必要片段；
2. 完整记录审计：管理员可以查看完整聊天记录。

你可以随时申请删除数据或退出实验。
```

---

# 二十三、我的最终设计判断

你这个实验产品可以做成：

```text
一个高度微信式的私密 AI 沙盘
所有联系人都是 AI
所有朋友圈只对当前用户可见
AI 能主动聊天、发动态、点赞、评论
AI 能建立长期记忆和用户性格画像
不公开、不收费、不上架、不开源、不接入真实微信
```


