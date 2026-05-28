import { z } from 'zod'

const WatcherConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // GCP
  GCP_PROJECT_ID: z.string().min(1),
  GCP_CREDENTIALS_PATH: z.string().optional(),

  // PubSub — one topic per severity tier
  PUBSUB_TOPIC_HIGH:   z.string().default('incident-high'),
  PUBSUB_TOPIC_MEDIUM: z.string().default('incident-medium'),
  PUBSUB_TOPIC_LOW:    z.string().default('incident-low'),

  // Kubernetes
  KUBECONFIG: z.string().optional(),
  K8S_IN_CLUSTER: z.enum(['true', 'false']).default('false'),

  // Services to monitor (comma-separated)
  SERVICES_TO_MONITOR: z.string().default('service1,service2'),
  NAMESPACES_TO_MONITOR: z.string().default('default'),

  // Polling intervals
  METRICS_POLL_INTERVAL: z.coerce.number().default(30000), // 30 seconds
  POD_POLL_INTERVAL: z.coerce.number().default(30000), // 30 seconds
  LOG_FETCH_WINDOW: z.coerce.number().default(300000), // 5 minutes
})

const parsed = WatcherConfigSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Missing or invalid environment variables:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  process.exit(1)
}

export const config = parsed.data

export const getServicesToMonitor = (): string[] => {
  return config.SERVICES_TO_MONITOR.split(',').map((s: string) => s.trim())
}

export const getNamespacesToMonitor = (): string[] => {
  return config.NAMESPACES_TO_MONITOR.split(',').map((n: string) => n.trim())
}
