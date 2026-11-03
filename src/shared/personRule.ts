// How one person of Slack is treated: normal, urgent (a "Remitente prioritario") or ignored
// (a "Remitente a ignorar"). Both lists are shared with Gmail, so a person is found by name,
// without caring about case or accents.
export type PersonRule = 'normal' | 'urgent' | 'ignore'

const fold = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

const has = (list: string[], name: string): boolean =>
  list.some((entry) => fold(entry) === fold(name))
const without = (list: string[], name: string): string[] =>
  list.filter((entry) => fold(entry) !== fold(name))

type Lists = { important: string[]; ignored: string[] }

export function personRule(name: string, lists: Lists): PersonRule {
  if (has(lists.ignored, name)) return 'ignore'
  if (has(lists.important, name)) return 'urgent'
  return 'normal'
}

// A person is in at most one of the two lists; other entries (e-mail addresses...) are left alone.
export function setPersonRule(name: string, rule: PersonRule, lists: Lists): Lists {
  const important = without(lists.important, name)
  const ignored = without(lists.ignored, name)
  if (rule === 'urgent') important.push(name)
  if (rule === 'ignore') ignored.push(name)
  return { important, ignored }
}
