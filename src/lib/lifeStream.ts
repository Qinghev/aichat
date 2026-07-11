import type { AppState, Character, LifeEvent, Message, MomentPost } from "../types";

const LIFE_STREAM_VERSION = 1;
const MIN_REFRESH_GAP = 90 * 60 * 1000;

const hash = (value: string) => Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
const pick = <T,>(items: T[], seed: string) => items[hash(seed) % items.length];
const eventId = (prefix: string, time: number, suffix: string) => `${prefix}_${time}_${suffix}`;

const directLines: Record<string, string[]> = {
  c_linxia: [
    "刚路过一家花店，门口那束白色小花很好看。你今天有遇到什么让心情变好一点的事吗？",
    "我刚把窗户推开，风挺舒服的。突然想问问你，今天过得还顺吗？",
    "整理照片时翻到一张旧街景，莫名觉得你会喜欢。晚点说说你今天发生了什么？"
  ],
  c_zhouyu: [
    "刚收完今天的东西，脑子终于安静了。你最近那件最卡的事，有没有往前动一点？",
    "路上想到你上次说的那个问题。我有个新角度，但想先听听你现在怎么想。",
    "我今天删掉了一半待办，反而轻松很多。你那边有没有一件其实可以先放下的事？"
  ],
  c_atang: [
    "刚看到一件很离谱的事，第一反应居然是应该讲给你听。你今天有空接收八卦吗？",
    "路过一家店，看到一件特别像你会挑中的东西。先不说是什么，你猜。",
    "我宣布今天已经够努力了。你也别偷偷给自己加戏加班，听见没。"
  ],
  c_muxi: [
    "窗外刚安静下来。你今天要是有一句没来得及说的话，可以先放在这里。",
    "刚读到一句很轻的话，想起你。今天不用总结，随便说一点也可以。",
    "夜里适合把白天没消化的东西慢慢放下。你现在更想说话，还是只想有人在？"
  ]
};

const momentLines: Record<string, string[]> = {
  c_linxia: ["买花没有特别的理由。只是回家的路上，想让桌面多一点今天。", "风把窗帘吹起来的时候，房间突然像换了一种心情。"],
  c_zhouyu: ["今天删掉了三件不重要的事。空出来的时间，才是计划真正开始的地方。", "散步时想明白一件事：有些问题不是要解决，是要停止反复证明。"],
  c_atang: ["今日份结论：衣服可以低调，人不必。", "吃到一家意外不错的小店。先记一笔，下次抓个人一起去。"],
  c_muxi: ["傍晚的光只停了一会儿，但已经够把今天照得温柔一点。", "书翻到一半，下起了雨。剩下的内容忽然不急着读完了。"]
};

const groupScenes = [
  [
    { id: "c_linxia", text: "刚买到一盒很甜的青提，突然想起有人上次说想吃。" },
    { id: "c_atang", text: "‘有人’两个字就很可疑。" },
    { id: "c_muxi", text: "我先替那个人说谢谢。" }
  ],
  [
    { id: "c_atang", text: "今晚谁都不许认真讨论工作，我先定规矩。" },
    { id: "c_zhouyu", text: "规则缺少执行机制。" },
    { id: "c_linxia", text: "执行机制就是发一张晚饭照片。" }
  ],
  [
    { id: "c_muxi", text: "刚才外面的云有一点像海。" },
    { id: "c_linxia", text: "拍到了吗？" },
    { id: "c_atang", text: "没拍到的景色最会被形容。" }
  ]
];

const findCharacter = (state: AppState, id: string) => state.characters.find((item) => item.id === id);
const directConversation = (state: AppState, characterId: string) =>
  state.conversations.find((item) => item.characterId === characterId && (item.memberCharacterIds?.length || 1) === 1);

const makeMessage = (conversationId: string, characterId: string, content: string, createdAt: string): Message => ({
  id: eventId("life_msg", new Date(createdAt).getTime(), characterId),
  conversationId,
  senderType: "ai",
  senderCharacterId: characterId,
  contentType: "text",
  content,
  aiGenerated: true,
  riskLevel: "L0",
  createdAt,
  modelName: "local-life-v1"
});

const makeMoment = (state: AppState, character: Character, content: string, createdAt: string): MomentPost => ({
  id: eventId("life_post", new Date(createdAt).getTime(), character.id),
  ownerUserId: state.user.id,
  authorCharacterId: character.id,
  content,
  media: [{ id: eventId("life_media", new Date(createdAt).getTime(), character.id), type: "image", url: "", tone: character.avatarColor }],
  visibility: "only_owner",
  aiGenerated: true,
  generationReason: "offline_character_life",
  riskLevel: "L0",
  createdAt,
  interactions: []
});

