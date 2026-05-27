import * as k8s from '@kubernetes/client-node'
import { config } from '../shared/config'
import { PodStatus, Anomaly, AnomalyType } from '../shared/index'

let kubeConfig: k8s.KubeConfig | null = null
let coreApi: k8s.CoreV1Api | null = null
let kubeInitError: Error | null = null

function initKubeClient() {
  if (kubeConfig && coreApi) {
    return
  }

  try {
    kubeConfig = new k8s.KubeConfig()

    if (config.K8S_IN_CLUSTER === 'true') {
      // Load in-cluster configuration
      kubeConfig.loadFromCluster()
    } else if (config.KUBECONFIG) {
      // Load from kubeconfig file
      kubeConfig.loadFromFile(config.KUBECONFIG)
    } else {
      // Try default kubeconfig locations
      kubeConfig.loadFromDefault()
    }

    coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api)
  } catch (error) {
    kubeInitError = error as Error
    console.warn('⚠️  Kubernetes client initialization failed:', (error as Error).message)
    console.warn('   Pod monitoring will be disabled. Pod crash/restart detection unavailable.')
    kubeConfig = null
    coreApi = null
  }
}

// Track pod restart history
const podRestartHistory = new Map<string, { restarts: number; timestamp: number }[]>()

export class PodPoller {
  constructor() {
    initKubeClient()
  }

  /**
   * Get pod status from Kubernetes
   */
  async getPodStatus(
    namespace: string,
    podName: string,
    service: string,
  ): Promise<PodStatus | null> {
    try {
      if (!coreApi) {
        throw new Error('Kubernetes client not initialized')
      }

      const pod = await coreApi.readNamespacedPod({
        name: podName,
        namespace: namespace,
      })

      if (!pod.metadata || !pod.status) {
        return null
      }

      const phase = pod.status.phase || 'Unknown'
      const containerStatus = pod.status.containerStatuses?.[0]

      const restartCount = containerStatus?.restartCount || 0
      const lastRestartTime = containerStatus?.lastState?.terminated?.finishedAt
        ? new Date(containerStatus.lastState.terminated.finishedAt)
        : undefined

      const crashed =
        containerStatus?.state?.terminated?.reason === 'Error' ||
        containerStatus?.state?.terminated?.reason === 'OOMKilled' ||
        false

      return {
        name: podName,
        namespace,
        phase: phase as PodStatus['phase'],
        restartCount,
        lastRestartTime,
        crashed,
        service,
      }
    } catch (error) {
      console.error(`Error fetching pod status for ${podName}:`, error)
      return null
    }
  }

  /**
   * List all pods for a service in a namespace
   */
  async listPods(
    namespace: string,
    labelSelector: string = '',
  ): Promise<PodStatus[]> {
    try {
      if (!coreApi) {
        throw new Error('Kubernetes client not initialized')
      }

      const response = await coreApi.listNamespacedPod({
        namespace: namespace,
        labelSelector: labelSelector || undefined,
      })

      const pods: PodStatus[] = []

      for (const pod of response.items) {
        if (!pod.metadata?.name) continue

        const service = pod.metadata.labels?.['app'] || pod.metadata.name

        const phase = pod.status?.phase || 'Unknown'
        const containerStatus = pod.status?.containerStatuses?.[0]
        const restartCount = containerStatus?.restartCount || 0
        const lastRestartTime = containerStatus?.lastState?.terminated?.finishedAt
          ? new Date(containerStatus.lastState.terminated.finishedAt)
          : undefined

        const crashed =
          containerStatus?.state?.terminated?.reason === 'Error' ||
          containerStatus?.state?.terminated?.reason === 'OOMKilled' ||
          false

        pods.push({
          name: pod.metadata.name,
          namespace,
          phase: phase as PodStatus['phase'],
          restartCount,
          lastRestartTime,
          crashed,
          service,
        })
      }

      return pods
    } catch (error) {
      console.error(`Error listing pods in namespace ${namespace}:`, error)
      return []
    }
  }

  /**
   * Detect pod-related anomalies
   */
  async detectPodAnomalies(
    service: string,
    namespace: string,
    pod: PodStatus,
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []
    const podKey = `${namespace}/${pod.name}`

    // Detect pod crashes
    if (pod.crashed) {
      anomalies.push({
        service,
        namespace,
        pod: pod.name,
        type: 'POD_CRASH' as AnomalyType,
        value: 1,
        threshold: 0,
        timestamp: new Date(),
      })
    }

    // Detect pod restarts
    if (pod.restartCount > 0) {
      const history = podRestartHistory.get(podKey) || []
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000

      // Add current restart if it happened recently
      if (pod.lastRestartTime) {
        const restartTime = pod.lastRestartTime.getTime()
        if (restartTime > fiveMinutesAgo) {
          history.push({ restarts: pod.restartCount, timestamp: restartTime })
        }
      }

      // Clean old entries
      const recentRestarts = history.filter((h) => h.timestamp > fiveMinutesAgo)
      podRestartHistory.set(podKey, recentRestarts)

      // If 3+ restarts in 5 minutes, raise anomaly
      if (recentRestarts.length >= 3) {
        anomalies.push({
          service,
          namespace,
          pod: pod.name,
          type: 'POD_RESTART' as AnomalyType,
          value: recentRestarts.length,
          threshold: 3,
          timestamp: new Date(),
        })
      }
    }

    // Detect pod not running
    if (pod.phase !== 'Running' && pod.phase !== 'Succeeded') {
      console.warn(
        `Pod ${pod.name} in namespace ${namespace} is in ${pod.phase} phase`,
      )
    }

    return anomalies
  }
}

export const podPoller = new PodPoller()
