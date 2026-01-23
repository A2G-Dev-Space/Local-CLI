#!/bin/bash
# 잘못된 사업부 데이터 수정 스크립트
# "팀이름(사업부)" 형식의 deptname에서 올바른 business_unit 추출

set -e

echo "=== 잘못된 사업부 데이터 수정 ==="
echo ""

# 현재 잘못된 데이터 확인
echo "1. 현재 잘못된 데이터 확인..."
docker compose exec -T db psql -U postgres -d dashboard <<'SQL'
SELECT loginid, username, deptname, business_unit,
       substring(deptname from '\(([^)]+)\)') as correct_bu
FROM users
WHERE deptname LIKE '%(%'
  AND (business_unit IS NULL
       OR business_unit = ''
       OR business_unit != COALESCE(substring(deptname from '\(([^)]+)\)'), ''))
ORDER BY deptname;
SQL

echo ""
echo "2. 사업부 데이터 수정 중..."

# 괄호 형식 deptname의 business_unit 수정
docker compose exec -T db psql -U postgres -d dashboard <<'SQL'
UPDATE users
SET business_unit = substring(deptname from '\(([^)]+)\)')
WHERE deptname LIKE '%(%'
  AND substring(deptname from '\(([^)]+)\)') IS NOT NULL
  AND (business_unit IS NULL
       OR business_unit = ''
       OR business_unit != substring(deptname from '\(([^)]+)\)'));
SQL

echo ""
echo "3. 수정 결과 확인..."
docker compose exec -T db psql -U postgres -d dashboard <<'SQL'
SELECT business_unit, COUNT(*) as user_count
FROM users
WHERE business_unit IS NOT NULL AND business_unit != ''
GROUP BY business_unit
ORDER BY user_count DESC;
SQL

echo ""
echo "=== 완료 ==="
