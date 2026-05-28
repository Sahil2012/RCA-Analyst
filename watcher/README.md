# Watcher Service

The Watcher Service is a system that continuously monitors GCP services deployed on Kubernetes, detects anomalies, and raises incidents when problems are detected.

## Architecture

### Components

1. **Metrics Poller** (`src/metrics/index.ts`)
   - Polls GCP Cloud Monitoring every 30 seconds
   - Detects anomalies: High CPU, High Memory, High Error Rate

2. **Pod Poller** (`src/pods/index.ts`)
   - Polls Kubernetes API every 30 seconds
   - Detects pod-related issues: Pod Crashes, Pod Restarts

3. **Incident Engine** (`src/incidents/index.ts`)
   - Applies incident rules to anomalies
   - Deduplicates incidents (prevents duplicates within 1 hour)
   - Publishes incidents to GCP PubSub

4. **Log Fetcher** (`src/logs/index.ts`)
   - Fetches ERROR and WARN logs from GCP Cloud Logging
   - Analyzes error patterns
   - Provides context for RCA

5. **Main Watcher** (`src/index.ts`)
   - Orchestrates all components
   - Manages polling intervals
   - Handles graceful shutdown

## Incident Rules

### HIGH_CPU
- **Threshold**: 80% CPU utilization
- **Duration**: Sustained for 1 minute
- **Severity**: HIGH
- **Formula**: Value / Threshold determines final severity

### HIGH_MEMORY
- **Threshold**: 85% memory utilization
- **Duration**: Sustained for 1 minute
- **Severity**: HIGH

### HIGH_ERROR_RATE
- **Threshold**: 5 errors per second
- **Duration**: Within 30 seconds
- **Severity**: CRITICAL (always, due to severity of error rate)

### POD_CRASH
- **Trigger**: Pod terminated with Error or OOMKilled status
- **Severity**: CRITICAL (always)
- **Action**: Immediate incident

### POD_RESTART
- **Threshold**: 3+ restarts within 5 minutes
- **Severity**: MEDIUM
- **Duration**: 5 minute window

## Severity Determination

Severity is automatically determined based on how far a metric exceeds its threshold:

- **Ratio > 1.5x threshold**: CRITICAL
- **Ratio > 1.2x threshold**: HIGH
- **Ratio > 1.1x threshold**: MEDIUM
- **Ratio <= 1.1x threshold**: LOW

Special cases:
- HIGH_ERROR_RATE: Always CRITICAL
- POD_CRASH: Always CRITICAL

## Data Models

### Anomaly Event
```typescript
{
  service: string           // Service name
  namespace: string         // K8s namespace
  pod: string              // Pod name
  type: AnomalyType        // Anomaly type
  value: number            // Measured value
  threshold: number        // Rule threshold
  timestamp: Date          // When detected
}
```

### Incident Event (Published to PubSub)
```typescript
{
  service: string          // Service name
  namespace: string        // K8s namespace
  pod: string             // Pod name
  type: AnomalyType       // Incident type
  severity: Severity      // LOW | MEDIUM | HIGH | CRITICAL
  occurrences: number     // Count in dedup window
  timestamp: Date         // When detected
  value?: number          // Measured value
  threshold?: number      // Rule threshold
}
```

### Log Entry
```typescript
{
  timestamp: Date
  severity: string        // ERROR, WARNING, etc.
  message: string         // Log message
  resource: string        // Resource identifier
  labels: Record<string, string>
}
```

## Deduplication

Incidents are deduplicated within a 1-hour window:

- **First occurrence**: Incident is published
- **Same incident type within 1 hour**: Tracked but not published (occurrence count incremented)
- **After 1 hour**: New incident can be published

This prevents alert fatigue while tracking frequency of issues.

## Incident Publishing

Incidents are published to GCP PubSub as JSON messages:

