import { strings } from './strings'
import type { Signal } from './types'

// The text of the Windows notification of something that arrived. The title says where it comes
// from and who wrote, so a private message and a mention in a channel (or a mail of a list) are
// told apart without opening the panel:
//   "Slack · Pablo Calvo"                  a direct message
//   "Slack · Pablo Calvo en #desarrollo"   a mention in a channel
//   "Gmail · Soporte CESA"                 a conversation of a distribution list
export function notificationText(s: Signal): { title: string; body: string } {
  if (s.kind === 'meeting') return { title: strings.notify.meetingSoon, body: s.title }
  const source = strings.sources[s.source]
  if (s.source === 'slack' && s.sender && (s.kind === 'dm' || s.kind === 'mention')) {
    const where = s.kind === 'mention' && s.channel ? ` ${strings.notify.inChannel(s.channel)}` : ''
    return { title: `${source} · ${s.sender}${where}`, body: s.title }
  }
  if (s.source === 'gmail' && s.list) return { title: `${source} · ${s.list.name}`, body: s.title }
  return { title: source, body: s.title }
}
