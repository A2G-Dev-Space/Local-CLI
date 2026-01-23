#!/bin/bash
# ============================================
# Rating Service Migration Script
# Set existing ratings (without service_id) to nexus-coder
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Rating Service Migration Script${NC}"
echo -e "${GREEN}========================================${NC}"

# DB Container
CONTAINER="dashboard-db"
DB_USER="ax"
DB_NAME="axdashboard"

# Helper function
run_psql() {
    docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME "$@"
}

echo -e "\n${YELLOW}Step 1: Check connection...${NC}"
run_psql -c "SELECT 1;" > /dev/null || {
    echo -e "${RED}Failed to connect to database${NC}"
    exit 1
}
echo -e "${GREEN}✓ Database connected${NC}"

echo -e "\n${YELLOW}Step 2: Get nexus-coder service ID...${NC}"
SERVICE_ID=$(run_psql -t -A -c "SELECT id FROM services WHERE name='nexus-coder';")
if [ -z "$SERVICE_ID" ]; then
    echo -e "${RED}Service 'nexus-coder' not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Service ID: $SERVICE_ID${NC}"

echo -e "\n${YELLOW}Step 3: Check ratings without service_id...${NC}"
NULL_COUNT=$(run_psql -t -A -c "SELECT COUNT(*) FROM rating_feedbacks WHERE service_id IS NULL;")
TOTAL_COUNT=$(run_psql -t -A -c "SELECT COUNT(*) FROM rating_feedbacks;")
echo -e "  Total ratings: $TOTAL_COUNT"
echo -e "  Ratings without service_id: $NULL_COUNT"

if [ "$NULL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ All ratings already have service_id${NC}"
    exit 0
fi

echo -e "\n${YELLOW}Step 4: Update ratings to nexus-coder...${NC}"
run_psql -c "UPDATE rating_feedbacks SET service_id = '$SERVICE_ID'::uuid WHERE service_id IS NULL;"

echo -e "\n${YELLOW}Step 5: Verification...${NC}"
UPDATED_COUNT=$(run_psql -t -A -c "SELECT COUNT(*) FROM rating_feedbacks WHERE service_id = '$SERVICE_ID';")
STILL_NULL=$(run_psql -t -A -c "SELECT COUNT(*) FROM rating_feedbacks WHERE service_id IS NULL;")
echo -e "  Ratings with nexus-coder: $UPDATED_COUNT"
echo -e "  Ratings still without service_id: $STILL_NULL"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Migration Complete!${NC}"
echo -e "${GREEN}  Updated $NULL_COUNT ratings to nexus-coder${NC}"
echo -e "${GREEN}========================================${NC}"
