import { describe, expect, it } from 'vitest'
import {
  cleanMessageText,
  listAttachments,
  removeGroupFooter,
  splitSignature
} from '../src/main/connectors/gmail/body'
import { buildThreadView } from '../src/main/connectors/gmail/lists'
import type { GmailMessage } from '../src/main/connectors/gmail/types'
import { fileSize, isLongMessage, linkLabel, toRichParts } from '../src/shared/richText'

// A message as Gmail's plain text shows it for a Google Group: text, the signature with its logo
// links, and the footer the group adds.
const SIGNATURE = [
  '*[image: GrupoCESA] <https://grupocesa.net/>Pablo CalvoLíder de Ingeniería',
  'y Desarrollo(+54 9 11 6841-6550Whatsapp +54 9 11 2337-7926Comunicaciones',
  'unificadas,conversaciones inteligentes.www.grupocesa.net',
  '<https://grupocesa.net/>[image: LinkedIn GrupoCESA]',
  '<https://linkedin.com/company/grupocesa> [image: Instagram GrupoCESA]*'
].join('\n')

const FOOTER = [
  '--',
  'Has recibido este mensaje porque estás suscrito al grupo "Desarrollo" de Grupos de Google.',
  'Para cancelar la suscripción a este grupo y dejar de recibir sus mensajes, envía un correo electrónico a desarrollo+unsubscribe@grupocesa.net.',
  'Para ver este debate, visita https://groups.google.com/a/grupocesa.net/d/msgid/desarrollo/abc.'
].join('\n')

const BODY = 'Si falta algún permiso, avísenme.\n\nLes comparto el md con la guia que armo Nico.\n\nGracias!'

describe('the group footer', () => {
  it('is removed, with the "--" line that opens it', () => {
    const text = removeGroupFooter(`${BODY}\n\n${SIGNATURE}\n\n${FOOTER}`)
    expect(text).not.toMatch(/Has recibido|unsubscribe|groups\.google\.com|^--$/m)
    expect(text.endsWith('Instagram GrupoCESA]*')).toBe(true)
  })

  it('is recognised in English and Portuguese too', () => {
    const en =
      'Hi\n\n--\nYou received this message because you are subscribed to the Google Groups "Dev" group.\nTo unsubscribe send an email to dev+unsubscribe@x.com.'
    expect(removeGroupFooter(en)).toBe('Hi')
    const pt = 'Oi\n\n--\nVocê recebeu esta mensagem porque está inscrito no grupo "Dev".'
    expect(removeGroupFooter(pt)).toBe('Oi')
  })

  it('does not cut when what follows is too long to be a footer', () => {
    const long = `Has recibido este mensaje porque estás suscrito al grupo\n${'otra línea\n'.repeat(20)}`
    const text = `Hola\n\n${long}`
    expect(removeGroupFooter(text)).toBe(text)
  })

  it('leaves a message without footer alone', () => {
    expect(removeGroupFooter(BODY)).toBe(BODY)
  })
})

describe('the signature', () => {
  it('is set apart after the "-- " line, not deleted', () => {
    expect(splitSignature('Hola\n\n-- \nPablo\nIngeniería')).toEqual({
      main: 'Hola',
      signature: 'Pablo\nIngeniería'
    })
  })

  it('is recognised by its logo when there is no "-- " line', () => {
    const { main, signature } = splitSignature(`${BODY}\n\n${SIGNATURE}`)
    expect(main).toBe(BODY)
    expect(signature).toBe(SIGNATURE)
  })

  it('is not guessed in the middle of a message, or when it is as long as the message', () => {
    const middle = 'Mirá:\n[image: captura.png]\n\n¿Qué te parece?'
    expect(splitSignature(middle)).toEqual({ main: middle, signature: '' })
    const long = `Hola\n\n${'[image: x] línea\n'.repeat(30)}`.trimEnd()
    expect(splitSignature(long).signature).toBe('')
  })

  it('never leaves an empty message', () => {
    expect(splitSignature('-- \nPablo')).toEqual({ main: '-- \nPablo', signature: '' })
  })
})

describe('cleaning a whole message', () => {
  it('shows the text, folds the signature and drops the footer, keeping every link', () => {
    const { text, signature } = cleanMessageText(`${BODY}\n\n${SIGNATURE}\n\n${FOOTER}`)
    expect(text).toBe(BODY)
    expect(signature).toBe(SIGNATURE)
    expect(signature).toContain('https://grupocesa.net/')
    expect(signature).toContain('https://linkedin.com/company/grupocesa')
  })

  it('keeps a link that was sent on purpose, with or without text', () => {
    const body =
      'Les dejo el acuerdo <https://docs.google.com/document/d/1abc> y la carpeta https://drive.google.com/drive/folders/9z\n\nGracias'
    const { text } = cleanMessageText(`${body}\n\n${FOOTER}`)
    expect(text).toContain('<https://docs.google.com/document/d/1abc>')
    expect(text).toContain('https://drive.google.com/drive/folders/9z')
  })

  it('still removes the quoted earlier message', () => {
    const raw = `Listo.\n\nEl lun, 3 nov a las 10:15, Ana <a@x.com> escribió:\n> hola\n\n${FOOTER}`
    expect(cleanMessageText(raw)).toEqual({ text: 'Listo.', signature: '' })
  })

  it('never ends up empty', () => {
    expect(cleanMessageText(FOOTER).text).not.toBe('')
  })
})

