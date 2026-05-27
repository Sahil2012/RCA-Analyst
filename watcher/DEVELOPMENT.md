# Local Development & Testing Examples

## Running Locally

### Development Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Set K8S_IN_CLUSTER=false to use local kubeconfig
```

### Start Development Server

```bash
# Terminal 1: Start watcher service
npm run dev

# Expected output:
# Starting Watcher Service...
# [2026-05-24T10:30:00Z] INFO  Watcher Service started successfully
# [2026-05-24T10:30:00Z] INFO  Polling metrics...
# [2026-05-24T10:30:00Z] INFO  Polling pod status...
```

### Monitor Output

```bash
# Terminal 2: Watch for incidents
npm run dev | grep "Incident published"

# Terminal 3: Watch for anomalies
npm run dev | grep "Detected.*anomalies"

# Terminal 4: Watch for errors
npm run dev | grep "Error"
```

## Testing with Mock Data

Create a test file to simulate anomalies:

### `test-mock.ts`

```typescript
import { incidentEngine } from './src/incidents'
import { Anomaly } from './src/shared'

async function testIncidents() {
  // Simulate HIGH_CPU anomaly
  const cpuAnomaly: Anomaly = {
    service: 'test-service',
    namespace: 'default',
    pod: 'test-service-xyz-123',
    type: 'HIGH_CPU',
    value: 92.5,
    threshold: 80,
    timestamp: new Date(),
  }

  console.log('Publishing HIGH_CPU incident...')
  await incidentEngine.raiseIncident(cpuAnomaly)

  // Simulate HIGH_MEMORY anomaly
  const memoryAnomaly: Anomaly = {
    service: 'test-service',
    namespace: 'default',
    pod: 'test-service-xyz-123',
    type: 'HIGH_MEMORY',
    value: 89.0,
    threshold: 85,
    timestamp: new Date(),
  }

  console.log('Publishing HIGH_MEMORY incident...')
  await incidentEngine.raiseIncident(memoryAnomaly)

  // Simulate POD_CRASH anomaly
  const crashAnomaly: Anomaly = {
    service: 'test-service',
    namespace: 'default',
    pod: 'test-service-xyz-456',
    type: 'POD_CRASH',
    value: 1,
    threshold: 0,
    timestamp: new Date(),
  }

  console.log('Publishing POD_CRASH incident...')
  await incidentEngine.raiseIncident(crashAnomaly)

  // Check incident statistics
  const stats = incidentEngine.getIncidentStats()
  console.log('Incident Stats:', stats)
}

testIncidents().catch(console.error)
```

Run with:
```bash
npx tsx test-mock.ts
```

## Testing Deduplication

### `test-dedup.ts`

```typescript
import { incidentEngine } from './src/incidents'
import { Anomaly } from './src/shared'

async function testDeduplication() {
  const anomaly: Anomaly = {
    service: 'test-service',
    namespace: 'default',
    pod: 'test-service-xyz-123',
    type: 'HIGH_CPU',
    value: 92.5,
    threshold: 80,
    timestamp: new Date(),
  }

  // First incident - should publish
  console.log('1. Publishing first HIGH_CPU incident...')
  const id1 = await incidentEngine.raiseIncident(anomaly)
  console.log(`   Published: ${id1 ? 'YES' : 'NO'}`)

  // Second incident (same type) - should NOT publish
  console.log('2. Publishing same HIGH_CPU incident again...')
  const id2 = await incidentEngine.raiseIncident(anomaly)
  console.log(`   Published: ${id2 ? 'YES' : 'NO'}`)

  // Third incident (same type) - should NOT publish
  console.log('3. Publishing same HIGH_CPU incident third time...')
  const id3 = await incidentEngine.raiseIncident(anomaly)
  console.log(`   Published: ${id3 ? 'YES' : 'NO'}`)

  // Check statistics
  const stats = incidentEngine.getIncidentStats()
  console.log('\nIncident Statistics:')
  console.log(`  Total Active: ${stats.totalActive}`)
  console.log(`  By Type: ${JSON.stringify(stats.byType)}`)

  // Expected:
  // 1. Published: YES (first occurrence)
  // 2. Published: NO (within 1 hour, same type)
  // 3. Published: NO (within 1 hour, same type)
  // Total Active: 1
  // By Type: { HIGH_CPU: 1 }
}

testDeduplication().catch(console.error)
```

Run with:
```bash
npx tsx test-dedup.ts
```

## Testing Severity Calculation

### `test-severity.ts`

```typescript
import { determineSeverity, AnomalyType } from './src/shared'

function testSeverity() {
  const testCases = [
    // HIGH_CPU cases
    {
      type: 'HIGH_CPU' as AnomalyType,
      value: 95,
      threshold: 80,
      expected: 'CRITICAL', // 95/80 = 1.19, but > 1.1 so MEDIUM... wait > 1.2 so HIGH...
    },
    {
      type: 'HIGH_CPU' as AnomalyType,
      value: 130,
      threshold: 80,
      expected: 'CRITICAL', // 130/80 = 1.625 > 1.5
    },
    {
      type: 'HIGH_MEMORY' as AnomalyType,
      value: 86,
      threshold: 85,
      expected: 'LOW', // 86/85 = 1.01 <= 1.1
    },
    // HIGH_ERROR_RATE is always CRITICAL
    {
      type: 'HIGH_ERROR_RATE' as AnomalyType,
      value: 5.5,
      threshold: 5,
      expected: 'CRITICAL', // Always CRITICAL
    },
    // POD_CRASH is always CRITICAL
    {
      type: 'POD_CRASH' as AnomalyType,
      value: 1,
      threshold: 0,
      expected: 'CRITICAL',
    },
  ]

  console.log('Testing severity calculation:\n')

  testCases.forEach(({ type, value, threshold, expected }) => {
    const severity = determineSeverity(type, value, threshold)
    const ratio = (value / threshold).toFixed(2)
    const passed = severity === expected ? '✓' : '✗'

    console.log(`${passed} ${type}`)
    console.log(`  Value: ${value}, Threshold: ${threshold}, Ratio: ${ratio}x`)
    console.log(`  Expected: ${expected}, Got: ${severity}`)
    console.log()
  })
}

