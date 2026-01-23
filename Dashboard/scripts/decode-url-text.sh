#!/bin/bash
# ============================================
# Decode URL-encoded Korean text in database
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Decode URL-encoded Text${NC}"
echo -e "${GREEN}========================================${NC}"

# Run decode in dashboard-api container
docker exec dashboard-api node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function decode() {
  console.log('Decoding URL-encoded text...');

  // Decode users table
  const users = await prisma.\$queryRaw\`
    SELECT id, username, deptname
    FROM users
    WHERE position('%' in username) > 0 OR position('%' in deptname) > 0
  \`;

  let userCount = 0;
  for (const row of users) {
    try {
      const username = row.username ? decodeURIComponent(row.username) : row.username;
      const deptname = row.deptname ? decodeURIComponent(row.deptname) : row.deptname;
      const match = deptname ? deptname.match(/\\(([^)]+)\\)/) : null;
      const businessUnit = match ? match[1] : null;

      await prisma.\$executeRaw\`
        UPDATE users
        SET username = \${username}, deptname = \${deptname}, business_unit = \${businessUnit}
        WHERE id = \${row.id}
      \`;
      userCount++;
    } catch(e) {
      console.error('User decode error:', row.id, e.message);
    }
  }
  console.log('Users decoded:', userCount);

  // Decode daily_usage_stats table
  const stats = await prisma.\$queryRaw\`
    SELECT DISTINCT deptname
    FROM daily_usage_stats
    WHERE position('%' in deptname) > 0
  \`;

  let statsCount = 0;
  for (const row of stats) {
    try {
      const decoded = decodeURIComponent(row.deptname);
      await prisma.\$executeRaw\`
        UPDATE daily_usage_stats
        SET deptname = \${decoded}
        WHERE deptname = \${row.deptname}
      \`;
      statsCount++;
    } catch(e) {
      console.error('Stats decode error:', e.message);
    }
  }
  console.log('Stats deptnames decoded:', statsCount);

  // Decode feedbacks title/content if needed
  const feedbacks = await prisma.\$queryRaw\`
    SELECT id, title, content
    FROM feedbacks
    WHERE position('%' in title) > 0 OR position('%' in content) > 0
  \`;

  let fbCount = 0;
  for (const row of feedbacks) {
    try {
      const title = row.title ? decodeURIComponent(row.title) : row.title;
      const content = row.content ? decodeURIComponent(row.content) : row.content;
      await prisma.\$executeRaw\`
        UPDATE feedbacks
        SET title = \${title}, content = \${content}
        WHERE id = \${row.id}
      \`;
      fbCount++;
    } catch(e) {
      console.error('Feedback decode error:', row.id, e.message);
    }
  }
  console.log('Feedbacks decoded:', fbCount);

  await prisma.\$disconnect();
  console.log('Done!');
}

decode().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
"

echo -e "${GREEN}✓ Decoding complete${NC}"
