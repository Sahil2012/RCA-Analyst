# Watcher Service - Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Watcher Service                              │
│                                                                 │
│  ┌───────────────┐         ┌──────────────┐                    │
│  │ Metrics       │         │ Pod          │                    │
│  │ Poller        │         │ Poller       │                    │
│  │ (30s)         │         │ (30s)        │                    │
│  └───────────────┘         └──────────────┘                    │
│         │                          │                            │
│    CPU, Memory                Pod Status                        │
│    Error Rate                 Restarts                          │
│                               Crashes                           │
│         │                          │                            │
│         ▼                          ▼                            │
│  ┌─────────────────────────────────────────┐                   │
│  │     Anomaly Detection                   │                   │
│  │  - Threshold Matching                   │                   │
│  │  - Time Window Validation                │                   │
│  └─────────────────────────────────────────┘                   │
│                     │                                           │
│                     ▼                                           │
│  ┌─────────────────────────────────────────┐                   │
│  │  Incident Engine                        │                   │
│  │  ┌─────────────────────────────────┐    │                   │
│  │  │ Deduplication (1-hour window)   │    │                   │
│  │  │ - Incident Key Generation       │    │                   │
│  │  │ - Occurrence Tracking           │    │                   │
│  │  └─────────────────────────────────┘    │                   │
│  │  ┌─────────────────────────────────┐    │                   │
│  │  │ Severity Calculation            │    │                   │
│  │  │ - Ratio-based severity          │    │                   │
│  │  │ - Type-specific overrides       │    │                   │
│  │  └─────────────────────────────────┘    │                   │
│  └─────────────────────────────────────────┘                   │
│                     │                                           │
│                     ▼                                           │
│  ┌─────────────────────────────────────────┐                   │
│  │  PubSub Publisher                       │                   │
│  │  - Incident Events                      │                   │
│  │  - GCP PubSub Topic: incidents          │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         ▲                              ▲                     ▲
         │                              │                     │
    GCP Cloud             Kubernetes         GCP Cloud
    Monitoring            API                Logging
    API                                      API
         │                              │                     │
    CPU, Memory,                   Pod Status            Logs (ERROR,
    Error Rate                     Info                  WARNING)
    Metrics                                              Analysis


┌──────────────────────────────┐
│  Backend RCA Service         │
│  ┌────────────────────────┐  │
│  │ PubSub Subscriber      │  │
│  │ - Listen for Incidents │  │
│  │ - Create Records       │  │
│  └────────────────────────┘  │
│           │                  │
│           ▼                  │
│  ┌────────────────────────┐  │
│  │ Incident Investigation │  │
│  │ - Fetch Logs via API   │  │
│  │ - Analyze Patterns     │  │
│  │ - Run RCA Analysis     │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

## Polling Flow

### Metrics Polling (Every 30 seconds)

```
Metrics Poller
│
├─ For each service in SERVICES_TO_MONITOR
│  └─ For each namespace in NAMESPACES_TO_MONITOR
│     └─ List pods with label app=<service>
│        └─ For each pod
│           ├─ Query CPU utilization from Cloud Monitoring
│           ├─ Query Memory utilization from Cloud Monitoring
│           ├─ Query Error rate from Cloud Logging
│           └─ Create Anomaly if threshold exceeded
│
└─ Process Anomalies → Incident Engine
```

### Pod Polling (Every 30 seconds)

```
Pod Poller
│
├─ For each service in SERVICES_TO_MONITOR
│  └─ For each namespace in NAMESPACES_TO_MONITOR
│     └─ List pods with label app=<service>
│        └─ For each pod
│           ├─ Check if pod crashed (Error, OOMKilled)
│           ├─ Check restart count in 5-min window
│           ├─ Check if pod is in Running phase
│           └─ Create Anomaly if condition met
│
└─ Process Anomalies → Incident Engine
```

## Incident Processing Flow

```
Anomaly Detected
│
├─ Generate incident key
│  │  Format: "namespace/pod/type"
│  │  Example: "production/user-svc-abc/HIGH_CPU"
│  │
│  └─ Check incident history
│
├─ Decision: Should raise incident?
│  │
│  ├─ If first occurrence or > 1 hour since last
│  │  └─ YES → Publish
│  │
│  └─ If within 1 hour
│     └─ NO → Increment occurrence count, skip publish
│
├─ If YES:
│  │
│  ├─ Calculate Severity
│  │  │
│  │  ├─ If type in [HIGH_ERROR_RATE, POD_CRASH]
│  │  │  └─ severity = CRITICAL
│  │  │
│  │  └─ Else by ratio (value / threshold)
│  │     ├─ ratio > 1.5 → CRITICAL
│  │     ├─ ratio > 1.2 → HIGH
│  │     ├─ ratio > 1.1 → MEDIUM
│  │     └─ ratio ≤ 1.1 → LOW
│  │
│  ├─ Create Incident Event
│  │  {
│  │    service, namespace, pod, type, severity,
│  │    occurrences, timestamp, value, threshold
│  │  }
│  │
│  └─ Publish to PubSub
│     │
│     └─ Message ID returned
│
└─ Update incident history
   {
     key, timestamp (now), occurrences (count)
   }
```

