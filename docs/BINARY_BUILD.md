# 바이너리 빌드 가이드 (Binary Build Guide)

LOCAL-CLI는 Node.js 없이 실행 가능한 독립 바이너리로 배포됩니다.

---

## 목차

1. [개요](#1-개요)
2. [빌드 방법](#2-빌드-방법)
3. [빌드 결과물](#3-빌드-결과물)
4. [자동 업데이트 흐름](#4-자동-업데이트-흐름)
5. [릴리스 체크리스트](#5-릴리스-체크리스트)
6. [트러블슈팅](#6-트러블슈팅)

---

## 1. 개요

| 파일 | 설명 | 위치 |
|------|------|------|
| `bin/lcli.gz` | Bun 컴파일된 바이너리 (gzip 압축) | 레포지토리 |
| `bin/yoga.wasm` | ink UI 레이아웃 엔진 | 레포지토리 |

**중요**: 모든 patch 릴리스 시 바이너리를 반드시 포함해야 합니다.

---

## 2. 빌드 방법

### 사전 요구사항

- Node.js >= 20.0.0
- Bun (https://bun.sh)

### 빌드 명령어

```bash
# 1. 의존성 설치 (yoga-wasm-web 패치 자동 적용)
npm install

# 2. 바이너리 빌드
npm run bun:build

# 3. gzip 압축
gzip -c bin/lcli > bin/lcli.gz
```

### bun:build 스크립트가 수행하는 작업

1. `scripts/inject-version.js` - package.json 버전을 constants.ts에 주입
2. `npm run build` - TypeScript 컴파일
3. `bun build dist/cli.js --compile --outfile bin/lcli` - 바이너리 컴파일
4. `cp node_modules/yoga-wasm-web/dist/yoga.wasm bin/` - yoga.wasm 복사

---

## 3. 빌드 결과물

| 파일 | 크기 (예상) | 커밋 여부 |
|------|------------|----------|
| `bin/lcli` | ~100MB | ❌ (.gitignore) |
| `bin/lcli.gz` | ~40MB | ✅ 커밋 대상 |
| `bin/yoga.wasm` | ~87KB | ✅ 커밋 대상 |

### 빌드 검증

```bash
# yoga 참조 개수 확인 (정상: 60개 이상)
strings bin/lcli | grep -c "yoga"

# 다른 디렉토리에서 실행 테스트
cd /tmp
/path/to/bin/lcli --version
```

---

## 4. 자동 업데이트 흐름

바이너리 실행 시 자동 업데이트가 다음과 같이 동작합니다:

```
1. git ls-remote로 최신 커밋 확인
2. ~/.local-cli/current-commit 파일과 비교
3. 버전이 다르면:
   a. git clone --depth 1 → ~/.local-cli/repo/
   b. bin/lcli.gz 압축 해제 → ~/.local/bin/lcli
   c. bin/yoga.wasm 복사 → ~/.local/bin/yoga.wasm
   d. ~/.local-cli/repo/ 삭제 (소스 코드 보호)
   e. 새 커밋 해시 저장
4. ~/.bashrc 또는 ~/.zshrc에 PATH 추가
```

**중요**: 소스 코드 보호를 위해 바이너리 추출 후 repo 디렉토리가 자동 삭제됩니다.

---

## 5. 릴리스 체크리스트

새 버전 릴리스 시 반드시 다음을 확인하세요:

### 필수 사항

- [ ] `package.json` 버전 업데이트
- [ ] `npm run bun:build` 실행
- [ ] `gzip -c bin/lcli > bin/lcli.gz` 실행
- [ ] `bin/lcli.gz` 커밋
- [ ] `bin/yoga.wasm` 커밋

### 검증

```bash
# 1. 빌드 후 yoga 참조 확인
strings bin/lcli | grep -c "yoga"
# 60 이상이면 정상

# 2. 바이너리 크기 확인
ls -lh bin/lcli.gz
# ~40MB 예상

# 3. 압축 해제 테스트
gunzip -c bin/lcli.gz > /tmp/lcli-test
chmod +x /tmp/lcli-test
/tmp/lcli-test --version
```

### 커밋 예시

```bash
git add bin/lcli.gz bin/yoga.wasm
git commit -m "build: update binary to v3.2.1"
git push origin main
```

---

## 6. 트러블슈팅

### 문제: `Cannot find module './yoga.wasm'`

**원인**: `postinstall` 스크립트가 실행되지 않아 yoga-wasm-web이 패치되지 않음

**해결**:
```bash
# 1. npm install 재실행
npm install
# 출력에 "yoga-wasm-web patched successfully" 확인

# 2. 다시 빌드
npm run bun:build
```

### 문제: 바이너리 실행 시 UI가 표시되지 않음

**원인**: yoga.wasm 파일이 바이너리와 같은 위치에 없음

**해결**:
```bash
# yoga.wasm이 bin/에 있는지 확인
ls -la bin/yoga.wasm

# 없으면 복사
cp node_modules/yoga-wasm-web/dist/yoga.wasm bin/
```

### 문제: 빌드는 되지만 yoga 참조가 0개

**원인**: postinstall 패치가 적용되지 않음

**해결**:
```bash
# 1. node_modules 삭제 후 재설치
rm -rf node_modules
npm install

# 2. 다시 빌드
npm run bun:build

# 3. 확인
strings bin/lcli | grep -c "yoga"
```

---

## 주의사항

1. **바이너리 누락 금지**: patch 릴리스 시에도 반드시 `bin/lcli.gz`와 `bin/yoga.wasm`을 포함
2. **GitHub 파일 크기 제한**: 100MB 초과 시 push 실패 → 반드시 gzip 압축
3. **버전 동기화**: `package.json` 버전 변경 시 바이너리 재빌드 필수

---

**Authors**: LOCAL-CLI Team
