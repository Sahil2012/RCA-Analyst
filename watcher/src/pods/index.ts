import * as k8s from '@kubernetes/client-node'
import { config } from '../shared/config'
import { logger } from '../shared/logger'
import { PodStatus, Anomaly } from '../shared/index'

let kubeConfig: k8s.KubeConfig | null = null
let coreApi:    k8s.CoreV1Api | null  = null

function initKubeClient() {
  if (kubeConfig && coreApi) return

  try {
    kubeConfig = new k8s.KubeConfig()

    if (config.K8S_IN_CLUSTER === 'true') {
      kubeConfig.loadFromCluster()
    } else if (config.KUBECONFIG) {
      kubeConfig.loadFromFile(config.KUBECONFIG)
    } else {
      kubeConfig.loadFromDefault()
    }

    coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api)
  } catch (error) {
    logger.warn('Kubernetes client init failed — pod monitoring disabled', (error as Error).message)
    kubeConfig = null
    coreApi    = null
  }
}

const podRestartHistory = new Map<string, { restarts: number; timestamp: number }[]>()

export class PodPoller {
  constructor() { initKubeClient() }

  async getPodStatus(namespace: string, podName: string, service: string): Promise<PodStatus | null> {
    if (!coreApi) return null
    try {
      const pod = await coreApi.readNamespacedPod({ name: podName, namespace })
      if (!pod.metadata || !pod.status) return null

      const containerStatus = pod.status.containerStatuses?.[0]
      return {
        name:            podName,
        namespace,
        phase:           (pod.status.phase ?? 'Unknown') as PodStatus['phase'],
        restartCount:    containerStatus?.restartCount ?? 0,
        lastRestartTime: containerStatus?.lastState?.terminated?.finishedAt
          ? new Date(containerStatus.lastState.terminated.finishedAt)
          : undefined,
        crashed: containerStatus?.state?.terminated?.reason === 'Error'
              || containerStatus?.state?.terminated?.reason === 'OOMKilled',
        service,
      }
    } catch (error) {
      logger.warn(`Error fetching pod status for ${podName}`, (error as Error).message)
      return null
    }
  }

  async listPods(namespace: string, labelSelector = ''): Promise<PodStatus[]> {
    if (!coreApi) return []
    try {
      const response = await coreApi.listNamespacedPod({
        namespace,
        labelSelector: labelSelector || undefined,
      })

      return response.items.flatMap((pod) => {
        if (!pod.metadata?.name) return []
        const containerStatus = pod.status?.containerStatuses?.[0]
        return [{
          name:            pod.metadata.name,
          namespace,
          phase:           (pod.status?.phase ?? 'Unknown') as PodStatus['phase'],
          restartCount:    containerStatus?.restartCount ?? 0,
          lastRestartTime: containerStatus?.lastState?.terminated?.finishedAt
            ? new Date(containerStatus.lastState.terminated.finishedAt)
            : undefined,
          crashed: containerStatus?.state?.terminated?.reason === 'Error'
                || containerStatus?.state?.terminated?.reason === 'OOMKilled',
          service: pod.metadata.labels?.['app'] ?? pod.metadata.name,
        }]
      })
    } catch (error) {
      logger.warn(`K8s unavailable — skipping pod list for namespace ${namespace}`, (error as Error).message)
      return []
    }
  }

  async detectPodAnomalies(service: string, namespace: string, pod: PodStatus): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []
    const podKey = `${namespace}/${pod.name}`

    if (pod.crashed) {
      anomalies.push({ service, namespace, pod: pod.name, type: 'POD_CRASH', value: 1, threshold: 0, timestamp: new Date() })
    }

    if (pod.restartCount > 0) {
      const history    = podRestartHistory.get(podKey) ?? []
      const fiveMinAgo = Date.now() - 5 * 60 * 1000

      if (pod.lastRestartTime && pod.lastRestartTime.getTime() > fiveMinAgo) {
        history.push({ restarts: pod.restartCount, timestamp: pod.lastRestartTime.getTime() })
      }

      const recentRestarts = history.filter((h) => h.timestamp > fiveMinAgo)
      podRestartHistory.set(podKey, recentRestarts)

      if (recentRestarts.length >= 1) {
        anomalies.push({ service, namespace, pod: pod.name, type: 'POD_RESTART', value: recentRestarts.length, threshold: 3, timestamp: new Date() })
      }
    }

    if (pod.phase !== 'Running' && pod.phase !== 'Succeeded') {
      logger.warn(`Pod ${pod.name} is in ${pod.phase} phase`, { namespace })
    }

    return anomalies
  }
}

export const podPoller = new PodPoller()
