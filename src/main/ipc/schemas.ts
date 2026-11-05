import { z } from 'zod'

// Only web links may be opened from the renderer.
export const externalUrlSchema = z
  .string()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Only http(s) links are allowed')

export const clickupTokenSchema = z.string().min(1).max(256)

export const googleCredentialsSchema = z.object({
  clientId: z.string().min(1).max(512),
  clientSecret: z.string().max(512)
})

export const googleFeatureSchema = z.enum(['calendar', 'gmail'])

export const slackTokenSchema = z.string().min(1).max(512)

const itemIds = z.array(z.string().min(1).max(200)).min(1).max(1000)

export const itemActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['dismiss', 'seen', 'restore', 'purge']), ids: itemIds }),
  z.object({
    action: z.literal('snooze'),
    ids: itemIds,
    until: z.enum(['hour', 'tomorrow', 'monday', 'forever'])
  })
])

export const sourceSchema = z.enum(['slack', 'gmail', 'calendar', 'clickup'])

// A Gemini key: long enough to be real, short enough to be sane, no spaces.
export const geminiKeySchema = z.string().trim().min(20).max(256).regex(/^\S+$/)

// A conversation is opened by its Gmail id; `signalId` is the panel item it came from (marked as
// seen), `title` what the window shows while the messages load.
export const threadOpenSchema = z.object({
  threadId: z.string().regex(/^[0-9a-f]{6,32}$/i),
  signalId: z.string().min(1).max(200).optional(),
  title: z.string().max(300).optional()
})

// The height the summary window is asked to take: a plain number of pixels.
export const briefingHeightSchema = z.number().finite().min(100).max(5000)

// A summary is asked for by its day; without one it means the latest.
export const briefingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
