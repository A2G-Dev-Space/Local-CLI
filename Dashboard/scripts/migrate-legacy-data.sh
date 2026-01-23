#!/bin/bash
# ============================================
# Legacy Data Migration Script
# nexus-coder-db → dashboard-db
# Using docker compose exec
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Legacy Data Migration Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Container names
LEGACY_CONTAINER="nexus-coder-db"
NEW_CONTAINER="dashboard-db"

# Legacy DB credentials
LEGACY_USER="nexuscoder"
LEGACY_DB="nexuscoder"

# New DB credentials
NEW_USER="ax"
NEW_DB="axdashboard"

# Helper function to run psql on legacy DB
legacy_psql() {
    docker exec -i $LEGACY_CONTAINER psql -U $LEGACY_USER -d $LEGACY_DB "$@"
}

# Helper function to run psql on new DB
new_psql() {
    docker exec -i $NEW_CONTAINER psql -U $NEW_USER -d $NEW_DB "$@"
}

echo -e "\n${YELLOW}Step 1: Check legacy database connection...${NC}"
legacy_psql -c "SELECT COUNT(*) as user_count FROM users;" || {
    echo -e "${RED}Failed to connect to legacy database${NC}"
    exit 1
}
echo -e "${GREEN}✓ Legacy database connected${NC}"

echo -e "\n${YELLOW}Step 2: Check new database connection...${NC}"
new_psql -c "SELECT 1;" || {
    echo -e "${RED}Failed to connect to new database${NC}"
    exit 1
}
echo -e "${GREEN}✓ New database connected${NC}"

