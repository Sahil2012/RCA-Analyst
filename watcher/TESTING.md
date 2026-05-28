# Watcher Service - Implementation & Testing Guide

## Complete Implementation Summary

The watcher service has been fully implemented with the following components:

### 1. Type System (`src/shared/index.ts`)
- Anomaly types: HIGH_CPU, HIGH_MEMORY, HIGH_ERROR_RATE, POD_CRASH, POD_RESTART
- Incident events with severity determination
- Pod status tracking
- Incident rules configuration
- Severity calculation based on threshold ratios

### 2. Configuration (`src/shared/config.ts`)
- Zod-based environment validation
- GCP project and PubSub configuration
- Kubernetes cluster configuration
- Service and namespace monitoring lists
- Polling interval configuration
- Helper functions for getting configuration values

### 3. Metrics Poller (`src/metrics/index.ts`)
- Queries GCP Cloud Monitoring API
- Detects high CPU utilization (threshold: 80%)
- Detects high memory utilization (threshold: 85%)
- Detects high error rate (threshold: 5 errors/sec)
- Aggregates anomalies for multiple pods per service

### 4. Pod Status Poller (`src/pods/index.ts`)
- Integrates with Kubernetes API
- Lists pods by service labels
- Detects pod crashes (OOMKilled, Error status)
- Tracks pod restarts within time windows
- Maintains restart history for deduplication
- Identifies pods in non-running states

### 5. Incident Engine (`src/incidents/index.ts`)
- Applies incident rules to anomalies
- Deduplicates incidents (1-hour window)
- Tracks occurrence count for repeated incidents
- Publishes incidents to GCP PubSub
- Provides incident statistics

### 6. Log Fetcher (`src/logs/index.ts`)
- Queries GCP Cloud Logging API
- Filters for ERROR and WARNING severity only
- Fetches logs within incident time windows (±5 minutes)
- Analyzes error patterns
- Provides log summary statistics

### 7. Main Watcher Service (`src/index.ts`)
- Orchestrates all components
- Manages polling intervals (30s metrics, 30s pods)
- Processes anomalies and raises incidents
- Fetches logs for incident investigation
- Handles graceful shutdown
- Provides service statistics

## Testing Scenarios

### Scenario 1: High CPU Detection

```typescript
// When metrics polling detects CPU > 80%
// Expected:
// 1. Anomaly created with type: HIGH_CPU
// 2. Incident published to PubSub with severity: HIGH or CRITICAL
// 3. Occurrence count tracked for deduplication

// Verify in logs:
// [2026-05-24T10:30:00Z] INFO  Detected 1 metric anomalies
// [2026-05-24T10:30:00Z] INFO  Incident published: service-name/pod-name - HIGH_CPU
```

### Scenario 2: Pod Restart Detection

```typescript
// When pod restarts 3+ times within 5 minutes
// Expected:
// 1. Anomaly created with type: POD_RESTART
// 2. Incident published with severity: MEDIUM
// 3. Restart history maintained for time window

// Monitor podRestartHistory map:
// Key: "namespace/pod-name"
// Value: { restarts: 3, timestamp: 1234567890 }
```

### Scenario 3: Pod Crash Detection

```typescript
// When pod status.terminated.reason === "Error" or "OOMKilled"
// Expected:
// 1. Anomaly created with type: POD_CRASH
// 2. Incident published with severity: CRITICAL
// 3. Immediate alert (no deduplication delay)

// Check pod phase transitions:
// Running -> Failed (with crash reason)
```

### Scenario 4: Incident Deduplication

```typescript
// When same incident type occurs multiple times
// Expected within 1 hour:
// 1. First occurrence: Published
// 2. Occurrences 2-N: Not published, count incremented
// 3. After 1 hour: Can publish again

// Sample deduplication key:
// "production/user-service-abc-123/HIGH_CPU"
// incidentHistory[key] = { occurrences: 3, timestamp: 1234567890 }
```

### Scenario 5: Log Retrieval for RCA

```typescript
// When incident needs investigation
// Expected:
// 1. Fetch logs for pod in 10-minute window (±5 min around incident)
// 2. Filter for ERROR and WARNING only
// 3. Analyze top error patterns
// 4. Return summary statistics

// Result structure:
// {
//   logs: [
//     { timestamp, severity, message, resource, labels }
//   ],
//   summary: {
//     totalLogs: 42,
//     errorCount: 15,
//     warningCount: 27,
//     firstLog: Date,
//     lastLog: Date
//   },
//   patterns: [
//     { pattern: "Connection timeout", count: 8 },
//     { pattern: "Database query failed", count: 5 }
//   ]
// }
```

## Local Development Testing

### Prerequisites
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Setup .env for Testing
```env
NODE_ENV=development
GCP_PROJECT_ID=my-test-project
PUBSUB_TOPIC=incidents-test
SERVICES_TO_MONITOR=user-service,order-service
NAMESPACES_TO_MONITOR=default,staging
METRICS_POLL_INTERVAL=30000
POD_POLL_INTERVAL=30000
K8S_IN_CLUSTER=false
KUBECONFIG=~/.kube/config
```

