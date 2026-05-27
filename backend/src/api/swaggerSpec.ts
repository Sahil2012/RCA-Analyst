export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title:       'RCA Analyst API',
    version:     '1.0.0',
    description: 'REST API for the RCA Analyst — browse incidents, full AI-generated RCA reports, and manage remediation actions.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local' }],
  tags: [
    { name: 'Incidents', description: 'Incident lifecycle and RCA reports' },
    { name: 'Actions',   description: 'Remediation actions management' },
  ],
  paths: {
    '/api/incidents': {
      get: {
        tags:        ['Incidents'],
        summary:     'List incidents',
        operationId: 'listIncidents',
        parameters: [
          {
            name: 'status', in: 'query', schema: {
              type: 'string',
              enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE', 'LOW_CONFIDENCE'],
            },
            description: 'Filter by incident status',
          },
          { name: 'limit',  in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': {
            description: 'Paginated incident list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    incidents: { type: 'array', items: { $ref: '#/components/schemas/IncidentSummary' } },
                    total:     { type: 'integer', example: 47 },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/incidents/{id}': {
      get: {
        tags:        ['Incidents'],
        summary:     'Get incident details',
        operationId: 'getIncident',
        parameters:  [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Incident with latest analysis summary',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/IncidentDetail' } } },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/incidents/{id}/analysis': {
      get: {
        tags:        ['Incidents'],
        summary:     'Get full RCA report for an incident',
        operationId: 'getIncidentAnalysis',
        parameters:  [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Full RCA analysis including 5-Whys, Mermaid diagram, and remediation actions',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AnalysisReport' } } },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/actions': {
      get: {
        tags:        ['Actions'],
        summary:     'List remediation actions',
        operationId: 'listActions',
        parameters: [
          {
            name: 'executionStatus', in: 'query', schema: {
              type: 'string',
              enum: ['PENDING', 'EXECUTED', 'FAILED', 'SKIPPED'],
            },
          },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'List of remediation actions with incident context',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    actions: { type: 'array', items: { $ref: '#/components/schemas/ActionWithContext' } },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/actions/{id}/status': {
      patch: {
        tags:        ['Actions'],
        summary:     'Update action execution status',
        operationId: 'updateActionStatus',
        parameters:  [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type:       'object',
                required:   ['executionStatus'],
                properties: {
                  executionStatus: {
                    type: 'string',
                    enum: ['PENDING', 'EXECUTED', 'FAILED', 'SKIPPED'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated action status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id:              { type: 'string', format: 'uuid' },
                    executionStatus: { type: 'string', enum: ['PENDING', 'EXECUTED', 'FAILED', 'SKIPPED'] },
                    executedAt:      { type: 'string', format: 'date-time', nullable: true },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },

  components: {
    responses: {
      NotFound:   { description: 'Not found',       content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      BadRequest: { description: 'Bad request',     content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },

      IncidentSummary: {
        type: 'object',
        properties: {
          id:            { type: 'string', format: 'uuid' },
          serviceName:   { type: 'string', example: 'payment-service' },
          namespace:     { type: 'string', example: 'production' },
          severity:      { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          type:          { type: 'string', enum: ['POD_CRASH', 'HIGH_CPU', 'HIGH_MEMORY', 'HIGH_ERROR_RATE', 'LATENCY_SPIKE'] },
          status:        { type: 'string', enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE', 'LOW_CONFIDENCE'] },
          occurrences:   { type: 'integer', example: 3 },
          occurredAt:    { type: 'string', format: 'date-time' },
          analysisCount: { type: 'integer', example: 1 },
        },
      },

      IncidentDetail: {
        allOf: [
          { $ref: '#/components/schemas/IncidentSummary' },
          {
            type: 'object',
            properties: {
              podName:        { type: 'string', nullable: true },
              source:         { type: 'string', enum: ['GCP_MONITORING', 'GCP_LOGGING', 'MANUAL'] },
              correlationId:  { type: 'string', nullable: true },
              resolvedAt:     { type: 'string', format: 'date-time', nullable: true },
              createdAt:      { type: 'string', format: 'date-time' },
              latestAnalysis: {
                nullable: true,
                type:     'object',
                properties: {
                  id:             { type: 'string', format: 'uuid' },
                  status:         { type: 'string', enum: ['PENDING', 'PASSED', 'FAILED', 'LOW_CONFIDENCE'] },
                  confidenceScore: { type: 'number', example: 0.87 },
                  judgeScore:     { type: 'number', example: 0.91 },
                },
              },
            },
          },
        ],
      },

      FiveWhy: {
        type: 'object',
        properties: {
          question: { type: 'string', example: 'Why did the service crash?' },
          answer:   { type: 'string', example: 'OOMKilled — memory limit exceeded under load spike.' },
        },
      },

      RemediationAction: {
        type: 'object',
        properties: {
          id:                  { type: 'string', format: 'uuid' },
          actionTitle:         { type: 'string', example: 'Increase memory limit to 2Gi' },
          actionDescription:   { type: 'string' },
          actionType:          { type: 'string', enum: ['RESTART_SERVICE', 'SCALE_UP', 'ROLLBACK', 'INCREASE_MEMORY', 'INCREASE_REPLICAS', 'OTHER'] },
          priority:            { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          confidenceScore:     { type: 'number', example: 0.9 },
          confidenceLevel:     { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'], nullable: true },
          automationSupported: { type: 'boolean' },
          blastRadius:         { type: 'string', nullable: true, example: 'Affects payment-service pods only' },
          downtimeRisk:        { type: 'string', nullable: true, example: 'Rolling restart — 30s per pod' },
          rollback:            { type: 'string', nullable: true, example: 'Revert Helm values to previous memory limit' },
          executionStatus:     { type: 'string', enum: ['PENDING', 'EXECUTED', 'FAILED', 'SKIPPED'] },
          executedAt:          { type: 'string', format: 'date-time', nullable: true },
        },
      },

      AnalysisReport: {
        type: 'object',
        properties: {
          id:              { type: 'string', format: 'uuid' },
          incidentId:      { type: 'string', format: 'uuid' },
          rootCause:       { type: 'string', example: 'Memory leak in payment processor under burst load.' },
          confidenceScore: { type: 'number', example: 0.87 },
          judgeScore:      { type: 'number', example: 0.91 },
          judgeFeedback:   { type: 'string', nullable: true },
          fiveWhys: {
            type:  'array',
            items: { $ref: '#/components/schemas/FiveWhy' },
          },
          symptomDiagram: {
            type:    'string',
            example: 'graph TD\n  A[Memory Leak] --> B[OOM Kill]\n  B --> C[Pod Restart]\n  C --> D[5xx Errors]',
            description: 'Mermaid flowchart — root cause → symptoms',
          },
          attempts:       { type: 'integer', example: 2 },
          status:         { type: 'string', enum: ['PENDING', 'PASSED', 'FAILED', 'LOW_CONFIDENCE'] },
          logWindowStart: { type: 'string', format: 'date-time', nullable: true },
          logWindowEnd:   { type: 'string', format: 'date-time', nullable: true },
          createdAt:      { type: 'string', format: 'date-time' },
          actions:        { type: 'array', items: { $ref: '#/components/schemas/RemediationAction' } },
        },
      },

      ActionWithContext: {
        allOf: [
          { $ref: '#/components/schemas/RemediationAction' },
          {
            type: 'object',
            properties: {
              analysis: {
                type: 'object',
                properties: {
                  incidentId: { type: 'string', format: 'uuid' },
                  incident: {
                    type: 'object',
                    properties: {
                      serviceName: { type: 'string' },
                      namespace:   { type: 'string' },
                      severity:    { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                      type:        { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    },
  },
}
