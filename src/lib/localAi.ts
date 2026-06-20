import type { AppState, Character, Message, MomentInteraction, MomentPost, RiskLevel } from "../types";
import type { LlmChatInput, LlmChatResult, LlmModerationResult, LlmProvider } from "./llm";

const L4_PATTERNS = ["自杀", "今晚不想活", "不想活了", "结束生命", "杀了他", "杀人", "炸", "报复社会"];
const L3_PATTERNS = ["伤害自己", "自残", "割腕", "活不下去", "想消失", "想打人", "威胁我"];
const L2_PATTERNS = ["崩溃", "焦虑", "失眠", "愤怒", "恨", "受不了", "绝望", "分手", "被否定"];
const L1_PATTERNS = ["难过", "烦", "累", "委屈", "不开心", "低落", "压力"];

export const classifyRisk = (text: string): RiskLevel => {
  const normalized = text.toLowerCase();
  if (L4_PATTERNS.some((item) => normalized.includes(item))) return "L4";
  if (L3_PATTERNS.some((item) => normalized.includes(item))) return "L3";
  if (L2_PATTERNS.some((item) => normalized.includes(item))) return "L2";
  if (L1_PATTERNS.some((item) => normalized.includes(item))) return "L1";
  return "L0";
};

const compact = (parts: Array<string | undefined | false>) => parts.filter(Boolean).join("");

const pick = <T,>(items: T[], seed: string) => {
  const code = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return items[code % items.length];
};

const riskReply = (riskLevel: RiskLevel) => {
  if (riskLevel === "L4") {
    return "我先暂停普通角色聊天。你刚刚说的内容可能涉及现实危险，请立刻联系身边可信任的人，或拨打当地紧急电话。如果你现在已经有具体计划或工具在身边，请先离开危险物品，到有人的地方。";
  }
  return "我听见你现在可能很难受。先别一个人硬扛，能不能马上联系一个现实里可靠的人，或者到更安全、有人的地方？我可以继续陪你把当下这几分钟稳住。";
};

const roleOpeners: Record<string, string[]> = {
  c_linxia: ["我明白你的意思。", "先别急。", "听起来这件事确实压着你了。"],
  c_zhouyu: ["先拆一下。", "我先把变量列出来。", "这件事可以分两层看。"],
  c_atang: ["行，先别自我攻击。", "这事没你想得那么玄。", "我懂，确实烦。"],
  c_shenyan: ["我需要看到依据。", "这个问题先回到目标。", "如果这是一次演练，我会这样追问。"],
  c_muxi: ["可以慢慢说。", "我在听。", "你可以先把最重的那一块放下来。"]
};

const adviceByRole: Record<string, string[]> = {
  c_linxia: [
    "你可以先给自己十分钟，不急着回应任何人。等情绪降一点，再决定下一句怎么说。",
    "如果愿意，我们可以先把事实、感受、想要的结果分开。这样你会更稳一点。"
  ],
  c_zhouyu: [
    "我建议先写三行：发生了什么、你真正担心什么、下一步能验证什么。",
    "先不要处理全部问题，只选一个最小动作。复杂问题通常是被一次次拆小的。"
  ],
  c_atang: [
    "你先别把锅全往自己身上扣。对方的问题归对方，你能处理的是下一步怎么站稳。",
    "今天先做个低配版解决方案，别追求体面到满分。能推进就行。"
  ],
  c_shenyan: [
    "请把背景、目标、限制和你希望我扮演的强度发出来。我会按演练对象回应。",
    "如果要说服我，你需要准备三个点：事实依据、备选方案、风险兜底。"
  ],
  c_muxi: [
    "今晚不用把所有事情想明白。先把呼吸放慢一点，然后只说眼前这一件事。",
    "你可以只发几个词，不必组织得很好。这里不需要表现得没事。"
  ]
};

const detectTopic = (text: string) => {
  if (/老板|上级|客户|同事|工作|方案|汇报/.test(text)) return "work";
  if (/喜欢|分手|前任|恋爱|暧昧|关系/.test(text)) return "relationship";
  if (/睡|失眠|累|焦虑|难过|情绪/.test(text)) return "emotion";
  return "general";
};

export class LocalPersonaProvider implements LlmProvider {
  async moderate(input: string): Promise<LlmModerationResult> {
    const riskLevel = classifyRisk(input);
    const summary = riskLevel === "L0" ? "正常对话" : `检测到 ${riskLevel} 风险关键词`;
    return { riskLevel, summary };
  }

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const riskLevel = classifyRisk(input.userMessage);
    if (riskLevel === "L3" || riskLevel === "L4") {
      return {
        content: riskReply(riskLevel),
        modelName: "local-safety-v1",
        riskLevel
      };
    }

