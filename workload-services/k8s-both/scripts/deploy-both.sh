#!/bin/bash
# ============================================================
# Deploy BOTH services to GKE (single e2-small node)
# api-service  → /api/* (open APIs aggregator)
# crud-service → /api/users (Supabase CRUD)
# ============================================================

set -e

# ---- CONFIGURE THESE ----
PROJECT_ID="incident-analysis-497217"
REGION="us-central1"
CLUSTER_NAME="api-cluster"
API_SERVICE_DIR="../../api-service"      # path to api-service folder
CRUD_SERVICE_DIR="../../crud-service"    # path to crud-service folder
# -------------------------

echo "🔧 [1/8] Setting GCP project..."
gcloud config set project $PROJECT_ID

echo "🔧 [2/8] Enabling required GCP APIs..."
gcloud services enable \
  container.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com

echo "🔧 [3/8] Creating GKE cluster (1x e2-small Spot VM, single zone)..."
gcloud container clusters create $CLUSTER_NAME \
  --zone=${REGION}-a \
  --num-nodes=1 \
  --machine-type=e2-small \
  --disk-size=20 \
  --disk-type=pd-standard \
  --spot \
  --no-enable-autoupgrade \
  --no-enable-autorepair 2>/dev/null || echo "Cluster already exists, skipping..."

echo "🔧 [4/8] Getting cluster credentials..."
gcloud container clusters get-credentials $CLUSTER_NAME --zone=${REGION}-a

echo "🔧 [5/8] Building & pushing api-service image..."
gcloud builds submit $API_SERVICE_DIR \
  --tag gcr.io/$PROJECT_ID/api-service:latest

echo "🔧 [6/8] Building & pushing crud-service image..."
gcloud builds submit $CRUD_SERVICE_DIR \
  --tag gcr.io/$PROJECT_ID/crud-service:latest

echo "🔧 [7/8] Patching image references in manifests..."
sed -i "s|gcr.io/PROJECT_ID/api-service|gcr.io/$PROJECT_ID/api-service|g" \
  ../k8s/02-deployment-api-service.yaml
sed -i "s|gcr.io/PROJECT_ID/crud-service|gcr.io/$PROJECT_ID/crud-service|g" \
  ../k8s/03-deployment-crud-service.yaml

echo "🔧 [8/8] Applying all Kubernetes manifests..."
kubectl apply -f ../k8s/00-namespace.yaml
kubectl apply -f ../k8s/01-secret-api-service.yaml
kubectl apply -f ../k8s/01-secret-crud-service.yaml
kubectl apply -f ../k8s/02-deployment-api-service.yaml
kubectl apply -f ../k8s/03-deployment-crud-service.yaml
kubectl apply -f ../k8s/04-services.yaml

echo ""
echo "⏳ Waiting for rollouts..."
kubectl rollout status deployment/api-service  -n services
kubectl rollout status deployment/crud-service -n services

echo ""
echo "✅ Both services deployed!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 Access api-service (open APIs):"
echo "   kubectl port-forward svc/api-service 8080:80 -n services"
echo "   → http://localhost:8080"
echo ""
echo "📡 Access crud-service (Supabase users):"
echo "   kubectl port-forward svc/crud-service 8081:80 -n services"
echo "   → http://localhost:8081"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Check status:"
echo "   kubectl get pods -n services"
echo "   kubectl get svc  -n services"
