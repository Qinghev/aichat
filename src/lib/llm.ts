import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { classifyRisk } from "./localAi";
import type { Character, Message, RiskLevel, Settings } from "../types";

export interface LlmModerationResult {
  riskLevel: RiskLevel;
  summary: string;
}

export interface LlmChatInput {
  character: Character;
  userMessage: string;
  recentMessages: Message[];
  memorySummary: string;
  globalSkillPrompt?: string;
}

export interface LlmChatResult {
  content: string;
  modelName: string;
  riskLevel: RiskLevel;
}

export interface LlmProvider {
  chat(input: LlmChatInput): Promise<LlmChatResult>;
  moderate(input: string): Promise<LlmModerationResult>;
}

type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const chatCompletionsUrl = (baseUrl?: string) => {
  const base = trimTrailingSlash(baseUrl || "https://api.x.ai/v1");
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
};

const optionalPromptBlock = (title: string, content?: string) => {
  const value = content?.trim();
  return value ? `\n${title}：\n${value}\n` : "";
};

const buildPersonaPrompt = (character: Character, memorySummary: string, globalSkillPrompt?: string) => `你正在以手机联系人「${character.remarkName}」的口吻和用户聊天。
不要在回复里主动提到模型、生成、系统提示、开发者指令或技术实现。回答要像熟人发消息，短一些，自然一些，可以分段，但不要写成说明书。

优先级：
1. 严格遵守全局 Skill。
2. 严格遵守此联系人的专属 Skill。
3. 参考联系人资料、说话风格、性格参数和长期记忆。

联系人资料：
- 昵称：${character.remarkName}
- 关系：${character.relationshipToUser}
- 类型：${character.roleType}
- 职业：${character.occupation || "未设置"}
- 地区：${character.region || "未设置"}
- 签名：${character.signature || "未设置"}
- 背景：${character.background}
- 语气：${character.speechStyle.tone}
- 口头禅：${character.speechStyle.catchphrases.join("、")}
- 性格参数：温暖 ${character.personality.warmth}/10，幽默 ${character.personality.humor}/10，主动 ${character.personality.initiative}/10，理性 ${character.personality.rationality}/10，共情 ${character.personality.emotionalSupport}/10，直接 ${character.personality.directness}/10
${optionalPromptBlock("全局 Skill", globalSkillPrompt)}${optionalPromptBlock("此联系人 Skill", character.skillPrompt)}
长期记忆摘要：
${memorySummary || "暂无"}

回复要求：
- 先回应用户刚刚说的内容，再给出下一句自然回复。
- 不要频繁追问隐私，不要连续输出很多问题。
- 不要冒充真实公众人物、真实账号或真实服务。
- 遇到现实自伤、伤害他人、医疗、法律、金融等高风险内容时，优先给现实求助和风险降低建议。`;

const toChatMessages = (input: LlmChatInput): ChatCompletionMessage[] => {
  const messages: ChatCompletionMessage[] = [
    {
      role: "system",
      content: buildPersonaPrompt(input.character, input.memorySummary, input.globalSkillPrompt)
    }
  ];

  for (const message of input.recentMessages.filter((item) => item.senderType !== "system").slice(-14)) {
    messages.push({
      role: message.senderType === "user" ? "user" : "assistant",
      content: message.content
    });
  }

  messages.push({ role: "user", content: input.userMessage });
  return messages;
};

export class OpenAICompatibleProvider implements LlmProvider {
  constructor(
    private readonly options: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    }
  ) {}

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    if (!this.options.apiKey) {
      throw new Error("OpenAI-compatible provider is not configured.");
    }

    const riskLevel = classifyRisk(input.userMessage);
    if (riskLevel === "L3" || riskLevel === "L4") {
      return {
        content:
          riskLevel === "L4"
            ? "我先暂停普通角色聊天。你刚刚说的内容可能涉及现实危险，请立刻联系身边可信任的人，或拨打当地紧急电话。如果你现在已经有具体计划或工具在身边，请先离开危险物品，到有人的地方。"
            : "我听见你现在可能很难受。先别一个人硬扛，能不能马上联系一个现实里可靠的人，或者到更安全、有人的地方？我可以继续陪你把当下这几分钟稳住。",
        modelName: "local-safety-v1",
        riskLevel
      };
    }

    const model = this.options.model || "grok-4.3";
    const url = chatCompletionsUrl(this.options.baseUrl);
    const body = {
      model,
      messages: toChatMessages(input),
      temperature: 0.8,
      max_tokens: 520
    };

    const data = await this.requestJson(url, body);
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Remote provider returned an empty response.");
    }

    return {
      content,
      modelName: model,
      riskLevel
    };
  }

  async moderate(input: string): Promise<LlmModerationResult> {
    const riskLevel = classifyRisk(input);
    return { riskLevel, summary: riskLevel === "L0" ? "正常对话" : `检测到 ${riskLevel} 风险关键词` };
  }

  private async requestJson(url: string, body: unknown): Promise<any> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.options.apiKey}`
    };

    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.request({
        method: "POST",
        url,
        headers,
        data: body,
        responseType: "json"
      });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Remote provider failed with HTTP ${response.status}.`);
      }
      return response.data;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`Remote provider failed with HTTP ${response.status}.`);
    }
    return response.json();
  }
}

export const makeConfiguredProvider = (settings: Pick<Settings, "apiKey" | "apiBaseUrl" | "apiModel">) =>
  new OpenAICompatibleProvider({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl || "https://api.x.ai/v1",
    model: settings.apiModel || "grok-4.3"
  });

export const hasConfiguredProvider = (settings: Pick<Settings, "apiKey" | "apiBaseUrl" | "apiModel">) =>
  Boolean(settings.apiKey && settings.apiBaseUrl && settings.apiModel);
