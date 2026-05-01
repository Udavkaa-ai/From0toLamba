export interface ChannelTask {
  id: string
  channelUsername: string   // @username без @
  channelTitle: string
  channelLink: string       // https://t.me/username
  description: string
  rewardRubles: number
}

// Добавляй сюда каналы партнёров — каждая запись порождает одноразовую награду.
// Бот должен быть администратором канала, чтобы getChatMember работал корректно.
export const CHANNEL_TASKS: ChannelTask[] = [
  {
    id: 'channel_vknyazi_official',
    channelUsername: 'vknyazi_izgryazi',
    channelTitle: 'Из грязи в князи',
    channelLink: 'https://t.me/vknyazi_izgryazi',
    description: 'Официальный канал игры — новости и обновления',
    rewardRubles: 50,
  },
  {
    id: 'channel_signet_ring',
    channelUsername: 'ssignet_ring',
    channelTitle: 'Драгоценная печатка',
    channelLink: 'https://t.me/ssignet_ring',
    description: 'Канал о редких находках и коллекционировании',
    rewardRubles: 50,
  },
]
