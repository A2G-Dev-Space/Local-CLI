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
7. [바이너리 배포](#7-바이너리-배포)
   - [7.7 빌드 검증 방법](#77-빌드-검증-방법)
   - [7.8 트러블슈팅](#78-트러블슈팅)

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

### ⚠️ package.json 특별 주의사항

**nexus-coder 브랜치의 package.json은 main과 완전히 다릅니다!**

cherry-pick 시 main의 package.json을 그대로 가져오면 **바이너리 빌드가 깨집니다**.

| 항목 | main (LOCAL-CLI) | nexus-coder (NEXUS) |
|------|------------------|---------------------|
| `name` | `local-cli` | `nexus-coder` |
| `bin` | `lcli`, `lcli-dev` | `nexus`, `nexus-dev` |
| `postinstall` | 없음 | `node scripts/patch-yoga.js` **(필수!)** |
| `bun:build` | 없음 | 바이너리 빌드 스크립트 **(필수!)** |
| `open` 의존성 | 없음 | 있음 |
| `react-devtools-core` | 없음 | 있음 (devDependencies) |
| `@yao-pkg/pkg` | 없음 | 있음 (devDependencies) |

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

### ⚠️ package.json 충돌 시 (가장 중요!)

**절대로 main의 package.json을 그대로 사용하면 안 됩니다!**

```bash
# ❌ 잘못된 방법 - 바이너리 빌드가 깨짐!
git checkout --theirs package.json  # main 버전 사용

# ✅ 올바른 방법 - nexus-coder 버전 유지
git checkout --ours package.json    # nexus-coder 버전 유지
```

충돌 시 수동으로 병합해야 할 경우:
1. `--ours` (nexus-coder)의 스크립트, 의존성, name, bin 유지
2. `--theirs` (main)에서 **버전 번호만** 가져옴

```bash
# package.json 충돌 해결 예시
git checkout --ours package.json
# 에디터에서 version만 main 버전으로 수정
git add package.json
git cherry-pick --continue
```

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

---

## 7. 바이너리 배포

### 7.1 개요

NEXUS CODER는 Node.js 없이 실행 가능한 독립 바이너리로 배포됩니다.

| 파일 | 설명 | 위치 |
|------|------|------|
| `bin/nexus.gz` | Bun 컴파일된 바이너리 (gzip 압축) | 레포지토리 |
| `bin/yoga.wasm` | ink UI 레이아웃 엔진 | 레포지토리 |

### 7.2 빌드 방법

#### ⚠️ 중요: yoga-wasm-web 패치

Bun 컴파일된 바이너리에서 ink UI가 작동하려면 **yoga-wasm-web 패치가 필수**입니다.

`postinstall` 스크립트(`scripts/patch-yoga.js`)가 하는 일:
- `yoga-wasm-web/dist/node.js`를 수정하여 바이너리 실행 시 `process.execPath` 기준으로 `yoga.wasm`을 찾도록 변경
- 이 패치 없이 빌드하면 `Cannot find module './yoga.wasm'` 에러 발생

```bash
# ✅ 올바른 빌드 방법 (권장)
npm install                    # postinstall로 yoga-wasm-web 자동 패치
npm run bun:build             # 빌드 + gzip + yoga.wasm 복사
gzip -c bin/nexus > bin/nexus.gz

# 수동 빌드 (bun:build 스크립트 사용 불가 시)
npm install                    # 반드시 먼저 실행! (패치 적용)
npm run build                  # TypeScript 컴파일
bun build dist/cli.js --compile --outfile bin/nexus
gzip -c bin/nexus > bin/nexus.gz
cp node_modules/yoga-wasm-web/dist/yoga.wasm bin/
```

#### 빌드 결과물

| 파일 | 크기 | 커밋 여부 |
|------|------|----------|
| `bin/nexus` | ~107MB | ❌ (.gitignore) |
| `bin/nexus.gz` | ~40MB | ✅ 커밋 대상 |
| `bin/yoga.wasm` | ~87KB | ✅ 커밋 대상 |

#### ❌ 빌드 실패 원인

| 증상 | 원인 | 해결 |
|------|------|------|
| `Cannot find module './yoga.wasm'` | postinstall 패치 누락 | `npm install` 다시 실행 |
| `Could not resolve: "react-devtools-core"` | 의존성 누락 | package.json에 devDependencies 확인 |
| 바이너리에 yoga 참조 0개 | 잘못된 package.json | nexus-coder 전용 설정 복구 |

### 7.3 자동 업데이트 흐름

바이너리 실행 시 자동 업데이트가 다음과 같이 동작합니다:

```
1. git clone -b nexus-coder → ~/.nexus-coder/repo/
2. bin/nexus.gz 압축 해제 → ~/.local/bin/nexus
3. bin/yoga.wasm 복사 → ~/.local/bin/yoga.wasm
4. ~/.bashrc 또는 ~/.zshrc에 PATH 추가
5. npm unlink -g nexus-coder (기존 npm link 제거)
```

### 7.4 사용자 설치 방법

**첫 설치:**

```bash
# 1. 바이너리 다운로드 (또는 직접 복사)
./nexus

# 2. 자동 설치 완료 후 표시되는 명령어 실행
source ~/.bashrc && nexus
```

**이후 실행:**

```bash
nexus
```

### 7.5 전체 배포 워크플로우 (실제 예시)

main에서 기능 개발 후 nexus-coder에 반영하는 전체 과정:

```bash
# === 1. main에서 기능 개발 ===
git checkout main
git pull origin main
git checkout -b feature/new-feature

# 코드 수정...
git add .
git commit -m "feat: Add new feature"

# 버전 업데이트 (patch: 2.7.2 → 2.7.3)
npm version patch --no-git-tag-version
git add package.json
git commit -m "chore: bump version to 2.7.3"

# PR 생성 및 푸시
git push -u origin feature/new-feature
gh pr create --base main --title "feat: Add new feature"

# === 2. nexus-coder에 cherry-pick ===
git checkout nexus-coder
git pull origin nexus-coder

# 커밋들 cherry-pick (PR의 커밋 해시들)
git cherry-pick <commit1> <commit2> <commit3>

# ⚠️ package.json 충돌 시: nexus-coder 버전(ours) 유지!
# 절대로 --theirs 사용 금지 (빌드 스크립트가 삭제됨)
git checkout --ours package.json
# 에디터에서 version 번호만 main 버전으로 수정
git add package.json
git cherry-pick --continue

# === 3. 버전 상수 수정 (중요!) ===
# package.json과 constants.ts 버전 동기화 필요
sed -i "s/APP_VERSION = '.*'/APP_VERSION = '2.7.3'/" src/constants.ts

# === 4. 바이너리 빌드 ===
npm install                    # yoga-wasm-web 패치 적용 (필수!)
npm run bun:build             # 빌드 스크립트 사용
gzip -c bin/nexus > bin/nexus.gz

# === 5. 커밋 & 푸시 ===
git add src/constants.ts bin/nexus.gz bin/yoga.wasm package.json
git commit -m "build: update binary to v2.7.3"
git push origin nexus-coder
```

### 7.6 주의사항

- `bin/nexus` (비압축, 102MB)는 `.gitignore`에 포함 → **절대 커밋하지 않음**
- `bin/nexus.gz`와 `bin/yoga.wasm`만 레포지토리에 커밋
- **버전 동기화 필수**: `package.json`과 `src/constants.ts`의 `APP_VERSION` 일치시킬 것
- GitHub 파일 크기 제한: 100MB → 반드시 gzip 압축 후 커밋

### 7.7 빌드 검증 방법

바이너리가 제대로 빌드되었는지 확인하는 방법:

```bash
# yoga 참조 개수 확인 (정상: 64개)
strings bin/nexus | grep -c "yoga"

# 다른 디렉토리에서 실행 테스트
cd /tmp
/path/to/bin/nexus --version

# yoga.wasm 없이 실행 시 에러 확인 (정상 동작하면 안 됨)
rm /tmp/yoga.wasm
/tmp/nexus --version  # 에러 발생해야 정상
```

### 7.8 트러블슈팅

#### 문제: `Cannot find module './yoga.wasm'`

**원인**: `postinstall` 스크립트가 실행되지 않아 yoga-wasm-web이 패치되지 않음

**해결**:
```bash
# 1. package.json에 postinstall 스크립트 확인
grep postinstall package.json
# 출력: "postinstall": "node scripts/patch-yoga.js"

# 2. 없으면 nexus-coder 전용 package.json으로 복구
git show a421565:package.json > package.json.backup
# 또는 이전 정상 커밋에서 복구

# 3. npm install 재실행
npm install
# 출력에 "yoga-wasm-web patched successfully" 확인

# 4. 다시 빌드
npm run bun:build
```

#### 문제: 빌드는 되지만 바이너리 실행 시 UI 안 뜸

**원인**: package.json이 main 버전으로 덮어씌워져서 의존성 또는 패치가 누락됨

**해결**:
```bash
# 1. 바이너리에 yoga 참조 확인
strings bin/nexus | grep -c "yoga"
# 0이면 문제 있음, 64 이상이면 정상

# 2. package.json 복구 후 재빌드
npm install
npm run bun:build
```

---

**Authors**: syngha.han, byeongju.lee, young87.kim
