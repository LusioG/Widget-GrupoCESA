import { describe, expect, it } from 'vitest'
import { notificationText } from '../src/shared/notifyText'
import type { Signal } from '../src/shared/types'

const base: Signal = {
  id: 'slack:D1:1',
  source: 'slack',
  kind: 'dm',
  title: 'Lucho, mañana lo vemos a primera hora',
  url: 'https://slack.com',
  occurredAt: 1,
  sender: 'Pablo Calvo'
}

describe('the text of a notification says where it comes from and who wrote', () => {
  it('a direct message of Slack: the person', () => {
    expect(notificationText(base)).toEqual({
      title: 'Slack · Pablo Calvo',
      body: 'Lucho, mañana lo vemos a primera hora'
    })
  })

  it('a mention in a channel: the person and the channel, so it is not mistaken for a private one', () => {
    const mention: Signal = {
      ...base,
      kind: 'mention',
      channel: '#desarrollo',
      title: '@Lucho mirá'
    }
    expect(notificationText(mention)).toEqual({
      title: 'Slack · Pablo Calvo en #desarrollo',
      body: '@Lucho mirá'
    })
    expect(notificationText(mention).title).not.toBe(notificationText(base).title)
  })

  it('a mention without a known channel still says who', () => {
    expect(notificationText({ ...base, kind: 'mention' }).title).toBe('Slack · Pablo Calvo')
  })

  it('a conversation of a distribution list: the list', () => {
    const conversation: Signal = {
      id: 'gmail:list:18fa11aa11aa11aa:m4',
      source: 'gmail',
      kind: 'email',
      title: 'Caída del sistema en la sede norte',
      url: 'https://mail.google.com',
      occurredAt: 1,
      list: { address: 'soporte@cesa.com', name: 'Soporte CESA' }
    }
    expect(notificationText(conversation)).toEqual({
      title: 'Gmail · Soporte CESA',
      body: 'Caída del sistema en la sede norte'
    })
  })

  it('leaves the rest as it was: only the source in the title', () => {
    const mail: Signal = {
      id: 'gmail:1',
      source: 'gmail',
      kind: 'email',
      title: 'Contrato de servicio',
      url: 'https://mail.google.com',
      occurredAt: 1
    }
    expect(notificationText(mail)).toEqual({ title: 'Gmail', body: 'Contrato de servicio' })
    expect(notificationText({ ...base, sender: undefined }).title).toBe('Slack')
  })

  it('a meeting keeps its own title', () => {
    const meeting: Signal = {
      id: 'calendar:1',
      source: 'calendar',
      kind: 'meeting',
      title: 'Daily',
      url: 'https://calendar.google.com',
      occurredAt: 1
    }
    expect(notificationText(meeting)).toEqual({ title: 'Reunión por empezar', body: 'Daily' })
  })
})