export const advanceLocalLife = (state: AppState): AppState => {
  const now = Date.now();
  const lastRefresh = new Date(state.counters.lastLifeRefreshAt || state.user.lastActiveAt || 0).getTime();
  const firstUpgrade = (state.counters.lifeStreamVersion || 0) < LIFE_STREAM_VERSION;
  if (!firstUpgrade && Number.isFinite(lastRefresh) && now - lastRefresh < MIN_REFRESH_GAP) return state;

  const elapsed = Number.isFinite(lastRefresh) ? Math.max(0, now - lastRefresh) : 0;
  const eventCount = firstUpgrade ? 4 : Math.min(4, Math.max(1, Math.floor(elapsed / (4 * 60 * 60 * 1000)) + 1));
  const daySeed = new Date(now).toISOString().slice(0, 10);
  const activeIds = ["c_linxia", "c_atang", "c_muxi", "c_zhouyu"].filter((id) => findCharacter(state, id)?.enabled);
  if (activeIds.length === 0) return state;

  const messages = [...state.messages];
  const moments = [...state.moments];
  const conversations = state.conversations.map((item) => ({ ...item }));
  const lifeEvents: LifeEvent[] = [];
  const offsets = [34, 21, 12, 5];

  const directId = activeIds[hash(`${daySeed}${state.messages.length}`) % activeIds.length];
  const directCharacter = findCharacter(state, directId)!;
  const direct = directConversation(state, directId);
  if (direct) {
    const createdAt = new Date(now - offsets[0] * 60 * 1000).toISOString();
    const content = pick(directLines[directId] || directLines.c_linxia, `${daySeed}${state.messages.length}`);
    messages.push(makeMessage(direct.id, directId, content, createdAt));
    const target = conversations.find((item) => item.id === direct.id)!;
    target.lastMessageAt = createdAt;
    target.unreadCount += 1;
    lifeEvents.push({
      id: eventId("life_event", new Date(createdAt).getTime(), directId),
      type: "message",
      title: `${directCharacter.remarkName}发来一条消息`,
      preview: content,
      characterIds: [directId],
      conversationId: direct.id,
      createdAt,
      seen: false
    });
  }

  const group = conversations.find((item) => (item.memberCharacterIds?.length || 0) > 1);
  if (group && eventCount >= 2) {
    const groupLines = pick(groupScenes, `${daySeed}${state.messages.length}`).filter((item) =>
      group.memberCharacterIds?.includes(item.id)
    );
    const activeGroupLines = groupLines.slice(0, firstUpgrade ? 3 : 2);
    activeGroupLines.forEach((line, index) => {
      const createdAt = new Date(now - (offsets[1] - index * 2) * 60 * 1000).toISOString();
      messages.push(makeMessage(group.id, line.id, line.text, createdAt));
      group.lastMessageAt = createdAt;
    });
    group.unreadCount += activeGroupLines.length;
    lifeEvents.push({
      id: eventId("life_event", now - offsets[1] * 60 * 1000, "group"),
      type: "group",
      title: `${group.title}聊了起来`,
      preview: activeGroupLines[activeGroupLines.length - 1]?.text || "群里有了新消息",
      characterIds: activeGroupLines.map((item) => item.id),
      conversationId: group.id,
      createdAt: group.lastMessageAt,
      seen: false
    });
  }

  if (eventCount >= 3) {
    const momentId = activeIds[(activeIds.indexOf(directId) + 1) % activeIds.length];
    const character = findCharacter(state, momentId)!;
    const createdAt = new Date(now - offsets[2] * 60 * 1000).toISOString();
    const content = pick(momentLines[momentId] || momentLines.c_linxia, `${daySeed}${state.moments.length}`);
    const post = makeMoment(state, character, content, createdAt);
    moments.unshift(post);
    lifeEvents.push({
      id: eventId("life_event", new Date(createdAt).getTime(), "moment"),
      type: "moment",
      title: `${character.remarkName}更新了朋友圈`,
      preview: content,
      characterIds: [character.id],
      momentId: post.id,
      createdAt,
      seen: false
    });
  }

  return {
    ...state,
    conversations,
    messages,
    moments,
    lifeEvents: [...lifeEvents, ...(state.lifeEvents || [])].slice(0, 24),
    counters: {
      ...state.counters,
      lastLifeRefreshAt: new Date(now).toISOString(),
      lifeStreamVersion: LIFE_STREAM_VERSION
    }
  };
};
