import { z } from 'zod'

const ConfigSchema = z.object({
  NODE_ENV:               z.enum(['development', 'production', 'test']).default('development'),
  PORT:                   z.coerce.number().default(3001),

  // Prisma / Supabase
  DATABASE_URL:           z.string().min(1),
  DIRECT_URL:             z.string().min(1),
  SUPABASE_URL:           z.string().url(),
  SUPABASE_ANON_KEY:      z.string().min(1),

  // GCP
  GCP_PROJECT_ID:         z.string().min(1),
  PUBSUB_SUBSCRIPTION:    z.string().min(1),

  // Anthropic
  ANTHROPIC_API_KEY:      z.string().min(1),

  // LangSmith (optional)
  LANGCHAIN_API_KEY:      z.string().optional(),
  LANGCHAIN_PROJECT:      z.string().default('rca-analyst'),
  LANGCHAIN_TRACING_V2:   z.coerce.boolean().default(false),

  // Email (optional — alerts disabled if absent)
  SMTP_HOST:              z.string().optional(),
  SMTP_PORT:              z.coerce.number().default(587),
  SMTP_USER:              z.string().optional(),
  SMTP_PASS:              z.string().optional(),
  ALERT_FROM:             z.string().optional(),
  ALERT_TO:               z.string().optional(),
})

const parsed = ConfigSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Missing or invalid environment variables:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  process.exit(1)
}

export const config = parsed.data
export type Config = z.infer<typeof ConfigSchema>
