#!/bin/bash
PROJECT_ID="your-gcp-project-id"
CLUSTER_NAME="api-cluster"
REGION="us-central1"

echo "🛑 Deleting cluster to stop billing..."
gcloud container clusters delete $CLUSTER_NAME \
  --zone=${REGION}-a \
  --project=$PROJECT_ID \
  --quiet

echo "✅ Done. No more charges."
