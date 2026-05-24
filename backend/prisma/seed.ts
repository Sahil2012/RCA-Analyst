import { PrismaClient, Severity, IncidentType, IncidentStatus, IncidentSource, AnalysisStatus, GeneratedBy, ActionType, ActionPriority, ExecutionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean slate
  await prisma.remediationAction.deleteMany();
  await prisma.incidentAnalysis.deleteMany();
  await prisma.incident.deleteMany();

  console.log("🌱 Seeding...");

  // ── 1. CRITICAL pod crash on payment-service — RESOLVED ────────────────────
  // Represents: LLM needed 2 attempts, judge passed on second try
  const inc1 = await prisma.incident.create({
    data: {
      serviceName: "payment-service",
      namespace: "production",
      podName: "payment-service-7d9f8b-xk2p9",
      severity: Severity.CRITICAL,
      type: IncidentType.POD_CRASH,
      status: IncidentStatus.RESOLVED,
      occurrences: 4,
      source: IncidentSource.GCP_MONITORING,
      correlationId: "trace-4f2a1b9c",
      occurredAt: new Date("2025-05-23T14:32:00Z"),
      resolvedAt: new Date("2025-05-23T15:10:00Z"),
    },
  });

  const ana1 = await prisma.incidentAnalysis.create({
    data: {
      incidentId: inc1.id,
      rootCause:
        "OOMKilled event triggered on pod payment-service-7d9f8b-xk2p9 due to a memory leak introduced in v2.4.1 (commit a3f91cc). The payment processing loop retained database connection objects without releasing them, exhausting the 512Mi memory limit over approximately 18 minutes under peak load.",
      confidenceScore: 0.91,
      judgeScore: 0.88,
      judgeFeedback:
        "RCA correctly identifies the memory leak and the offending commit. Suggested fixes are actionable and ordered by impact.",
      attempts: 2,
      generatedBy: GeneratedBy.AI,
      logSource: "GCP_LOGGING",
      logQuery: `resource.type="k8s_container" resource.labels.namespace_name="production" resource.labels.pod_name="payment-service-7d9f8b-xk2p9" severity>=WARNING`,
      logWindowStart: new Date("2025-05-23T14:20:00Z"),
      logWindowEnd: new Date("2025-05-23T14:35:00Z"),
      status: AnalysisStatus.PASSED,
    },
  });

  await prisma.remediationAction.createMany({
    data: [
      {
        analysisId: ana1.id,
        actionTitle: "Rollback to v2.4.0",
        actionDescription:
          "Immediately roll back payment-service to v2.4.0 using `kubectl rollout undo deployment/payment-service -n production`. Confirm pod health before re-routing traffic.",
        actionType: ActionType.ROLLBACK,
        priority: ActionPriority.P0,
        confidenceScore: 0.95,
        automationSupported: true,
        executionStatus: ExecutionStatus.EXECUTED,
        executedAt: new Date("2025-05-23T14:48:00Z"),
      },
      {
        analysisId: ana1.id,
        actionTitle: "Patch connection pool release in v2.4.2",
        actionDescription:
          "Fix the DB connection leak in `PaymentProcessor.processLoop()` — ensure connections are released in the finally block. Increase memory limit to 768Mi as a short-term buffer.",
        actionType: ActionType.INCREASE_MEMORY,
        priority: ActionPriority.P1,
        confidenceScore: 0.87,
        automationSupported: false,
        executionStatus: ExecutionStatus.PENDING,
      },
    ],
  });

  // ── 2. HIGH error rate on api-gateway — INVESTIGATING ──────────────────────
  // Represents: Analysis passed on first attempt, SRE is actively working it
  const inc2 = await prisma.incident.create({
    data: {
      serviceName: "api-gateway",
      namespace: "production",
      podName: "api-gateway-6bc5d9-rp7w1",
      severity: Severity.HIGH,
      type: IncidentType.HIGH_ERROR_RATE,
      status: IncidentStatus.INVESTIGATING,
      occurrences: 12,
      source: IncidentSource.GCP_MONITORING,
      correlationId: "trace-8e3d2a1f",
      occurredAt: new Date("2025-05-24T08:15:00Z"),
    },
  });

  const ana2 = await prisma.incidentAnalysis.create({
    data: {
      incidentId: inc2.id,
      rootCause:
        "HTTP 502 error rate spiked to 34% on api-gateway starting at 08:15 UTC. Root cause is a misconfigured timeout on the upstream `inventory-service` route — the timeout was reduced from 30s to 3s in a config map update deployed at 08:02 UTC (ConfigMap `api-gateway-config` revision 14). Inventory service p95 latency is 8-12s during business hours, causing systematic timeouts.",
      confidenceScore: 0.93,
      judgeScore: 0.91,
      judgeFeedback:
        "Strong correlation established between config change and error spike. Timeline evidence is clear. Fix is straightforward.",
      attempts: 1,
      generatedBy: GeneratedBy.AI,
      logSource: "GCP_LOGGING",
      logQuery: `resource.type="k8s_container" resource.labels.namespace_name="production" resource.labels.container_name="api-gateway" severity>=WARNING`,
      logWindowStart: new Date("2025-05-24T08:10:00Z"),
      logWindowEnd: new Date("2025-05-24T08:25:00Z"),
      status: AnalysisStatus.PASSED,
    },
  });

  await prisma.remediationAction.createMany({
    data: [
      {
        analysisId: ana2.id,
        actionTitle: "Revert ConfigMap api-gateway-config to revision 13",
        actionDescription:
          "Run `kubectl rollout undo configmap/api-gateway-config -n production` or manually patch the timeout back to 30s. Verify error rate drops within 2 minutes.",
        actionType: ActionType.ROLLBACK,
        priority: ActionPriority.P0,
        confidenceScore: 0.96,
        automationSupported: true,
        executionStatus: ExecutionStatus.PENDING,
      },
      {
        analysisId: ana2.id,
        actionTitle: "Reduce inventory-service p95 latency",
        actionDescription:
          "Investigate inventory-service query performance during business hours. Add DB index on `product_id` and `updated_at` columns — execution plan shows full table scans on hot queries.",
        actionType: ActionType.OTHER,
        priority: ActionPriority.P2,
        confidenceScore: 0.74,
        automationSupported: false,
        executionStatus: ExecutionStatus.PENDING,
      },
    ],
  });

  // ── 3. HIGH CPU on recommendation-engine — RESOLVED ────────────────────────
  // Represents: Scaled up, clean resolution
  const inc3 = await prisma.incident.create({
    data: {
      serviceName: "recommendation-engine",
      namespace: "production",
      podName: "recommendation-engine-5c7b4d-mn8q2",
      severity: Severity.HIGH,
      type: IncidentType.HIGH_CPU,
      status: IncidentStatus.RESOLVED,
      occurrences: 7,
      source: IncidentSource.GCP_MONITORING,
      occurredAt: new Date("2025-05-23T20:45:00Z"),
      resolvedAt: new Date("2025-05-23T21:20:00Z"),
    },
  });

  const ana3 = await prisma.incidentAnalysis.create({
    data: {
      incidentId: inc3.id,
      rootCause:
        "CPU saturation (avg 94%, p95 99%) on recommendation-engine pods driven by a nightly model re-ranking job that was migrated to run every 15 minutes in the latest release. The job performs an O(n²) pairwise similarity computation on the full product catalogue (2.3M items) without any caching layer, causing CPU spikes across all 3 replicas simultaneously.",
      confidenceScore: 0.89,
      judgeScore: 0.85,
      attempts: 1,
      generatedBy: GeneratedBy.AI,
      logSource: "GCP_LOGGING",
      logQuery: `resource.type="k8s_container" resource.labels.namespace_name="production" resource.labels.container_name="recommendation-engine" severity>=WARNING`,
      logWindowStart: new Date("2025-05-23T20:40:00Z"),
      logWindowEnd: new Date("2025-05-23T20:55:00Z"),
      status: AnalysisStatus.PASSED,
    },
  });

  await prisma.remediationAction.createMany({
    data: [
      {
        analysisId: ana3.id,
        actionTitle: "Scale replicas from 3 to 6",
        actionDescription:
          "Immediately scale `kubectl scale deployment/recommendation-engine --replicas=6 -n production` to distribute CPU load while the underlying job frequency is fixed.",
        actionType: ActionType.INCREASE_REPLICAS,
        priority: ActionPriority.P1,
        confidenceScore: 0.88,
        automationSupported: true,
        executionStatus: ExecutionStatus.EXECUTED,
        executedAt: new Date("2025-05-23T20:58:00Z"),
      },
      {
        analysisId: ana3.id,
        actionTitle: "Revert re-ranking job frequency to nightly",
        actionDescription:
          "Change the CronJob schedule back from `*/15 * * * *` to `0 2 * * *` in `recommendation-engine-cronjob.yaml`. Long-term: add Redis caching layer for pairwise similarity scores.",
        actionType: ActionType.OTHER,
        priority: ActionPriority.P1,
        confidenceScore: 0.92,
        automationSupported: false,
        executionStatus: ExecutionStatus.EXECUTED,
        executedAt: new Date("2025-05-23T21:15:00Z"),
      },
    ],
  });

  // ── 4. HIGH MEMORY on analytics-worker — LOW_CONFIDENCE ────────────────────
  // Represents: Judge rejected all 3 attempts — logs were too sparse to RCA
  const inc4 = await prisma.incident.create({
    data: {
      serviceName: "analytics-worker",
      namespace: "staging",
      podName: "analytics-worker-3af12e-bc9x4",
      severity: Severity.MEDIUM,
      type: IncidentType.HIGH_MEMORY,
      status: IncidentStatus.LOW_CONFIDENCE,
      occurrences: 2,
      source: IncidentSource.GCP_MONITORING,
      occurredAt: new Date("2025-05-24T03:20:00Z"),
    },
  });

  await prisma.incidentAnalysis.create({
    data: {
      incidentId: inc4.id,
      rootCause:
        "Memory usage reached 89% of the 256Mi limit on analytics-worker. Possible causes include unbounded in-memory aggregation of event streams or a dependency holding large buffers, but insufficient ERROR/WARN log coverage in the observation window prevents a definitive attribution.",
      confidenceScore: 0.48,
      judgeScore: 0.41,
      judgeFeedback:
        "RCA is speculative — no direct evidence in logs links to a specific code path. Root cause candidates are listed but not substantiated. Recommend enabling DEBUG logging for next occurrence.",
      attempts: 3,
      generatedBy: GeneratedBy.AI,
      logSource: "GCP_LOGGING",
      logQuery: `resource.type="k8s_container" resource.labels.namespace_name="staging" resource.labels.container_name="analytics-worker" severity>=WARNING`,
      logWindowStart: new Date("2025-05-24T03:10:00Z"),
      logWindowEnd: new Date("2025-05-24T03:25:00Z"),
      status: AnalysisStatus.LOW_CONFIDENCE,
    },
  });

  // ── 5. Transient CPU spike on batch-processor — FALSE_POSITIVE ─────────────
  // Represents: Spike lasted < 30s, correctly filtered out
  await prisma.incident.create({
    data: {
      serviceName: "batch-processor",
      namespace: "production",
      podName: "batch-processor-9de34c-qt5m7",
      severity: Severity.MEDIUM,
      type: IncidentType.HIGH_CPU,
      status: IncidentStatus.FALSE_POSITIVE,
      occurrences: 1,
      source: IncidentSource.GCP_MONITORING,
      occurredAt: new Date("2025-05-24T06:00:00Z"),
    },
  });

  // ── 6. CRITICAL latency spike on user-auth-service — OPEN ──────────────────
  // Represents: Just detected, analysis pipeline running
  await prisma.incident.create({
    data: {
      serviceName: "user-auth-service",
      namespace: "production",
      podName: "user-auth-service-2bc78a-lk3p1",
      severity: Severity.CRITICAL,
      type: IncidentType.LATENCY_SPIKE,
      status: IncidentStatus.OPEN,
      occurrences: 9,
      source: IncidentSource.GCP_MONITORING,
      correlationId: "trace-1c9f7e3a",
      occurredAt: new Date("2025-05-24T10:58:00Z"),
    },
  });

  console.log("✅ Seed complete");
  console.log("   6 incidents | 4 analyses | 6 remediation actions");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
