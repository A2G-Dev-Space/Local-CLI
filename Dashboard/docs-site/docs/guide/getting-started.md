# Getting Started

Nexus Coder를 시작하는 방법을 안내합니다.

::: danger 지원 환경
**PowerShell 및 VWP(Windows)는 지원되지 않습니다.**

Linux 또는 WSL(Windows Subsystem for Linux) 환경에서 사용해주세요.
:::

::: danger 필수: NO_PROXY 설정
Nexus Coder가 정상적으로 동작하려면 다음 주소들에 대한 **NO_PROXY 설정이 반드시 필요**합니다:

```bash
# .bashrc 또는 .zshrc에 추가
export NO_PROXY="10.229.95.228,10.229.95.220,a2g.samsungds.net,genai.samsungds.net,$NO_PROXY"
export no_proxy="10.229.95.228,10.229.95.220,a2g.samsungds.net,genai.samsungds.net,$no_proxy"

# 즉시 적용
source ~/.bashrc   # 또는 source ~/.zshrc
```

| 주소 | 용도 |
|------|------|
| `10.229.95.228` | API 서버 |
| `10.229.95.220` | API 서버 |
| `a2g.samsungds.net` | A2G 서비스 |
| `genai.samsungds.net` | GenAI 서비스 |

이 설정이 없으면 API 호출 시 연결 오류가 발생할 수 있습니다.
:::

## 시스템 요구사항

- **OS**: Linux (x64) 또는 WSL
- **네트워크**: 사내망 접속 가능
- **기타**: Node.js 설치 불필요 (단일 바이너리 실행)

::: tip WSL 설정 가이드
Windows에서 WSL을 처음 설정하는 경우 [WSL 설정 가이드](https://dsdn.samsungds.net/question/1501114335554965504?history=true)를 참조하세요.
:::

## 설치 (바이너리)

**Node.js, npm 설치 불필요** - 바이너리만 다운로드하여 바로 사용

### 1. 바이너리 다운로드

GitHub에서 두 파일을 다운로드합니다:

```bash
# 다운로드 폴더 생성
mkdir -p ~/nexus-download && cd ~/nexus-download

# nexus.gz 다운로드 (39MB)
wget https://github.samsungds.net/syngha-han/nexus-coder/raw/main/nexus.gz --no-check-certificate

# yoga.wasm 다운로드 (87KB)
wget https://github.samsungds.net/syngha-han/nexus-coder/raw/main/yoga.wasm --no-check-certificate
```

::: tip wget 대신 curl 사용
```bash
curl -kLO https://github.samsungds.net/syngha-han/nexus-coder/raw/main/nexus.gz
curl -kLO https://github.samsungds.net/syngha-han/nexus-coder/raw/main/yoga.wasm
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

## 첫 실행

```bash
nexus
```

첫 실행 시:
1. SSO 로그인 페이지가 브라우저에서 열립니다
2. Samsung 계정으로 로그인합니다
3. 로그인 완료 후 CLI로 돌아갑니다

## 기본 사용법

### 대화형 모드

```bash
nexus
```

프롬프트가 표시되면 자연어로 요청을 입력합니다:

```
> src 폴더의 구조를 알려줘
> package.json에서 버전을 확인해줘
> index.ts 파일을 읽고 분석해줘
```

### 주요 단축키

| 키 | 기능 |
|----|------|
| `Tab` | Auto ↔ Supervised 모드 전환 |
| `@` | 파일 브라우저 |
| `/` | 명령어 자동완성 |
| `ESC` | 현재 작업 중단 |
| `Ctrl+C` | 종료 |

## 다음 단계

- [기본 사용법](/guide/basic-usage) 알아보기
- [고급 사용법](/guide/advanced-usage) 알아보기
