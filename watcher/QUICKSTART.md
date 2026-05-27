# Quick Start Guide - Watcher Service

## 5-Minute Setup

### 1. Clone & Install Dependencies
```bash
cd watcher
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Essential
GCP_PROJECT_ID=your-gcp-project-id
PUBSUB_TOPIC=incidents
SERVICES_TO_MONITOR=my-service-1,my-service-2
NAMESPACES_TO_MONITOR=production

# For in-cluster Kubernetes
K8S_IN_CLUSTER=true

# For local development with kubeconfig
K8S_IN_CLUSTER=false
KUBECONFIG=~/.kube/config
```

### 3. Set GCP Credentials
```bash
# Option A: Service account file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Option B: Application Default Credentials (if already authenticated)
gcloud auth application-default login
```

### 4. Verify Kubernetes Access
```bash
# Test kubeconfig
kubectl get pods -n production

# If in-cluster, pod will have service account automatically
```

### 5. Start the Service
```bash
# Development mode (with auto-reload)
npm run dev

# Production
npm run build && npm start
```

You should see:
```
Starting Watcher Service...
[2026-05-24T10:30:00Z] INFO  Watcher Service started successfully
[2026-05-24T10:30:00Z] INFO  Polling metrics...
[2026-05-24T10:30:00Z] INFO  Polling pod status...
```

## What Happens Next

1. **Every 30 seconds**: Service polls GCP Cloud Monitoring for CPU, Memory, Error Rate
2. **Every 30 seconds**: Service polls Kubernetes for pod status (crashes, restarts)
3. **When anomaly detected**: Incident published to PubSub topic
4. **Backend receives**: Processes incident and triggers RCA analysis
5. **For investigation**: Watcher provides logs for context

## Verify It's Working

### Check Incident Publishing
```bash
# In another terminal, subscribe to incidents topic
gcloud pubsub subscriptions pull incidents-subscription --auto-ack

# You should see JSON incidents like:
# {
#   "service": "my-service-1",
#   "pod": "my-service-1-abc-123",
#   "type": "HIGH_CPU",
#   "severity": "HIGH",
#   "timestamp": "2026-05-24T10:30:00Z"
# }
```

### Check Pod Detection
```bash
# Verify pods are being monitored
kubectl get pods -n production --show-labels | grep app=

# Should show your monitored services with app label
```

### Check Metrics Availability
```bash
# Verify metrics exist in Cloud Monitoring
gcloud monitoring time-series list \
  --filter='resource.type="k8s_pod"'

# Should show CPU, memory metrics
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No pods found" | Check pod labels: `kubectl get pods --show-labels` |
| "Permission denied" | Verify GCP service account has monitoring/pubsub/k8s permissions |
| "Cannot connect to cluster" | For local: `kubectl cluster-info`, For in-cluster: set `K8S_IN_CLUSTER=true` |
| "No metrics available" | Check Metrics Server: `kubectl get deployment metrics-server -n kube-system` |
| "PubSub publish fails" | Verify topic exists: `gcloud pubsub topics list` |

## Key Files

| File | Purpose |
|------|---------|
| [README.md](README.md) | Complete documentation |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design & data flow |
| [TESTING.md](TESTING.md) | Testing scenarios & debugging |
| `src/metrics/index.ts` | GCP Cloud Monitoring integration |
| `src/pods/index.ts` | Kubernetes pod monitoring |
| `src/incidents/index.ts` | Incident deduplication & publishing |
| `src/logs/index.ts` | GCP Cloud Logging integration |

## Understanding Incident Rules

### When an Incident is Raised

1. **HIGH_CPU** - If CPU > 80% for 1+ minute
2. **HIGH_MEMORY** - If memory > 85% for 1+ minute
3. **HIGH_ERROR_RATE** - If errors > 5/second for 30+ seconds
4. **POD_CRASH** - Immediately when pod status shows crash
5. **POD_RESTART** - If 3+ restarts within 5 minutes

### Deduplication

Same incident type won't be raised again for 1 hour, preventing alert fatigue while tracking frequency.

## Configuration Examples

### Monitor Multiple Services
```env
SERVICES_TO_MONITOR=user-service,order-service,payment-service,auth-service
NAMESPACES_TO_MONITOR=production,staging
```

### Custom Poll Intervals
```env
# Check more frequently
METRICS_POLL_INTERVAL=15000

# Check less frequently
POD_POLL_INTERVAL=60000
```

### In-Cluster Deployment
```env
K8S_IN_CLUSTER=true
NODE_ENV=production
GCP_PROJECT_ID=my-prod-project
PUBSUB_TOPIC=incidents-prod
```

## Integration with Backend

The backend service should:

1. **Subscribe to PubSub topic**
   ```typescript
   const subscription = pubsub.subscription('incidents-subscription');
   subscription.on('message', handleIncidentMessage);
   ```

2. **Create incident record**
   ```typescript
   const incident = await db.incidents.create({
     service, namespace, pod, type, severity, timestamp
   });
   ```

3. **Fetch context logs**
   ```typescript
   const logs = await watcher.getIncidentLogs(
     service, namespace, pod, timestamp
   );
   ```

4. **Trigger RCA analysis**
   ```typescript
   await triggerRCA(incident, logs);
   ```

## Common Scenarios

### Scenario: Service has memory leak
1. HIGH_MEMORY incident published
2. Backend creates incident record
3. Watcher provides WARN logs showing OOM pressure
4. RCA engine analyzes memory usage pattern
5. Recommendation: Increase memory limit or investigate leak

### Scenario: Pod keeps crashing
1. POD_CRASH incident published (CRITICAL)
2. Backend marks incident as critical
3. Watcher provides ERROR logs showing crash reason
4. RCA engine identifies root cause from logs
5. Recommendation: Fix the issue or rollback deployment

### Scenario: Temporary spike in errors
1. HIGH_ERROR_RATE incident published
2. Backend correlates with other services
3. Watcher provides top error patterns
4. RCA engine determines if related to deployment/traffic
5. Recommendation: Scaling, cache, or fix identified issue

## Next Steps

1. **Deploy to Kubernetes**: Follow deployment section in [README.md](README.md)
2. **Configure alerts**: Set up Slack/email notifications in backend
3. **Monitor metrics**: Set up dashboard to track incident trends
4. **Tune thresholds**: Adjust incident rules based on your SLO
5. **Integrate RCA**: Connect with backend for automated analysis

## Support

- Check logs: `npm run dev | grep -i error`
- View architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- See test scenarios: [TESTING.md](TESTING.md)
- Review full docs: [README.md](README.md)
