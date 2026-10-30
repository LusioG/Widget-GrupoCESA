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

export const slackTokensSchema = z.object({
  appToken: z.string().min(1).max(512),
  userToken: z.string().min(1).max(512)
})

const itemIds = z.array(z.string().min(1).max(200)).min(1).max(1000)

export const itemActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['dismiss', 'seen', 'restore', 'purge']), ids: itemIds }),
  z.object({
    action: z.literal('snooze'),
    ids: itemIds,
    until: z.enum(['hour', 'tomorrow', 'monday'])
  })
])

export const sourceSchema = z.enum(['slack', 'gmail', 'calendar', 'clickup'])