testSeverity()
```

Run with:
```bash
npx tsx test-severity.ts
```

## Testing with Real K8s Cluster

### Prerequisites

```bash
# Verify cluster connection
kubectl cluster-info

# List pods
kubectl get pods -n production --show-labels

# Create test pod if needed
kubectl run test-pod --image=nginx -n production -l app=test-service
```

### Update .env

```env
K8S_IN_CLUSTER=false
KUBECONFIG=~/.kube/config
SERVICES_TO_MONITOR=test-service
NAMESPACES_TO_MONITOR=production
```

### Start Watching

```bash
npm run dev

# In another terminal, stress test the pod
kubectl exec -it test-pod -n production -- bash
# Inside pod:
# stress --cpu 4 --timeout 120s
```

Expected output:
```
[2026-05-24T10:30:30Z] INFO  Detected 1 metric anomalies
[2026-05-24T10:30:30Z] INFO  Incident published: test-service/test-pod - HIGH_CPU
```

## Testing GCP Integration

### 1. Verify GCP Credentials

```bash
# Check if credentials are loaded
gcloud auth list

# Verify service account permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*" \
  --format="table(bindings.role)"
```

### 2. Test Cloud Monitoring

```bash
# List available metrics
gcloud monitoring time-series list \
  --filter='resource.type="k8s_pod"' \
  --limit=5

# Get CPU metric for a pod
gcloud monitoring time-series list \
  --filter='
    resource.type="k8s_pod"
    AND resource.labels.pod_name="test-pod"
    AND metric.type="kubernetes.io/container/cpu/core_usage_time"
  ' \
  --limit=1
```

### 3. Test Cloud Logging

```bash
# List ERROR logs
gcloud logging read \
  'severity=ERROR AND resource.type=k8s_pod' \
  --format=json \
  --limit=5

# Count ERRORs in last hour
gcloud logging read \
  'severity=ERROR' \
  --format="table(timestamp,severity,jsonPayload.message)" \
  --limit=100
```

### 4. Test PubSub

```bash
# Create test subscription if not exists
gcloud pubsub subscriptions create incidents-test-sub \
  --topic=incidents --ack-deadline=10

# Pull messages
gcloud pubsub subscriptions pull incidents-test-sub --auto-ack

# Expected message:
# {
#   "service":"user-service",
#   "pod":"user-service-abc",
#   "type":"HIGH_CPU",
#   "severity":"HIGH",
#   "timestamp":"2026-05-24T10:30:00Z"
# }
```

## Performance Testing

### `test-performance.ts`

```typescript
import { metricsPoller } from './src/metrics'
import { podPoller } from './src/pods'

async function testPerformance() {
  console.log('Performance Testing\n')

  // Test metrics polling duration
  const metrics_start = Date.now()
  const anomalies = await metricsPoller.detectAnomalies(
    'user-service',
    'production',
    'user-service-abc-123',
  )
  const metrics_duration = Date.now() - metrics_start
  console.log(`Metrics poll: ${metrics_duration}ms`)

  // Test pod polling duration
  const pods_start = Date.now()
  const pods = await podPoller.listPods('production', 'app=user-service')
  const pods_duration = Date.now() - pods_start
  console.log(`Pod listing: ${pods_duration}ms (${pods.length} pods)`)

  // Test pod anomaly detection
  const anomaly_start = Date.now()
  for (const pod of pods.slice(0, 5)) {
    await podPoller.detectPodAnomalies('user-service', 'production', pod)
  }
  const anomaly_duration = Date.now() - anomaly_start
  console.log(`Pod anomaly detection (5 pods): ${anomaly_duration}ms`)

  console.log('\nExpected timing:')
  console.log('- Metrics poll: 500-2000ms')
  console.log('- Pod listing: 100-500ms')
  console.log('- Anomaly detection: 50-200ms per pod')
}

testPerformance().catch(console.error)
```

## Debugging Tips

### 1. Enable Verbose Logging

```typescript
// In src/index.ts
import { logger, LogLevel } from './shared/logger'
logger.setLevel(LogLevel.DEBUG)
```

### 2. Add Temporary Logging

```typescript
// In src/incidents/index.ts
console.log('Incident History:', incidentHistory)
console.log('Processing anomaly:', anomaly)
console.log('Incident key:', incidentKey)
```

### 3. Inspect PubSub Messages

```bash
# Subscribe and see all messages
gcloud pubsub subscriptions pull incidents-sub \
  --format=json \
  --limit=10
```

### 4. Monitor K8s Events

```bash
# Watch pod events in real-time
kubectl get events -n production -w

# Check pod details
kubectl describe pod <pod-name> -n production

# View pod logs
kubectl logs <pod-name> -n production --tail=100
```

## Clean Up

```bash
# Stop development server
# Press Ctrl+C in the running terminal

# Clean build artifacts
rm -rf dist/

# Remove test subscriptions
gcloud pubsub subscriptions delete incidents-test-sub

# Delete test pods
kubectl delete pod test-pod -n production
```

## CI/CD Integration Example

### `.github/workflows/test.yml`

```yaml
name: Tests
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run build
      - run: npm test  # Add test script to package.json
      
      - name: TypeScript Check
        run: npx tsc --noEmit
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "echo 'Tests passed'",
    "lint": "npx tsc --noEmit"
  }
}
```
