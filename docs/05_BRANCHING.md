# 브랜치 전략 가이드 (Branching Strategy)

이 문서는 LOCAL-CLI(main)와 NEXUS CODER(nexus-coder-dev) 두 배포 버전을 별도 운영할 때의 브랜치 관리 전략을 설명합니다.

---

## 목차

1. [브랜치 구조](#1-브랜치-구조)
2. [파일별 분리 전략](#2-파일별-분리-전략)
3. [워크플로우](#3-워크플로우)
4. [Cherry-pick 가이드](#4-cherry-pick-가이드)
5. [충돌 해결](#5-충돌-해결)
6. [주의사항](#6-주의사항)

---

## 1. 브랜치 구조

### 메인 브랜치

| Branch | 제품명 | 설명 |
|--------|--------|------|
| `main` | LOCAL-CLI | 개인용 CLI (로컬 LLM, SSO 없음) |
| `nexus-coder-dev` | NEXUS CODER | 엔터프라이즈 버전 (SSO, Admin Server) |
| `nexus-coder` | NEXUS CODER (stable) | 안정 릴리스 버전 |

### 브랜치 흐름

```
main (LOCAL-CLI)
 │
 ├── feat/xxx        ← 공통 기능 개발
 │
 └── 머지 후 cherry-pick ──→ nexus-coder-dev (NEXUS CODER)
                              │
                              ├── feat/enterprise-xxx  ← 엔터프라이즈 전용
                              │
                              └── 안정화 후 ──→ nexus-coder (stable)
```

### 개발용 명령어

auto-update의 영향을 받지 않는 개발용 명령어:

| Branch | 일반 명령어 | 개발용 명령어 |
|--------|------------|--------------|
| `main` | `lcli` | `lcli-dev` |
| `nexus-coder-dev` | `nexus` | `nexus-dev` |

```bash
# 개발 환경 설정
cd ~/Local-CLI
npm run build
npm link

# 개발용 명령어 사용 (auto-update 영향 없음)
lcli-dev        # main 브랜치
nexus-dev       # nexus-coder-dev 브랜치
```

---

## 2. 파일별 분리 전략

### 공통 파일 (main에서 개발 → cherry-pick)

이 파일들은 main에서 개발하고 nexus-coder-dev로 cherry-pick합니다:

```
src/core/llm/           # LLM 클라이언트
src/orchestration/      # Plan & Execute
src/tools/              # 도구들
src/agents/             # 에이전트
src/prompts/            # 프롬프트 (일부)
src/ui/components/      # UI 컴포넌트 (Logo.tsx 제외)
src/ui/hooks/           # React 훅
src/eval/               # --eval 모드
tests/                  # Python 테스트
```

### 브랜치 전용 파일 (절대 머지 금지)

이 파일들은 각 브랜치에서 독립적으로 관리합니다:

| 파일/디렉토리 | main (LOCAL-CLI) | nexus-coder-dev (NEXUS) |
|--------------|------------------|-------------------------|
| `src/ui/components/Logo.tsx` | LOCAL-CLI 로고 | NEXUS CODER 로고 |
| `src/core/auth/` | 없음 | SSO 인증 모듈 |
| `src/core/nexus-setup.ts` | 없음 | Admin Server 연동 |
| `src/constants.ts` | LOCAL 설정 | NEXUS 설정 |
| `src/cli.ts` | lcli 진입점 | nexus 진입점 (SSO 포함) |
| `package.json` | name: local-cli, bin: lcli | name: nexus-coder, bin: nexus |
| `README.md` | 개인용 가이드 | 엔터프라이즈 가이드 |

---

## 3. 워크플로우

### 3.1 공통 기능 개발

```bash
# 1. main에서 기능 브랜치 생성
git checkout main
git pull origin main
git checkout -b feat/new-feature

# 2. 개발 및 커밋
# ... 개발 ...
git add .
git commit -m "feat: Add new feature"

# 3. main에 PR 생성
git push -u origin feat/new-feature
gh pr create --base main --title "feat: Add new feature"

# 4. PR 머지 후 nexus-coder-dev에 반영
git checkout nexus-coder-dev
git pull origin nexus-coder-dev
git cherry-pick <머지 커밋 해시>
git push origin nexus-coder-dev
```

### 3.2 엔터프라이즈 전용 기능 개발

```bash
# nexus-coder-dev에서 직접 개발
git checkout nexus-coder-dev
git checkout -b feat/enterprise-feature

# ... 개발 ...

# PR 생성 (base: nexus-coder-dev)
gh pr create --base nexus-coder-dev --title "feat: Add enterprise feature"
```

### 3.3 브랜딩 관련 수정

```bash
# 각 브랜치에서 독립적으로 수정
# main: LOCAL-CLI 관련
# nexus-coder-dev: NEXUS CODER 관련

git checkout nexus-coder-dev
git checkout -b fix/nexus-branding
# ... Logo.tsx, README.md 등 수정 ...
gh pr create --base nexus-coder-dev
```

---

## 4. Cherry-pick 가이드

### 단일 커밋 cherry-pick

```bash
git checkout nexus-coder-dev
git cherry-pick <commit-hash>
```

### 여러 커밋 cherry-pick

```bash
# 범위 지정 (oldest는 포함 안 됨)
git cherry-pick <oldest-commit>^..<newest-commit>

# 또는 개별 지정
git cherry-pick <commit1> <commit2> <commit3>
```

### PR 머지 커밋 cherry-pick

```bash
# GitHub에서 Squash and merge 사용 시
git cherry-pick <squashed-commit-hash>

# Merge commit 사용 시 (-m 1 옵션 필요)
git cherry-pick -m 1 <merge-commit-hash>
```

---

## 5. 충돌 해결

### 브랜딩 파일 충돌 시

브랜딩 관련 파일(Logo.tsx, constants.ts 등)에서 충돌 발생 시:

```bash
# nexus-coder-dev 버전 유지
git checkout --ours src/ui/components/Logo.tsx
git checkout --ours src/constants.ts
git checkout --ours README.md

# 스테이징 후 계속
git add .
git cherry-pick --continue
```

### 로직 파일 충돌 시

공통 로직 파일에서 충돌 발생 시 수동으로 병합:

```bash
# 충돌 파일 열어서 수동 해결
code src/orchestration/plan-executor.ts

# 해결 후
git add src/orchestration/plan-executor.ts
git cherry-pick --continue
```

### Cherry-pick 중단

```bash
git cherry-pick --abort
```

---

## 6. 주의사항

### 절대 하지 말아야 할 것

```bash
# ❌ 절대 금지: main을 nexus-coder-dev에 머지
git checkout nexus-coder-dev
git merge main  # 브랜딩 파일이 덮어씌워짐!

# ❌ 절대 금지: nexus-coder-dev를 main에 머지
git checkout main
git merge nexus-coder-dev  # SSO 등 엔터프라이즈 코드가 들어감!
```

### 권장 사항

1. **커밋 단위를 작게 유지**
   - cherry-pick이 쉬워짐
   - 충돌 범위 최소화

2. **공통 로직은 main에서 먼저 개발**
   - 그 후 nexus-coder-dev로 cherry-pick
   - 일관된 코드 흐름 유지

3. **브랜딩 파일은 각 브랜치에서 독립 관리**
   - Logo.tsx, constants.ts, README.md 등
   - cherry-pick 시 `--ours`로 유지

4. **정기적인 동기화**
   - main의 주요 변경사항을 주기적으로 cherry-pick
   - 너무 오래 방치하면 충돌이 커짐

5. **테스트 필수**
   ```bash
   npm run build
   npm run test:quick
   ```

---

## 요약

| 작업 | 방법 |
|------|------|
| 공통 기능 개발 | main → PR → cherry-pick to nexus-coder-dev |
| 엔터프라이즈 기능 | nexus-coder-dev에서 직접 개발 |
| 브랜딩 수정 | 각 브랜치에서 독립 수정 |
| main 변경 반영 | `git cherry-pick <commit>` |
| 충돌 시 브랜딩 파일 | `git checkout --ours <file>` |

---

**Authors**: syngha.han, byeongju.lee, young87.kim