### Run in Development
```bash
npm run dev
# Output:
# Starting Watcher Service...
# [2026-05-24T10:30:00Z] INFO  Watcher Service started successfully
# [2026-05-24T10:30:00Z] INFO  Polling metrics...
# [2026-05-24T10:30:00Z] INFO  Polling pod status...
```

### Monitor Output
```bash
# Watch for incident publications
npm run dev | grep "Incident published"

# Watch for anomaly detection
npm run dev | grep "Detected.*anomalies"

# Watch for pod status polling
npm run dev | grep "Polling pod status"
```

## Integration Testing

### Test with Mock Services

```typescript
// Mock high CPU condition
class MockMetricsPoller {
  async getCpuUtilization() {
    return 92 // Above 80% threshold
  }
}

// Mock pod crash
class MockPodPoller {
  async getPodStatus() {
    return {
      name: 'test-pod',
      namespace: 'default',
      phase: 'Failed',
      crashed: true,
      restartCount: 5,
      service: 'test-service'
    }
  }
}
```

### Test Incident Publishing

```typescript
// Verify PubSub message format
const message = {
  service: 'user-service',
  namespace: 'production',
  pod: 'user-service-abc-123',
  type: 'HIGH_CPU',
  severity: 'CRITICAL',
  occurrences: 1,
  timestamp: '2026-05-24T10:30:00Z',
  value: 92.5,
  threshold: 80
}

// Expected: Message published to incidents topic
// Verify: Backend can deserialize and create incident record
```

## Performance Testing

### Test Scenarios

1. **High Volume Pods**
   - 100+ pods per service
   - 10 services monitored
   - Expected: 30-60 seconds per poll cycle
   - Memory: ~100MB

2. **High Anomaly Rate**
   - 50+ anomalies per poll
   - Expected: Incident deduplication working
   - PubSub throughput: 100+ messages/minute

3. **Log Fetching**
   - 10,000+ log entries per pod
   - Fetch within 10-minute window
   - Expected: <5 second query time
   - Pattern analysis: <100ms

## Debugging

### Enable Debug Logging
```typescript
// In src/index.ts
import { logger, LogLevel } from './shared/logger'
logger.setLevel(LogLevel.DEBUG)
```

### Monitor Incident History
```bash
# Add temporary logging to see deduplication
console.log('Incident History:', incidentHistory)
// Output:
// Map {
//   'default/pod-1/HIGH_CPU' => { key: '...', timestamp: 1234567890, occurrences: 3 }
// }
```

### Verify Pod Label Matching
```bash
# Check pod labels
kubectl get pods -n default -o jsonpath='{.items[*].metadata.labels}'

# Verify service label exists
kubectl get pods -n default --show-labels | grep "app="
```

## Deployment

### Docker Setup
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: watcher-config
data:
  SERVICES_TO_MONITOR: "user-service,order-service,payment-service"
  NAMESPACES_TO_MONITOR: "production"
  METRICS_POLL_INTERVAL: "30000"
  K8S_IN_CLUSTER: "true"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: watcher
spec:
  replicas: 1
  template:
    spec:
      serviceAccountName: watcher
      containers:
      - name: watcher
        image: watcher:latest
        envFrom:
        - configMapRef:
            name: watcher-config
        env:
        - name: GCP_PROJECT_ID
          valueFrom:
            secretKeyRef:
              name: watcher-secrets
              key: gcp-project-id
```

## Troubleshooting Guide

### Issue: "No incidents being detected"
**Solution:**
1. Verify pod labels: `kubectl get pods --show-labels`
2. Check GCP credentials: `gcloud auth list`
3. Enable DEBUG logging to see API calls
4. Verify metrics exist: Check Cloud Monitoring dashboard

### Issue: "Duplicate incidents"
**Solution:**
1. Verify deduplication is working: Check incident history map
2. Check 1-hour window calculation
3. Review incident key generation logic

### Issue: "Log fetching timeout"
**Solution:**
1. Increase timeout in GCP API client
2. Reduce LOG_FETCH_WINDOW if too large
3. Check network connectivity to GCP
4. Verify logging API permissions

### Issue: "Kubernetes connection refused"
**Solution:**
1. For in-cluster: Set `K8S_IN_CLUSTER=true`
2. For local: Ensure kubeconfig exists and is readable
3. Verify service account permissions for Watcher pod
4. Check pod service account has `pods` list/get permissions

## Metrics & Monitoring

### Key Metrics to Monitor
- Incident count per hour
- Anomalies detected per poll cycle
- PubSub message throughput
- Average poll cycle duration
- Log fetch latency
- Active incident count

### Example Prometheus Metrics
```
watcher_incidents_total{type="HIGH_CPU"} 42
watcher_anomalies_detected{type="POD_RESTART"} 12
watcher_pubsub_latency_ms 245
watcher_pod_poll_duration_ms 1200
watcher_active_incidents 5
```
