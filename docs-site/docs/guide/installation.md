# Installation

## Quick Start (바이너리 설치)

**Node.js, npm 설치 불필요** - 바이너리만 다운로드하여 바로 사용

### 1. 바이너리 다운로드

GitHub에서 두 파일을 다운로드합니다:

```bash
# 다운로드 폴더 생성
mkdir -p ~/nexus-download && cd ~/nexus-download

# nexus.gz 다운로드 (39MB)
wget https://github.com/A2G-Dev-Space/Local-CLI/raw/nexus-coder/bin/nexus.gz --no-check-certificate

# yoga.wasm 다운로드 (87KB)
wget https://github.com/A2G-Dev-Space/Local-CLI/raw/nexus-coder/bin/yoga.wasm --no-check-certificate
```

::: tip wget 대신 curl 사용
```bash
curl -kLO https://github.com/A2G-Dev-Space/Local-CLI/raw/nexus-coder/bin/nexus.gz
curl -kLO https://github.com/A2G-Dev-Space/Local-CLI/raw/nexus-coder/bin/yoga.wasm
```
:::

::: warning 다운로드가 안 될 경우
- 프록시 설정 확인 (`http_proxy`, `https_proxy` 환경변수)
- SSL 인증서 오류 시 우회 옵션 사용:
  - wget: `--no-check-certificate`
  - curl: `-k`

**수동 다운로드 (브라우저):**
1. https://github.samsungds.net/syngha-han/nexus-coder 접속
2. `nexus.gz`와 `yoga.wasm` 파일 각각 다운로드
3. 두 파일을 같은 폴더에 저장 (예: `~/nexus-download/`)
:::

### 2. 압축 해제 및 실행 권한 부여

```bash
# 압축 해제
gunzip nexus.gz

# 실행 권한 부여
chmod +x nexus
```

### 3. 첫 실행 (자동 설치)

::: danger 중요
nexus와 yoga.wasm이 **같은 폴더**에 있어야 합니다!
:::

```bash
./nexus
```

첫 실행 시 자동으로:
- GitHub에서 최신 버전 클론
- `~/.local/bin/`에 바이너리 설치
- `~/.bashrc` 또는 `~/.zshrc`에 PATH 추가
- SSO 로그인 진행

### 4. 설치 완료 후

```bash
# 셸 설정 리로드
source ~/.bashrc   # 또는 source ~/.zshrc

# 이후부터는 어디서든 실행 가능
nexus

# 다운로드 폴더 삭제 (선택)
rm -rf ~/nexus-download
```

## 설치 위치

| 항목 | 경로 |
|------|------|
| 바이너리 | `~/.local/bin/nexus` |
| 설정 파일 | `~/.nexus-coder/config.json` |
| 인증 정보 | `~/.nexus-coder/auth.json` |
| 소스 저장소 | `~/.nexus-coder/repo/` |

## 자동 업데이트

`nexus` 실행 시 자동으로 최신 버전을 확인하고 업데이트합니다.
업데이트 후에는 안내 메시지에 따라 셸을 리로드하세요.

```
Update complete! Run: source ~/.bashrc && nexus
```

## 개발자용 설치 (npm)

Node.js 환경에서 직접 개발하려는 경우:

```bash
# 저장소 클론
git clone https://github.com/A2G-Dev-Space/Local-CLI.git
cd Local-CLI
git checkout nexus-coder

# 설치 및 빌드
npm install && npm run build

# 전역 링크
npm link

# 실행
nexus
```

## 시스템 요구사항

- **OS**: Linux (x64)
- **네트워크**: 사내망 접속 가능
- **기타**: Node.js 설치 불필요
