import type { Signal, Settings } from '../../shared/types'

export type FilterConfig = Settings['filters']

const MESSAGE_KINDS: Signal['kind'][] = ['mention', 'dm', 'email']

// Senders that are almost never a person.
const BOT_SENDER = /(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer-daemon|notifications?@|bot\b)/i

// Messages that carry no information on their own.
const ACKNOWLEDGEMENT =
  /^(ok|okay|oki|vale|dale|listo|gracias|muchas gracias|thanks|thank you|thx|ty|👍|🙏|✅)[\s.!¡]*$/i
const REACTION = /(reaccion[oó] con|reacted to|ha reaccionado|added a reaction)/i

const includesAny = (value: string | undefined, needles: string[]): boolean => {
  if (!value) return false
  const v = value.toLowerCase()
  return needles.some((n) => n.trim() !== '' && v.includes(n.toLowerCase()))
}

// Tasks and meetings are structured data and are never filtered; only messages are.
export function shouldKeep(signal: Signal, config: FilterConfig): boolean {
  if (!MESSAGE_KINDS.includes(signal.kind)) return true
  if (signal.isBot) return false
  if (signal.sender && BOT_SENDER.test(signal.sender)) return false
  if (includesAny(signal.sender, config.ignoredSenders)) return false
  if (includesAny(signal.channel, config.mutedChannels)) return false

  const text = signal.title.trim()
  if (text.length < config.minLength) return false
  if (ACKNOWLEDGEMENT.test(text)) return false
  if (REACTION.test(text)) return false
  return true
}
