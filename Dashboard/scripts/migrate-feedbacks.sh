#!/bin/bash
# ============================================
# Feedback Migration Script
# nexus-coder-db → dashboard-db
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Feedback Migration Script${NC}"
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

echo -e "\n${YELLOW}Step 1: Check connections...${NC}"
legacy_psql -c "SELECT COUNT(*) as feedback_count FROM feedbacks;" || {
    echo -e "${RED}Failed to connect to legacy database${NC}"
    exit 1
}
new_psql -c "SELECT 1;" > /dev/null || {
    echo -e "${RED}Failed to connect to new database${NC}"
    exit 1
}
echo -e "${GREEN}✓ Both databases connected${NC}"

echo -e "\n${YELLOW}Step 2: Get service ID...${NC}"
SERVICE_ID=$(new_psql -t -A -c "SELECT id FROM services WHERE name='nexus-coder';")
if [ -z "$SERVICE_ID" ]; then
    echo -e "${RED}Service 'nexus-coder' not found. Run main migration first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Service ID: $SERVICE_ID${NC}"

echo -e "\n${YELLOW}Step 3: Check legacy feedbacks...${NC}"
legacy_psql -c "SELECT id, category, status, LEFT(title, 30) as title, created_at FROM feedbacks ORDER BY created_at;"

echo -e "\n${YELLOW}Step 4: Migrate feedbacks (without images)...${NC}"
# Use CSV format to handle newlines and special characters in content
legacy_psql -c "COPY (SELECT id, user_id, category, title, content, status, response, responded_by, responded_at, created_at, updated_at FROM feedbacks) TO STDOUT WITH (FORMAT csv, HEADER false, NULL '');" | \
new_psql -c "
CREATE TEMP TABLE tmp_feedbacks (
    id TEXT, user_id TEXT, category TEXT, title TEXT, content TEXT,
    status TEXT, response TEXT, responded_by TEXT,
    responded_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP
);
COPY tmp_feedbacks FROM STDIN WITH (FORMAT csv, NULL '');
INSERT INTO feedbacks (id, user_id, category, title, content, images, status, response, responded_by, responded_at, created_at, updated_at, service_id)
SELECT
    t.id::uuid, t.user_id::uuid, t.category::\"FeedbackCategory\", t.title, t.content,
    ARRAY[]::TEXT[],
    t.status::\"FeedbackStatus\", t.response, NULLIF(t.responded_by, '')::uuid, t.responded_at, t.created_at, t.updated_at, '$SERVICE_ID'::uuid
FROM tmp_feedbacks t
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id::text = t.user_id)
ON CONFLICT (id) DO UPDATE SET
    service_id = '$SERVICE_ID'::uuid,
    updated_at = EXCLUDED.updated_at;
DROP TABLE tmp_feedbacks;
"
FEEDBACK_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM feedbacks;")
echo -e "${GREEN}✓ Feedbacks migrated: $FEEDBACK_COUNT${NC}"

echo -e "\n${YELLOW}Step 5: Migrate feedback_comments...${NC}"
# Check if feedback_comments exists in legacy
HAS_COMMENTS=$(legacy_psql -t -A -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback_comments');" 2>/dev/null || echo "f")
if [ "$HAS_COMMENTS" = "t" ]; then
    COMMENT_COUNT_LEGACY=$(legacy_psql -t -A -c "SELECT COUNT(*) FROM feedback_comments;")
    echo -e "  Legacy comments: $COMMENT_COUNT_LEGACY"

    if [ "$COMMENT_COUNT_LEGACY" -gt 0 ]; then
        legacy_psql -c "COPY (SELECT id, feedback_id, admin_id, content, created_at, updated_at FROM feedback_comments) TO STDOUT WITH (FORMAT csv, HEADER false, NULL '');" | \
        new_psql -c "
CREATE TEMP TABLE tmp_comments (
    id TEXT, feedback_id TEXT, admin_id TEXT, content TEXT,
    created_at TIMESTAMP, updated_at TIMESTAMP
);
COPY tmp_comments FROM STDIN WITH (FORMAT csv, NULL '');
INSERT INTO feedback_comments (id, feedback_id, admin_id, content, created_at, updated_at)
SELECT t.id::uuid, t.feedback_id::uuid, t.admin_id::uuid, t.content, t.created_at, t.updated_at
FROM tmp_comments t
WHERE EXISTS (SELECT 1 FROM feedbacks f WHERE f.id::text = t.feedback_id)
  AND EXISTS (SELECT 1 FROM admins a WHERE a.id::text = t.admin_id)
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_comments;
"
    fi
    COMMENT_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM feedback_comments;")
    echo -e "${GREEN}✓ Comments migrated: $COMMENT_COUNT${NC}"
else
    echo -e "  No feedback_comments table in legacy DB"
fi

echo -e "\n${YELLOW}Step 6: Migrate rating_feedbacks...${NC}"
HAS_RATINGS=$(legacy_psql -t -A -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rating_feedbacks');" 2>/dev/null || echo "f")
if [ "$HAS_RATINGS" = "t" ]; then
    RATING_COUNT_LEGACY=$(legacy_psql -t -A -c "SELECT COUNT(*) FROM rating_feedbacks;")
    echo -e "  Legacy ratings: $RATING_COUNT_LEGACY"

    if [ "$RATING_COUNT_LEGACY" -gt 0 ]; then
        legacy_psql -t -A -c "SELECT id, model_name, rating, timestamp FROM rating_feedbacks;" | \
        new_psql -c "
CREATE TEMP TABLE tmp_ratings (
    id TEXT, model_name TEXT, rating INT, timestamp TIMESTAMP
);
COPY tmp_ratings FROM STDIN WITH (DELIMITER '|');
INSERT INTO rating_feedbacks (id, model_name, rating, timestamp, service_id)
SELECT id::uuid, model_name, rating, timestamp, '$SERVICE_ID'::uuid
FROM tmp_ratings
ON CONFLICT (id) DO UPDATE SET service_id = '$SERVICE_ID'::uuid;
DROP TABLE tmp_ratings;
"
    fi
    RATING_COUNT=$(new_psql -t -A -c "SELECT COUNT(*) FROM rating_feedbacks;")
    echo -e "${GREEN}✓ Ratings migrated: $RATING_COUNT${NC}"
else
    echo -e "  No rating_feedbacks table in legacy DB"
fi

echo -e "\n${YELLOW}Step 7: Verification...${NC}"
new_psql -c "
SELECT 'feedbacks' as table_name, COUNT(*) as count, COUNT(service_id) as with_service FROM feedbacks
UNION ALL
SELECT 'feedback_comments', COUNT(*), COUNT(*) FROM feedback_comments
UNION ALL
SELECT 'rating_feedbacks', COUNT(*), COUNT(service_id) FROM rating_feedbacks;
"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Feedback Migration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
