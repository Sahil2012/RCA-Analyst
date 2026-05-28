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
  GCP_PROJECT_ID:              z.string().min(1),
  PUBSUB_SUBSCRIPTION_HIGH:    z.string().min(1),
  PUBSUB_SUBSCRIPTION_MEDIUM:  z.string().min(1),
  PUBSUB_SUBSCRIPTION_LOW:     z.string().min(1),

  // LLM provider — set to 'gemini' or 'anthropic'
  LLM_PROVIDER:                z.enum(['anthropic', 'gemini']).default('anthropic'),

  // Anthropic (required when LLM_PROVIDER=anthropic)
  ANTHROPIC_API_KEY:           z.string().optional(),
  ANTHROPIC_MODEL:             z.string().default('claude-sonnet-4-6'),

  // Gemini (required when LLM_PROVIDER=gemini)
  GEMINI_API_KEY:              z.string().optional(),
  GEMINI_MODEL:                z.string().default('gemini-1.5-flash'),

  RCA_LLM_MAX_TOKENS:          z.coerce.number().default(2048),

  // Token optimizer
  RCA_LOG_TOKEN_BUDGET:        z.coerce.number().default(6000),  // tokens reserved for logs in the prompt
  RCA_LOG_MAX_MESSAGE_CHARS:   z.coerce.number().default(300),   // individual log message cap before truncation

  // RCA pipeline tuning
  RCA_MAX_ATTEMPTS:            z.coerce.number().int().min(1).default(3),
  RCA_JUDGE_THRESHOLD:         z.coerce.number().min(0).max(1).default(0.7),
  RCA_LOG_WINDOW_BEFORE_MIN:   z.coerce.number().default(5),
  RCA_LOG_WINDOW_AFTER_MIN:    z.coerce.number().default(10),

  // LangSmith (optional)
  LANGCHAIN_API_KEY:           z.string().optional(),
  LANGCHAIN_PROJECT:           z.string().default('rca-analyst'),
  LANGCHAIN_TRACING_V2:        z.coerce.boolean().default(false),

  // API server
  API_PORT:                    z.coerce.number().default(3000),

  // MCP server
  MCP_PORT:                    z.coerce.number().default(3002),

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
