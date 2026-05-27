# Kubernetes Deployment — Both Services

Two Node.js services running on a single GKE node.

## 📁 Folder Structure (expected layout)

```
project-root/
├── api-service/         ← from first zip (open APIs)
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── crud-service/        ← from this zip (Supabase CRUD)
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
└── k8s-both/            ← this folder
    ├── k8s/
    │   ├── 00-namespace.yaml
    │   ├── 01-secret-api-service.yaml   ← add your open API keys here
    │   ├── 01-secret-crud-service.yaml  ← Supabase keys (pre-filled)
    │   ├── 02-deployment-api-service.yaml
    │   ├── 03-deployment-crud-service.yaml
    │   └── 04-services.yaml
    └── scripts/
        ├── deploy-both.sh
        └── teardown.sh
```

## 🚀 Deploy Steps

### 1. Fill in your open API keys
Edit `k8s/01-secret-api-service.yaml` with your keys for OpenWeatherMap, NewsAPI, TMDB.

### 2. Edit PROJECT_ID in deploy script
```bash
nano scripts/deploy-both.sh
# Set PROJECT_ID="your-actual-gcp-project-id"
```

### 3. Run deploy
```bash
chmod +x scripts/deploy-both.sh scripts/teardown.sh
./scripts/deploy-both.sh
```

## 📡 Access Services

Open two terminals:

**Terminal 1 — api-service (port 8080)**
```bash
kubectl port-forward svc/api-service 8080:80 -n services
```

**Terminal 2 — crud-service (port 8081)**
```bash
kubectl port-forward svc/crud-service 8081:80 -n services
```

## 🧪 Test CRUD Service

```bash
# Create user
curl -X POST http://localhost:8081/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# List users
curl http://localhost:8081/api/users

# List with pagination
curl "http://localhost:8081/api/users?page=1&limit=5"

# Search
curl "http://localhost:8081/api/users?search=alice"

# Get by ID
curl http://localhost:8081/api/users/1

# Update (full replace)
curl -X PUT http://localhost:8081/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Updated", "email": "alice.new@example.com"}'

# Partial update
curl -X PATCH http://localhost:8081/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Smith"}'

# Delete
curl -X DELETE http://localhost:8081/api/users/1
```

## 🔄 Redeploy After Code Change

```bash
# Rebuild and push just one image
gcloud builds submit ../../crud-service --tag gcr.io/PROJECT_ID/crud-service:latest
kubectl rollout restart deployment/crud-service -n services
```

## 💰 Cost

Both pods run on a single e2-small Spot VM node (~$5–8/mo).
Cluster management fee is $0 (covered by GKE free tier credit).
