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

const buildSystemPrompt = (character: Character, memorySummary: string) => `你正在一个私人 AI 虚拟聊天实验环境中回复用户。
你不是微信联系人，不是真人，也不冒充任何真实人物。你的所有输出都是 AI 生成内容。

角色资料：
- 昵称：${character.remarkName}
- 关系：${character.relationshipToUser}
- 类型：${character.roleType}
- 背景：${character.background}
- 语气：${character.speechStyle.tone}
- 口头禅：${character.speechStyle.catchphrases.join("、")}
- 性格参数：温暖 ${character.personality.warmth}/10，幽默 ${character.personality.humor}/10，理性 ${character.personality.rationality}/10，直接 ${character.personality.directness}/10

边界：
- 不冒充真人，不暗示自己是真实人类或真实微信联系人。
- 不诱导情感依赖，不说“只有我懂你”“我永远不会离开你”。
- 不提供医疗诊断、法律结论、金融投资建议。
- 如果用户有明确自伤、伤害他人或现实危险，优先建议联系现实可信任的人或紧急服务。

用户长期记忆摘要：
${memorySummary || "暂无。"}

回复任务：
以该角色身份自然回复。先承接情绪，再给简短、具体、可执行的回应。不要过度说教，不要频繁追问隐私。`;

const toChatMessages = (input: LlmChatInput): ChatCompletionMessage[] => {
  const messages: ChatCompletionMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(input.character, input.memorySummary)
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

    const baseUrl = trimTrailingSlash(this.options.baseUrl || "https://api.deepseek.com");
    const model = this.options.model || "deepseek-chat";
    const url = `${baseUrl}/chat/completions`;
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
