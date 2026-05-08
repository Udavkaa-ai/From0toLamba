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
  {
    id: 'channel_clicermania',
    channelUsername: 'clicermania',
    channelTitle: 'Летопись девицы Кликерманки',
    channelLink: 'https://t.me/clicermania',
    description: 'Летопись об играх заморских',
    rewardRubles: 50,
  },
  {
    id: 'channel_cryptomaxbablo',
    channelUsername: 'cryptomaxbablo',
    channelTitle: 'Лев среди Князей',
    channelLink: 'https://t.me/cryptomaxbablo',
    description: 'Все способы заработать в правильных делах',
    rewardRubles: 50,
  },
  {
    id: 'channel_game_gain',
    channelUsername: 'Game_Gain',
    channelTitle: 'Играй и зарабатывай',
    channelLink: 'https://t.me/Game_Gain',
    description: 'Меч в цифровой империи',
    rewardRubles: 50,
  },
  {
    id: 'channel_o_my_gift',
    channelUsername: 'o_my_gift',
    channelTitle: 'Ох, вы ж мои подарочки!',
    channelLink: 'https://t.me/o_my_gift',
    description: 'О дарах для лучших друзей',
    rewardRubles: 50,
  },
  {
    id: 'channel_krypto_mechta',
    channelUsername: 'krypto_mechta',
    channelTitle: 'Мечтания о волшебных монетах',
    channelLink: 'https://t.me/krypto_mechta',
    description: 'Записи в книгах магических о деньгах и играх',
    rewardRubles: 50,
  },
]
