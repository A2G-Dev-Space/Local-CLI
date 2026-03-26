#!/usr/bin/env bash
set -euo pipefail

#
# Blue-Green Deployment for Hanseol Web
#
# Usage: ./deploy.sh [--ssl]
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="${SCRIPT_DIR}/.deploy-state"
COMPOSE_BASE="-f ${SCRIPT_DIR}/docker-compose.yml"

# SSL override
if [[ "${1:-}" == "--ssl" ]]; then
  COMPOSE_BASE="${COMPOSE_BASE} -f ${SCRIPT_DIR}/docker-compose.ssl.yml"
fi

# Read current active slot (default: blue)
if [[ -f "$STATE_FILE" ]]; then
  ACTIVE=$(cat "$STATE_FILE")
else
  ACTIVE="blue"
fi

if [[ "$ACTIVE" == "blue" ]]; then
  INACTIVE="green"
else
  INACTIVE="blue"
fi

echo "=== Hanseol Web Blue-Green Deploy ==="
echo "Active:   $ACTIVE"
echo "Inactive: $INACTIVE (will deploy here)"
echo ""

# Step 1: Build inactive slot
echo "[1/6] Building ${INACTIVE} containers..."
docker compose ${COMPOSE_BASE} --profile ${INACTIVE} build "api-${INACTIVE}" "frontend-${INACTIVE}"

# Step 2: Start inactive slot
echo "[2/6] Starting ${INACTIVE} containers..."
docker compose ${COMPOSE_BASE} --profile ${INACTIVE} up -d "api-${INACTIVE}" "frontend-${INACTIVE}"

# Step 3: Wait for health check on inactive API
echo "[3/6] Waiting for api-${INACTIVE} health check..."
RETRIES=30
for i in $(seq 1 $RETRIES); do
  if docker compose ${COMPOSE_BASE} --profile ${INACTIVE} exec -T "api-${INACTIVE}" \
    wget -qO- http://localhost:${PORT:-3000}/api/health >/dev/null 2>&1; then
    echo "  api-${INACTIVE} is healthy"
    break
  fi
  if [[ $i -eq $RETRIES ]]; then
    echo "ERROR: api-${INACTIVE} failed health check after ${RETRIES} attempts"
    echo "Rolling back..."
    docker compose ${COMPOSE_BASE} --profile ${INACTIVE} stop "api-${INACTIVE}" "frontend-${INACTIVE}"
    exit 1
  fi
  echo "  Attempt $i/$RETRIES - waiting..."
  sleep 2
done

# Step 4: Switch nginx upstream by updating template and reloading
echo "[4/6] Switching nginx upstream to ${INACTIVE}..."

NGINX_TEMPLATE="${SCRIPT_DIR}/../nginx/nginx.conf.template"
sed -i "s/api-${ACTIVE}/api-${INACTIVE}/g; s/frontend-${ACTIVE}/frontend-${INACTIVE}/g" "$NGINX_TEMPLATE"

docker compose ${COMPOSE_BASE} exec -T nginx nginx -s reload

echo "  nginx now points to ${INACTIVE}"

# Step 5: Stop old active slot (keep infra running)
echo "[5/6] Stopping old ${ACTIVE} containers..."
sleep 3  # brief drain period
docker compose ${COMPOSE_BASE} stop "api-${ACTIVE}" "frontend-${ACTIVE}" 2>/dev/null || true

# Step 6: Save new state
echo "[6/6] Saving deploy state..."
echo "$INACTIVE" > "$STATE_FILE"

echo ""
echo "=== Deploy complete ==="
echo "Active slot: ${INACTIVE}"
echo "Stopped slot: ${ACTIVE}"
