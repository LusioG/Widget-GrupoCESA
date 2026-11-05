import { describe, expect, it } from 'vitest'
import { cleanMessageText, extractText, unflow, unwrapCutLines } from '../src/main/connectors/gmail/body'
import { ellipsize } from '../src/main/connectors/gmail/lists'
import { toRichParts } from '../src/shared/richText'

// The plain text of a real message of the "desarrollo" list: the sender's program cut the lines
// at about 70 characters, in the middle of the sentences.
const L1 = 'Buenas, voy a hacer unas pequeñas pruebas de migracion de zoho desk a'
const L2 = 'zammad, sobretodo ver si puedo armar la skill para cuando toque hacer la'
const L3 = 'migracion,'
const L4 =
  'Tengo algo de tiempo para encararlo y se que ustedes estan a full con proyectos, asique les comento las novedades de avance por aca.'
const FOOTER = [
  '--',
  'Has recibido este mensaje porque estás suscrito al grupo "Desarrollo" de Grupos de Google.',
  'Para cancelar la suscripción a este grupo y dejar de recibir sus mensajes, envía un correo electrónico a desarrollo+unsubscribe@grupocesa.net.',
  'Para ver este debate, visita https://groups.google.com/a/grupocesa.net/d/msgid/desarrollo/CAHS6ig%40mail.gmail.com.'
].join('\n')

const FLOWING = `${L1} ${L2} ${L3}\n${L4}`

describe('lines cut by the sender\'s program', () => {
  it('joins them back, so the paragraph flows as in Gmail', () => {
    expect(unwrapCutLines([L1, L2, L3, L4].join('\n'))).toBe(FLOWING)
  })

  it('keeps the line breaks the author typed', () => {
    expect(unwrapCutLines('Hola\n\nSaludos !')).toBe('Hola\n\nSaludos !')
    expect(unwrapCutLines('Uno\nDos\nTres')).toBe('Uno\nDos\nTres')
    // A line that is not as long as the programs cut them was ended on purpose.
    expect(unwrapCutLines(`${L3}\n${L4}`)).toBe(`${L3}\n${L4}`)
  })

  it('does not join list items, quotes or headings onto the line before', () => {
    const list = [L1, '- primer punto', '- segundo punto'].join('\n')
    expect(unwrapCutLines(list)).toBe(list)
    const numbered = [L2, '1. Conectarse a la tailnet', '2. Abrir PowerShell'].join('\n')
    expect(unwrapCutLines(numbered)).toBe(numbered)
  })

  it('leaves alone a text whose lines are long on purpose', () => {
    const long = `${L4}\n${L4}`
    expect(unwrapCutLines(long)).toBe(long)
  })

  it('handles an empty text and a single line', () => {
    expect(unwrapCutLines('')).toBe('')
    expect(unwrapCutLines(L4)).toBe(L4)
  })

  it('reads format=flowed, where a space at the end of a line means it goes on', () => {
    expect(unflow('Hola a todos \nque tal\nChau', false)).toBe('Hola a todos que tal\nChau')
    expect(unflow('Hola a todos \nque tal', true)).toBe('Hola a todosque tal') // delsp=yes drops it
    expect(unflow('> cita \n> sigue', false)).toBe('> cita \n> sigue') // quotes are not touched
  })

  it('applies it to a message that declares format=flowed', () => {
    const data = Buffer.from('Uno dos \ntres\ncuatro', 'utf8').toString('base64url')
    const text = extractText({
      mimeType: 'text/plain',
      headers: [{ name: 'Content-Type', value: 'text/plain; charset="UTF-8"; format=flowed' }],
      body: { data }
    })
    expect(text).toBe('Uno dos tres\ncuatro')
  })
})

// The message of Pablo: cut at 73 characters, and the last cut came before "lo" (2 letters), which
// would have made 76. Gmail shows it as ONE line; it must not end up split before "lo".
const P1 = 'Dale guiidote, anda avisando. Pruébenlo internamente. Si todo sale ok, la'
const P2 = 'semana que viene nos juntamos y le damos vida para que los chicos de Omni'
const P3 = 'lo puedan testear.'