echo -e "\n${YELLOW}Step 3: Create nexus-coder service in new DB...${NC}"
SERVICE_ID=$(new_psql -t -A -c "
INSERT INTO services (id, name, \"displayName\", description, enabled, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'nexus-coder',
    'Nexus Coder',
    'AI Code Assistant Service (migrated from legacy)',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
RETURNING id;
" | grep -E '^[0-9a-f-]{36}$' | head -1)
echo -e "${GREEN}✓ Service ID: $SERVICE_ID${NC}"

echo -e "\n${YELLOW}Step 4: Migrate users...${NC}"
# Extract businessUnit from deptname format: "부서이름(사업부이름)" → 사업부이름
legacy_psql -t -A -c "SELECT id, loginid, username, deptname, \"firstSeen\", \"lastActive\", \"isActive\" FROM users;" | \
new_psql -c "
CREATE TEMP TABLE tmp_users (
    id TEXT, loginid TEXT, username TEXT, deptname TEXT,
    first_seen TIMESTAMP, last_active TIMESTAMP, is_active BOOLEAN
);
COPY tmp_users FROM STDIN WITH (DELIMITER '|');
INSERT INTO users (id, loginid, username, deptname, business_unit, \"firstSeen\", \"lastActive\", \"isActive\")
SELECT
    id::uuid, loginid, username, deptname,
    CASE
        WHEN deptname ~ '\\(.*\\)' THEN REGEXP_REPLACE(deptname, '.*\\((.*)\\).*', '\\1')
        ELSE NULL
    END as business_unit,
    first_seen, last_active, is_active
FROM tmp_users
ON CONFLICT (loginid) DO UPDATE SET
    username = EXCLUDED.username,
    deptname = EXCLUDED.deptname,
    business_unit = EXCLUDED.business_unit,
    \"lastActive\" = EXCLUDED.\"lastActive\";
DROP TABLE tmp_users;
"
USER_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM users;")
echo -e "${GREEN}✓ Users migrated: $USER_COUNT${NC}"

echo -e "\n${YELLOW}Step 5: Migrate admins (ADMIN → SERVICE_ADMIN)...${NC}"
legacy_psql -t -A -c "SELECT id, loginid, role, \"createdAt\" FROM admins;" | \
new_psql -c "
CREATE TEMP TABLE tmp_admins (
    id TEXT, loginid TEXT, role TEXT, created_at TIMESTAMP
);
COPY tmp_admins FROM STDIN WITH (DELIMITER '|');
INSERT INTO admins (id, loginid, role, \"createdAt\")
SELECT
    id::uuid, loginid,
    CASE
        WHEN role = 'ADMIN' THEN 'SERVICE_ADMIN'::\"AdminRole\"
        WHEN role = 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::\"AdminRole\"
        WHEN role = 'VIEWER' THEN 'VIEWER'::\"AdminRole\"
        ELSE 'SERVICE_ADMIN'::\"AdminRole\"
    END,
    created_at
FROM tmp_admins
ON CONFLICT (loginid) DO UPDATE SET role = EXCLUDED.role;
DROP TABLE tmp_admins;
"
ADMIN_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM admins;")
echo -e "${GREEN}✓ Admins migrated: $ADMIN_COUNT${NC}"

echo -e "\n${YELLOW}Step 6: Migrate models...${NC}"
legacy_psql -t -A -c "SELECT id, name, \"displayName\", \"endpointUrl\", \"apiKey\", \"maxTokens\", enabled, \"createdAt\", \"createdBy\" FROM models;" | \
new_psql -c "
CREATE TEMP TABLE tmp_models (
    id TEXT, name TEXT, display_name TEXT, endpoint_url TEXT,
    api_key TEXT, max_tokens INT, enabled BOOLEAN,
    created_at TIMESTAMP, created_by TEXT
);
COPY tmp_models FROM STDIN WITH (DELIMITER '|', NULL '');
INSERT INTO models (id, name, \"displayName\", \"endpointUrl\", \"apiKey\", \"maxTokens\", enabled, \"createdAt\", \"createdBy\", service_id)
SELECT id::uuid, name, display_name, endpoint_url, api_key, max_tokens, enabled, created_at, NULLIF(created_by, '')::uuid, '$SERVICE_ID'::uuid
FROM tmp_models
ON CONFLICT (id) DO UPDATE SET service_id = '$SERVICE_ID'::uuid;
DROP TABLE tmp_models;
"
MODEL_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM models;")
echo -e "${GREEN}✓ Models migrated: $MODEL_COUNT${NC}"

echo -e "\n${YELLOW}Step 7: Migrate usage_logs (this may take a while)...${NC}"
# Export all logs, filter in new DB for existing users/models
legacy_psql -t -A -c "SELECT id, user_id, model_id, \"inputTokens\", \"outputTokens\", \"totalTokens\", timestamp FROM usage_logs;" | \
new_psql -c "
CREATE TEMP TABLE tmp_logs (
    id TEXT, user_id TEXT, model_id TEXT,
    input_tokens INT, output_tokens INT, total_tokens INT,
    timestamp TIMESTAMP
);
COPY tmp_logs FROM STDIN WITH (DELIMITER '|');
INSERT INTO usage_logs (id, user_id, model_id, \"inputTokens\", \"outputTokens\", \"totalTokens\", timestamp, service_id)
SELECT t.id::uuid, t.user_id::uuid, t.model_id::uuid, t.input_tokens, t.output_tokens, t.total_tokens, t.timestamp, '$SERVICE_ID'::uuid
FROM tmp_logs t
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id::text = t.user_id)
  AND EXISTS (SELECT 1 FROM models m WHERE m.id::text = t.model_id)
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_logs;
"
LOG_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM usage_logs;")
echo -e "${GREEN}✓ Usage logs migrated: $LOG_COUNT${NC}"

echo -e "\n${YELLOW}Step 8: Migrate daily_usage_stats...${NC}"
# Export all stats, filter in new DB for existing users/models
legacy_psql -t -A -c "SELECT id, date, user_id, model_id, deptname, \"totalInputTokens\", \"totalOutputTokens\", \"requestCount\" FROM daily_usage_stats;" | \
new_psql -c "
CREATE TEMP TABLE tmp_stats (
    id TEXT, date DATE, user_id TEXT, model_id TEXT, deptname TEXT,
    total_input INT, total_output INT, request_count INT
);
COPY tmp_stats FROM STDIN WITH (DELIMITER '|');
INSERT INTO daily_usage_stats (id, date, user_id, model_id, deptname, \"totalInputTokens\", \"totalOutputTokens\", \"requestCount\", service_id)
SELECT t.id::uuid, t.date, t.user_id::uuid, t.model_id::uuid, t.deptname, t.total_input, t.total_output, t.request_count, '$SERVICE_ID'::uuid
FROM tmp_stats t
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id::text = t.user_id)
  AND EXISTS (SELECT 1 FROM models m WHERE m.id::text = t.model_id)
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_stats;
"
STATS_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM daily_usage_stats;")
echo -e "${GREEN}✓ Daily stats migrated: $STATS_COUNT${NC}"

echo -e "\n${YELLOW}Step 9: Migrate feedbacks...${NC}"
# Export all feedbacks, filter in new DB for existing users
legacy_psql -t -A -c "SELECT id, user_id, category, title, content, images, status, response, responded_by, responded_at, created_at, updated_at FROM feedbacks;" 2>/dev/null | \
new_psql -c "
CREATE TEMP TABLE tmp_feedbacks (
    id TEXT, user_id TEXT, category TEXT, title TEXT, content TEXT,
    images TEXT, status TEXT, response TEXT, responded_by TEXT,
    responded_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP
);
COPY tmp_feedbacks FROM STDIN WITH (DELIMITER '|', NULL '');
INSERT INTO feedbacks (id, user_id, category, title, content, images, status, response, responded_by, responded_at, created_at, updated_at, service_id)
SELECT
    t.id::uuid, t.user_id::uuid, t.category::\"FeedbackCategory\", t.title, t.content,
    CASE WHEN t.images IS NOT NULL AND t.images != '' THEN string_to_array(t.images, ',') ELSE ARRAY[]::TEXT[] END,
    t.status::\"FeedbackStatus\", t.response, NULLIF(t.responded_by, '')::uuid, t.responded_at, t.created_at, t.updated_at, '$SERVICE_ID'::uuid
FROM tmp_feedbacks t
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id::text = t.user_id)
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_feedbacks;
" 2>/dev/null || echo "  (No feedbacks or skipped)"
FEEDBACK_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM feedbacks;")
echo -e "${GREEN}✓ Feedbacks migrated: $FEEDBACK_COUNT${NC}"

echo -e "\n${YELLOW}Step 10: Migrate rating_feedbacks...${NC}"
legacy_psql -t -A -c "SELECT id, model_name, rating, timestamp FROM rating_feedbacks;" 2>/dev/null | \
new_psql -c "
CREATE TEMP TABLE tmp_ratings (
    id TEXT, model_name TEXT, rating INT, timestamp TIMESTAMP
);
COPY tmp_ratings FROM STDIN WITH (DELIMITER '|');
INSERT INTO rating_feedbacks (id, model_name, rating, timestamp, service_id)
SELECT id::uuid, model_name, rating, timestamp, '$SERVICE_ID'::uuid
FROM tmp_ratings
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_ratings;
" 2>/dev/null || echo "  (No ratings or skipped)"
RATING_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM rating_feedbacks;")
echo -e "${GREEN}✓ Ratings migrated: $RATING_COUNT${NC}"

echo -e "\n${YELLOW}Step 11: Decode URL-encoded Korean text...${NC}"
# Use Prisma in dashboard-api container for URL decoding
docker exec dashboard-api node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function decode() {
  // Decode users
  const users = await prisma.\$queryRaw\`SELECT id, username, deptname FROM users WHERE position('%' in username) > 0 OR position('%' in deptname) > 0\`;
  let userCount = 0;
  for (const row of users) {
    try {
      const username = decodeURIComponent(row.username || '');
      const deptname = decodeURIComponent(row.deptname || '');
      const match = deptname.match(/\\(([^)]+)\\)/);
      const businessUnit = match ? match[1] : null;
      await prisma.\$executeRaw\`UPDATE users SET username = \${username}, deptname = \${deptname}, business_unit = \${businessUnit} WHERE id = \${row.id}\`;
      userCount++;
    } catch(e) { console.error('User error:', row.id, e.message); }
  }
  console.log('Users decoded:', userCount);

  // Decode daily_usage_stats
  const stats = await prisma.\$queryRaw\`SELECT DISTINCT deptname FROM daily_usage_stats WHERE position('%' in deptname) > 0\`;
  let statsCount = 0;
  for (const row of stats) {
    try {
      const decoded = decodeURIComponent(row.deptname || '');
      await prisma.\$executeRaw\`UPDATE daily_usage_stats SET deptname = \${decoded} WHERE deptname = \${row.deptname}\`;
      statsCount++;
    } catch(e) { console.error('Stats error:', e.message); }
  }
  console.log('Stats decoded:', statsCount);

  await prisma.\$disconnect();
}
decode().catch(console.error);
"
DECODED_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM users WHERE position('%' in username) = 0;")
echo -e "${GREEN}✓ URL decoded. Users with clean names: $DECODED_COUNT${NC}"

echo -e "\n${YELLOW}Step 12: Create UserService records...${NC}"
new_psql -c "
INSERT INTO user_services (id, user_id, service_id, first_seen, last_active, request_count)
SELECT
    gen_random_uuid(),
    user_id,
    service_id,
    MIN(timestamp) as first_seen,
    MAX(timestamp) as last_active,
    COUNT(*) as request_count
FROM usage_logs
WHERE service_id IS NOT NULL
GROUP BY user_id, service_id
ON CONFLICT (user_id, service_id) DO UPDATE SET
    last_active = EXCLUDED.last_active,
    request_count = EXCLUDED.request_count;
"
US_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM user_services;")
echo -e "${GREEN}✓ UserService records created: $US_COUNT${NC}"

echo -e "\n${YELLOW}Step 13: Final verification...${NC}"
new_psql -c "
SELECT 'services' as table_name, COUNT(*) as count FROM services
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'admins', COUNT(*) FROM admins
UNION ALL SELECT 'models', COUNT(*) FROM models
UNION ALL SELECT 'usage_logs', COUNT(*) FROM usage_logs
UNION ALL SELECT 'daily_usage_stats', COUNT(*) FROM daily_usage_stats
UNION ALL SELECT 'feedbacks', COUNT(*) FROM feedbacks
UNION ALL SELECT 'rating_feedbacks', COUNT(*) FROM rating_feedbacks
UNION ALL SELECT 'user_services', COUNT(*) FROM user_services
ORDER BY table_name;
"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Migration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Service ID: ${YELLOW}$SERVICE_ID${NC}"
echo -e "\nBusinessUnit 추출 규칙: 부서이름(사업부이름) → 사업부이름"
echo -e "예: 'AI플랫폼팀(DS)' → businessUnit = 'DS'"