describe('attachments', () => {
  const payload = {
    mimeType: 'multipart/mixed',
    parts: [
      { mimeType: 'text/plain', body: { data: 'aGk' } },
      {
        mimeType: 'application/pdf',
        filename: 'informe.pdf',
        body: { attachmentId: 'att1', size: 1_258_291 }
      },
      {
        mimeType: 'image/png',
        filename: 'logo.png', // the logo of a signature: it carries a Content-ID
        headers: [{ name: 'Content-ID', value: '<logo1>' }],
        body: { attachmentId: 'att2', size: 4000 }
      },
      {
        mimeType: 'image/png',
        filename: 'captura.png',
        headers: [{ name: 'Content-Disposition', value: 'inline; filename="captura.png"' }],
        body: { attachmentId: 'att3', size: 9000 }
      },
      {
        mimeType: 'multipart/related',
        parts: [
          {
            mimeType: 'application/zip',
            filename: 'datos.zip',
            body: { attachmentId: 'att4', size: 2048 }
          }
        ]
      }
    ]
  }

  it('lists the real files, at any depth, and leaves out the pictures inside the body', () => {
    expect(listAttachments(payload)).toEqual([
      { name: 'informe.pdf', size: 1_258_291, mime: 'application/pdf' },
      { name: 'datos.zip', size: 2048, mime: 'application/zip' }
    ])
  })

  it('has none when there is nothing attached', () => {
    expect(listAttachments(undefined)).toEqual([])
    expect(listAttachments({ mimeType: 'text/plain', body: { data: 'aGk' } })).toEqual([])
  })

  it('reaches the bubble, with the cleaned text and the folded signature', () => {
    const message: GmailMessage = {
      id: 'm1',
      threadId: 'abc123',
      labelIds: ['INBOX'],
      snippet: '',
      internalDate: 1_800_000_000_000,
      headers: { from: 'Pablo <pablo@cesa.com>', subject: 'Argos' },
      body: `${BODY}\n\n${SIGNATURE}\n\n${FOOTER}`,
      attachments: [{ name: 'informe.pdf', size: 1000, mime: 'application/pdf' }]
    }
    const view = buildThreadView({ threadId: 'abc123', messages: [message], me: 'yo@cesa.com', lists: [] })
    expect(view.messages[0].text).toBe(BODY)
    expect(view.messages[0].signature).toBe(SIGNATURE)
    expect(view.messages[0].attachments).toEqual(message.attachments)
    expect(JSON.stringify(view)).not.toContain('Has recibido')
  })
})

describe('links and images in the text', () => {
  it('turns bare links, links in <> and image markers into pieces, keeping the rest', () => {
    const parts = toRichParts(
      'Mirá https://www.docs.google.com/d/1). Y <https://github.com/org/repo/invitations> [image: logo.png] fin'
    )
    expect(parts).toEqual([
      { kind: 'text', text: 'Mirá ' },
      { kind: 'link', url: 'https://www.docs.google.com/d/1', label: 'docs.google.com' },
      { kind: 'text', text: '). Y ' },
      { kind: 'link', url: 'https://github.com/org/repo/invitations', label: 'github.com' },
      { kind: 'text', text: ' ' },
      { kind: 'image', name: 'logo.png' },
      { kind: 'text', text: ' fin' }
    ])
  })

  it('never loses a link: every http(s) address of the text comes out as a link', () => {
    const text =
      'a https://a.com/x, b <https://b.com/y> c https://c.com/z. d <https://d.com> https://e.com/(w)'
    const links = toRichParts(text).filter((p) => p.kind === 'link')
    expect(links).toHaveLength(5)
  })

  it('leaves plain text untouched and ignores non-web links', () => {
    expect(toRichParts('hola\nmundo')).toEqual([{ kind: 'text', text: 'hola\nmundo' }])
    expect(toRichParts('mail a <mailto:a@x.com> o ftp://x')).toEqual([
      { kind: 'text', text: 'mail a <mailto:a@x.com> o ftp://x' }
    ])
    expect(toRichParts('')).toEqual([])
  })

  it('names a link by its site', () => {
    expect(linkLabel('https://www.example.com/a/b?c=1')).toBe('example.com')
    expect(linkLabel('no es un link')).toBe('no es un link')
  })

  it('writes sizes and says when a message is long', () => {
    expect(fileSize(812)).toBe('812 B')
    expect(fileSize(340 * 1024)).toBe('340 KB')
    expect(fileSize(1_258_291)).toBe('1,2 MB')
    expect(isLongMessage('corto')).toBe(false)
    expect(isLongMessage('línea\n'.repeat(9))).toBe(true)
    expect(isLongMessage('x'.repeat(600))).toBe(true)
  })
})