describe('the message of Pablo (a cut right at the edge)', () => {
  it('is one line again, as in Gmail', () => {
    expect(P1.length).toBe(73)
    expect(P2.length).toBe(73)
    expect(unwrapCutLines([P1, P2, P3].join('\n'))).toBe(`${P1} ${P2} ${P3}`)
  })

  it('does not join after a line that was clearly ended by the author', () => {
    const typed = ['Hola equipo', P3].join('\n')
    expect(unwrapCutLines(typed)).toBe(typed)
  })
})

describe('a quote that is cut to fit', () => {
  const text = 'Buenas, voy a hacer unas pequeñas pruebas de migracion de zoho desk a zammad, sobretodo ver si puedo armar'

  it('ends with "…" and between words, never in the middle of one', () => {
    const short = ellipsize(text, 90)
    expect(short.endsWith('…')).toBe(true)
    expect(short.length).toBeLessThanOrEqual(91)
    expect(short).not.toMatch(/ve…$/) // "sobretodo ve" was cut in the middle of "ver"
    expect(text.startsWith(short.slice(0, -1))).toBe(true)
    expect(text.charAt(short.length - 1)).toBe(' ')
  })

  it('leaves a short text as it is', () => {
    expect(ellipsize('Se cayó el sistema', 90)).toBe('Se cayó el sistema')
    expect(ellipsize('x'.repeat(90), 90)).toBe('x'.repeat(90))
  })

  it('cuts a word that is too long on its own, instead of dropping nearly everything', () => {
    const long = 'a'.repeat(200)
    expect(ellipsize(long, 90)).toBe(`${'a'.repeat(90)}…`)
  })
})

describe('the whole message of the screenshot', () => {
  it('flows, loses the group footer and keeps what the person wrote', () => {
    const raw = [L1, L2, L3, L4, '', 'Saludos !', FOOTER].join('\n')
    const { text, signature } = cleanMessageText(raw)
    expect(text).toBe(`${FLOWING}\n\nSaludos !`)
    expect(signature).toBe('')
    expect(text).not.toMatch(/Has recibido|debate|unsubscribe|groups\.google/)
  })

  it('drops the asterisks that wrap a whole bold signature, and keeps its content', () => {
    const raw = [
      'Gracias!',
      '',
      '*[image: GrupoCESA] <https://grupocesa.net/>Pablo Calvo',
      'Líder de Ingeniería*'
    ].join('\n')
    const { text, signature } = cleanMessageText(raw)
    expect(text).toBe('Gracias!')
    expect(signature).toBe('[image: GrupoCESA] <https://grupocesa.net/>Pablo Calvo\nLíder de Ingeniería')
  })
})

describe('bold words', () => {
  it('turns *word* into bold and keeps the text around it', () => {
    expect(toRichParts('Esto es *importante* y *muy urgente*.')).toEqual([
      { kind: 'text', text: 'Esto es ' },
      { kind: 'bold', text: 'importante' },
      { kind: 'text', text: ' y ' },
      { kind: 'bold', text: 'muy urgente' },
      { kind: 'text', text: '.' }
    ])
  })

  it('works at the start and end of a line, after a bracket, and on several lines', () => {
    expect(toRichParts('*Importante*').map((p) => p.kind)).toEqual(['bold'])
    expect(toRichParts('(*ojo*)')).toEqual([
      { kind: 'text', text: '(' },
      { kind: 'bold', text: 'ojo' },
      { kind: 'text', text: ')' }
    ])
    const kinds = toRichParts('*uno*\notro *dos*').map((p) => p.kind)
    expect(kinds.filter((k) => k === 'bold')).toHaveLength(2)
  })

  it('leaves alone what is not bold: products, list bullets, lone and doubled asterisks', () => {
    for (const text of ['cuenta 2*3*4 ok', '* item de lista', 'sin cerrar *esto', '**doble**', 'a * b * c']) {
      expect(toRichParts(text), text).toEqual([{ kind: 'text', text }])
    }
  })

  it('does not stretch over two lines', () => {
    const text = '*empieza\ntermina*'
    expect(toRichParts(text)).toEqual([{ kind: 'text', text }])
  })

  it('still finds links and images next to a bold word', () => {
    const kinds = toRichParts('*Ojo* mirá https://a.com/x y [image: logo.png]').map((p) => p.kind)
    expect(kinds).toEqual(['bold', 'text', 'link', 'text', 'image'])
  })
})
