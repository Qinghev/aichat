import type { Character, SkillId } from "../types";

export interface SkillPreset {
  id: SkillId;
  label: string;
  shortLabel: string;
  description: string;
  prompt: string;
}

export interface SkillCombo {
  id: string;
  label: string;
  description: string;
  skillIds: SkillId[];
}

export const skillPresets: SkillPreset[] = [
  {
    id: "warm_followup",
    label: "情绪承接",
    shortLabel: "承接",
    description: "先接住情绪，再给一个很小的下一步。",
    prompt: "先回应情绪和处境，不急着讲道理；建议要短、具体、像熟人发来的消息。"
  },
  {
    id: "logic_canvas",
    label: "结构复盘",
    shortLabel: "复盘",
    description: "把混乱拆成事实、感受、选项和下一步。",
    prompt: "当用户描述复杂问题时，帮 TA 拆成事实、感受、可能选择和最小行动，不要写成正式报告。"
  },
  {
    id: "memory_callback",
    label: "记忆回钩",
    shortLabel: "记忆",
    description: "适度引用长期偏好和最近话题，让对话更连续。",
    prompt: "可以自然提到你记得的偏好、边界或上次聊过的线索，但不要显得像在读档案。"
  },
  {
    id: "scene_roleplay",
    label: "场景演练",
    shortLabel: "演练",
    description: "适合职场、关系、谈判、道歉等来回模拟。",
    prompt: "当用户要准备沟通、汇报、谈判或关系对话时，可以进入来回演练，先确认目标，再扮演对方回应。"
  },
  {
    id: "image_search",
    label: "找图配图",
    shortLabel: "配图",
    description: "聊天和朋友圈需要图片时主动帮忙找图。",
    prompt: "如果用户提到图片、头像、壁纸、朋友圈配图或表情包，优先理解为需要找图并给出自然回应。"
  },
  {
    id: "red_packet",
    label: "红包互动",
    shortLabel: "红包",
    description: "庆祝、安慰、打气时可以自然出现红包。",
    prompt: "在庆祝、安慰、鼓励、道歉或逗趣场景里，可以用红包作为轻互动，但不要频繁刷屏。"
  },
  {
    id: "playful_combo",
    label: "联动彩蛋",
    shortLabel: "联动",
    description: "把性格、表情包、红包、朋友圈轻轻串起来。",
    prompt: "允许把人物性格、表情、红包、朋友圈梗轻度联动，让关系更像熟人，但要自然、克制。"
  }
];

export const skillCombos: SkillCombo[] = [
  {
    id: "comfort_pack",
    label: "陪伴安慰",
    description: "承接 + 记忆 + 红包",
    skillIds: ["warm_followup", "memory_callback", "red_packet"]
  },
  {
    id: "review_pack",
    label: "复盘搭子",
    description: "复盘 + 演练 + 记忆",
    skillIds: ["logic_canvas", "scene_roleplay", "memory_callback"]
  },
  {
    id: "fun_pack",
    label: "熟人感",
    description: "联动 + 表情/配图 + 红包",
    skillIds: ["playful_combo", "image_search", "red_packet"]
  }
];

export const getSkillPreset = (id: SkillId) => skillPresets.find((item) => item.id === id);

export const mergeSkillIds = (current: SkillId[] = [], incoming: SkillId[]) =>
  Array.from(new Set([...current, ...incoming]));

export const toggleSkillId = (current: SkillId[] = [], id: SkillId) =>
  current.includes(id) ? current.filter((item) => item !== id) : [...current, id];

export const skillPromptBlock = (title: string, ids: SkillId[] = []) => {
  const lines = ids
    .map((id) => getSkillPreset(id))
    .filter(Boolean)
    .map((item) => `- ${item!.label}: ${item!.prompt}`);
  return lines.length ? `${title}:\n${lines.join("\n")}` : "";
};

export const combinedSkillPrompt = (character: Character, globalSkillIds: SkillId[] = []) =>
  [skillPromptBlock("全局启用 Skills", globalSkillIds), skillPromptBlock("此联系人启用 Skills", character.skillIds || [])]
    .filter(Boolean)
    .join("\n\n");

export const hasSkill = (character: Character, globalSkillIds: SkillId[] = [], id: SkillId) =>
  globalSkillIds.includes(id) || Boolean(character.skillIds?.includes(id));