```json
{
  "service": "user-service",
  "namespace": "production",
  "pod": "user-service-xyz-abc",
  "type": "HIGH_CPU",
  "severity": "HIGH",
  "occurrences": 1,
  "timestamp": "2026-05-24T10:30:00Z",
  "value": 92.5,
  "threshold": 80
}
```

Backend service subscribes to this topic to create incident records and trigger RCA analysis.

## Log Retrieval

For incident investigation, the service can fetch contextual logs:

- **Time window**: ±5 minutes around incident time
- **Log types**: ERROR and WARNING severity only
- **Includes**: Error pattern analysis and summary statistics

## Setup

### Prerequisites

1. **GCP Project** with:
   - Cloud Monitoring enabled
   - Cloud Logging enabled
   - Pub/Sub topic created
   - Service account with appropriate permissions

2. **Kubernetes Cluster** with:
   - Pod labels: `app=<service-name>`
   - Metrics server installed

3. **Service Account Permissions**
   ```
   - monitoring.timeSeries.list
   - logging.logEntries.list
   - pubsub.topics.publish
   - kubernetes: pods.get, pods.list
   ```

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Configure GCP credentials:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```

4. For in-cluster Kubernetes access:
   ```bash
   # Set K8S_IN_CLUSTER=true in .env
   # Service account token will be auto-loaded
   ```

## Running

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Production
```bash
npm start
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT_ID` | Yes | - | GCP project ID |
| `PUBSUB_TOPIC` | Yes | - | PubSub topic name |
| `SERVICES_TO_MONITOR` | No | service1,service2 | Comma-separated service names |
| `NAMESPACES_TO_MONITOR` | No | default | Comma-separated K8s namespaces |
| `METRICS_POLL_INTERVAL` | No | 30000 | Metrics polling interval (ms) |
| `POD_POLL_INTERVAL` | No | 30000 | Pod polling interval (ms) |
| `LOG_FETCH_WINDOW` | No | 300000 | Log fetch window (ms) |
| `K8S_IN_CLUSTER` | No | false | Run in K8s cluster |
| `KUBECONFIG` | No | - | Path to kubeconfig file |

## Monitoring the Watcher

The watcher exposes statistics that can be queried:

```typescript
// Get current statistics
watcherService.getStats()
// Returns:
// {
//   isRunning: boolean,
//   incidentStats: {
//     totalActive: number,
//     byType: Record<string, number>,
//     byService: Record<string, number>
//   },
//   servicesMonitored: string[],
//   namespacesMonitored: string[]
// }
```

## Troubleshooting

### No incidents being raised
1. Check GCP credentials are properly configured
2. Verify service names match K8s pod labels (`app=<service-name>`)
3. Ensure Metrics Server is installed in K8s cluster
4. Check PubSub topic exists and service account has publish permissions

### Missing logs
1. Verify logs are being written with ERROR/WARNING severity
2. Check log label names match expected format
3. Ensure service account has `logging.logEntries.list` permission

### Pod detection issues
1. Verify K8s credentials are correctly configured
2. Check pod labels are set correctly
3. For in-cluster: verify `K8S_IN_CLUSTER=true` and pod has service account token

## Integration with RCA Backend

The backend service subscribes to the `incidents` PubSub topic:

1. Incident is detected and published by Watcher
2. Backend receives message and creates Incident record
3. Backend calls watcher for contextual logs
4. Logs are used to power RCA analysis
5. Analysis results are stored and retrieved via API

## Performance Considerations

- **Memory**: ~50-100MB for 1000+ tracked pods
- **Network**: ~10-50 API calls per poll cycle (configurable)
- **Latency**: 30-60 seconds from anomaly to incident detection
- **Throughput**: Handles 100+ incidents/minute

## Future Enhancements

- [ ] Custom incident rules per service
- [ ] Webhook notifications for critical incidents
- [ ] Incident escalation rules
- [ ] Custom metrics/thresholds via configuration
- [ ] Dashboard for incident visualization
- [ ] Metric correlation analysis for RCA