## Log Retrieval Flow

```
Log Fetcher
│
├─ Input: service, namespace, pod, incident timestamp
│
├─ Calculate time window
│  │  start: incident_time - 5 minutes
│  │  end:   incident_time + 5 minutes
│  │
│  └─ Total: 10-minute window
│
├─ Query Cloud Logging API
│  │  Filter:
│  │  - resource.type = k8s_pod
│  │  - pod name matches
│  │  - namespace matches
│  │  - severity IN [ERROR, WARNING]
│  │  - within time window
│  │
│  └─ Sort by timestamp (ascending)
│
├─ Analyze Results
│  │
│  ├─ Generate Summary
│  │  ├─ Total log count
│  │  ├─ Error count
│  │  ├─ Warning count
│  │  ├─ First log time
│  │  └─ Last log time
│  │
│  └─ Extract Error Patterns
│     ├─ Group by message prefix
│     ├─ Count occurrences
│     ├─ Sort by frequency
│     └─ Return top 10 patterns
│
└─ Return to Backend for RCA
   {
     logs: LogEntry[],
     summary: Statistics,
     patterns: ErrorPattern[]
   }
```

## Data Models

### Anomaly Event
```typescript
{
  service: string;        // "user-service"
  namespace: string;      // "production"
  pod: string;           // "user-service-abc-123"
  type: AnomalyType;     // "HIGH_CPU"
  value: number;         // 92.5
  threshold: number;     // 80
  timestamp: Date;       // 2026-05-24T10:30:00Z
}
```

### Incident Event (Published to PubSub)
```typescript
{
  service: string;       // "user-service"
  namespace: string;     // "production"
  pod: string;          // "user-service-abc-123"
  type: AnomalyType;    // "HIGH_CPU"
  severity: Severity;   // "HIGH"
  occurrences: number;  // 1
  timestamp: Date;      // 2026-05-24T10:30:00Z
  value?: number;       // 92.5
  threshold?: number;   // 80
}
```

### Log Entry
```typescript
{
  timestamp: Date;
  severity: string;     // "ERROR" | "WARNING"
  message: string;      // "Connection timeout after 30s"
  resource: string;     // "k8s_pod/user-service-abc"
  labels: {
    [key: string]: string;
    pod_name: string;
    namespace_name: string;
    service_name: string;
  }
}
```

### Pod Status
```typescript
{
  name: string;                      // "user-service-abc-123"
  namespace: string;                 // "production"
  phase: PodPhase;                  // "Running"
  restartCount: number;             // 5
  lastRestartTime?: Date;           // 2026-05-24T10:25:00Z
  crashed: boolean;                 // false
  service: string;                  // "user-service"
}
```

## Incident Deduplication Example

### Timeline

```
T=10:00 → First HIGH_CPU detected on pod-1
         └─ Incident published, key added to history
            history["prod/pod-1/HIGH_CPU"] = { occurrences: 1, timestamp: 10:00 }

T=10:30 → HIGH_CPU detected again on pod-1
         └─ Check history: key exists, < 1 hour old
         └─ NO incident published, occurrence count updated
            history["prod/pod-1/HIGH_CPU"] = { occurrences: 2, timestamp: 10:30 }

T=11:00 → HIGH_CPU detected on pod-1 again
         └─ Check history: key exists, exactly 1 hour old
         └─ YES incident published (new hour cycle begins)
            history["prod/pod-1/HIGH_CPU"] = { occurrences: 1, timestamp: 11:00 }

T=11:30 → Cleanup cycle runs
         └─ Remove entries older than 30 minutes ago (T=11:00)
         └─ Keep active incidents
```

## Error Handling & Recovery

```
API Call Fails
│
├─ GCP Cloud Monitoring
│  └─ Return null, log error, continue polling
│
├─ Kubernetes API
│  └─ Return empty list, log error, continue
│
├─ GCP Cloud Logging
│  └─ Return empty logs, log error, continue
│
└─ PubSub Publish
   └─ Log error, return null, incident lost (needs monitoring)

Service Shutdown
│
├─ SIGTERM received
│  ├─ Clear metrics interval
│  ├─ Clear pod interval
│  └─ Process exit
│
└─ SIGINT received
   ├─ Clear metrics interval
   ├─ Clear pod interval
   └─ Process exit
```

## Integration with Backend

```
Watcher → PubSub Topic (incidents)
            │
            ▼
Backend Subscriber
            │
            ├─ Parse message
            ├─ Validate schema
            ├─ Create incident record in database
            ├─ Trigger RCA analysis
            │
            └─ Call Watcher API:
               watcher.getIncidentLogs(service, namespace, pod, timestamp)
               │
               ├─ Fetch 10-minute window logs
               ├─ Analyze patterns
               ├─ Generate summary
               │
               └─ Return to backend
                  │
                  ├─ Store logs with incident
                  ├─ Feed to RCA engine
                  └─ Generate insights
```