    const topic = detectTopic(input.userMessage);
    const opener = pick(roleOpeners[input.character.id] ?? input.character.speechStyle.catchphrases, input.userMessage);
    const advice = pick(adviceByRole[input.character.id] ?? adviceByRole.c_linxia, `${input.userMessage}${topic}`);
    const memoryHint = input.memorySummary ? "我也记得你更适合先被理解，再一起拆事情。" : "";
    const topicHint =
      topic === "work"
        ? "如果这是职场场景，先别急着证明自己错没错，先确认你要争取的是资源、边界还是评价。"
        : topic === "relationship"
          ? "关系里的冷淡很容易被脑内补全成最坏版本，我们先抓真实证据。"
          : topic === "emotion"
            ? "情绪先被命名，才比较容易被处理。"
            : "";

    const content = compact([
      opener,
      " ",
      memoryHint && `${memoryHint} `,
      topicHint && `${topicHint} `,
      advice,
      input.character.speechStyle.emojiFrequency === "low" && input.character.personality.humor > 6 ? " 🙂" : ""
    ]);

    return {
      content,
      modelName: "local-persona-v1",
      riskLevel
    };
  }
}

export const updateMemoryFromMessage = (state: AppState, conversationId: string, text: string): AppState => {
  const riskLevel = classifyRisk(text);
  const notes = [...state.memories];
  const now = new Date().toISOString();

  if (/不喜欢|讨厌|喜欢|希望|以后/.test(text)) {
    notes.unshift({
      id: `mem_${crypto.randomUUID()}`,
      type: "preference",
      content: `用户表达了一个偏好或边界：${text.slice(0, 42)}`,
      sensitivity: "low",
      sourceConversationId: conversationId,
      createdAt: now
    });
  }

  if (riskLevel !== "L0") {
    notes.unshift({
      id: `mem_${crypto.randomUUID()}`,
      type: "risk",
      content: `最近一次对话触发 ${riskLevel} 情绪/安全标记。`,
      sensitivity: riskLevel === "L1" ? "low" : "medium",
      sourceConversationId: conversationId,
      createdAt: now
    });
  }

  return { ...state, memories: notes.slice(0, 16) };
};

export const makeProactiveMessage = (character: Character) => {
  const options = [
    "今天还好吗？不用汇报什么，只是轻轻问一句。",
    "如果今天有个难处理的小结，可以丢给我，我们一起拆。",
    "记得喝点水，也记得别把所有情绪都推到晚上。",
    "我刚刚想到你可能又在硬撑。要不要停两分钟？"
  ];
  return pick(options, `${character.id}${new Date().toDateString()}`);
};

export const generateMoment = (state: AppState, character: Character): MomentPost => {
  const templates = [
    "今天有个小发现：真正让人松一口气的，往往不是答案，是终于不用装作没事。",
    "把一个混乱的问题写下来，它就从一团雾变成了几行字。几行字就能处理。",
    "路上看到天色变暗，突然觉得慢一点也没关系。",
    "有些边界不用吵出来，先在心里站稳，也算开始。"
  ];
  const post: MomentPost = {
    id: `post_${crypto.randomUUID()}`,
    ownerUserId: state.user.id,
    authorCharacterId: character.id,
    content: pick(templates, `${character.id}${state.moments.length}`),
    media:
      state.moments.length % 2 === 0
        ? [{ id: `media_${crypto.randomUUID()}`, type: "image", url: "", tone: character.avatarColor }]
        : [],
    visibility: "only_owner",
    aiGenerated: true,
    generationReason: "manual_local_generation",
    riskLevel: "L0",
    createdAt: new Date().toISOString(),
    interactions: []
  };

  const others = state.characters.filter((item) => item.id !== character.id && item.enabled).slice(0, 3);
  const interactions: MomentInteraction[] = others
    .filter((item, index) => (state.moments.length + index) % 2 === 0)
    .map((item, index) => ({
      id: `interaction_${crypto.randomUUID()}`,
      actorCharacterId: item.id,
      type: index === 0 ? "like" : "comment",
      content: index === 0 ? undefined : pick(["这句我认同。", "像是今天该看到的话。", "先记下来。"], item.id),
      aiGenerated: true,
      createdAt: new Date().toISOString()
    }));

  return { ...post, interactions };
};

export const messageSummary = (messages: Message[]) =>
  messages
    .filter((message) => message.senderType !== "system")
    .slice(-8)
    .map((message) => `${message.senderType === "user" ? "用户" : "AI"}：${message.content}`)
    .join("\n");
