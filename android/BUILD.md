# LOCAL BOT — Android APK Build Guide

## Quick Build (EAS Cloud — 추천)

```bash
cd android

# 1. 의존성 설치
npm install

# 2. EAS CLI 설치
npm install -g eas-cli

# 3. Expo 계정 로그인
eas login

# 4. APK 빌드 (클라우드)
eas build --platform android --profile preview

# → 빌드 완료 후 APK 다운로드 링크 제공
```

## Local Build (Android SDK 필요)

```bash
cd android

# 1. 의존성 설치
npm install

# 2. 네이티브 프로젝트 생성
npx expo prebuild --platform android --no-install

# 3. Gradle 빌드
export ANDROID_HOME=$HOME/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
cd android
./gradlew assembleRelease

# → android/app/build/outputs/apk/release/app-release.apk
```

## Local Build (EAS Local)

```bash
cd android
npm install
eas build --platform android --profile preview --local

# → 현재 디렉토리에 APK 생성
```

## 요구사항

- Node.js 18+
- JDK 17 (로컬 빌드 시)
- Android SDK 34 (로컬 빌드 시)

## Tool System (Android)

안드로이드에서 사용 가능한 도구 시스템:

### Browser Tools (WebView 기반)
CDP/Playwright를 대체하여 WebView로 브라우저 자동화 수행.

| Tool | Description |
|------|-------------|
| `browser_navigate` | URL로 이동 |
| `browser_click` | CSS 셀렉터 또는 텍스트로 클릭 |
| `browser_fill` | 입력 필드에 값 입력 |
| `browser_get_text` | 페이지/요소 텍스트 가져오기 |
| `browser_get_html` | HTML 소스 가져오기 |
| `browser_screenshot` | 페이지 정보 캡처 |
| `browser_execute_script` | JavaScript 실행 |
| `browser_press_key` | 키보드 키 입력 |
| `browser_wait` | 요소 대기 또는 시간 대기 |
| `browser_get_console` | 콘솔 로그 가져오기 |
| `browser_get_network` | 네트워크 요청 가져오기 |
| `browser_get_page_info` | 페이지 정보 (타이틀, URL, 크기 등) |
| `browser_scroll` | 스크롤 |
| `browser_go_back/forward` | 히스토리 이동 |
| `browser_refresh` | 새로고침 |

### Localhost Testing Tools
로컬 개발 서버 연결 및 테스트.

| Tool | Description |
|------|-------------|
| `localhost_check` | 서버 실행 확인 |
| `localhost_scan` | 개발 포트 스캔 (3000, 5173, 8080 등) |
| `localhost_api_test` | API 엔드포인트 테스트 |
| `localhost_health` | 모니터링 중인 서버 상태 확인 |
| `localhost_browse` | WebView에서 localhost 열기 |

> 안드로이드 에뮬레이터에서 `localhost`는 자동으로 `10.0.2.2`로 매핑 (호스트 머신)

### File Tools
expo-file-system 기반 파일 조작.

| Tool | Description |
|------|-------------|
| `file_read` | 파일 읽기 |
| `file_write` | 파일 쓰기 |
| `file_list` | 디렉토리 목록 |
| `file_delete` | 삭제 |
| `file_info` | 파일 정보 |
| `file_mkdir` | 디렉토리 생성 |
| `file_copy/move` | 복사/이동 |
| `file_download` | URL에서 다운로드 |

### Shell/Utility Tools
안드로이드 환경 유틸리티.

| Tool | Description |
|------|-------------|
| `http_request` | HTTP 요청 (curl 대체) |
| `json_parse` | JSON 파싱 및 쿼리 |
| `base64_encode/decode` | Base64 인코딩/디코딩 |
| `text_transform` | 텍스트 변환 (replace, grep, sort 등) |
| `device_info` | 디바이스 정보 |

## 구조

```
android/
├── App.tsx                 # 앱 엔트리
├── src/
│   ├── core/               # CLI/Electron과 동일한 코어 로직
│   │   ├── llm/            # LLM 클라이언트 (fetch 기반, tool_calls 지원)
│   │   ├── config/         # 설정 관리 (AsyncStorage)
│   │   └── session/        # 세션 관리
│   ├── tools/              # 안드로이드 도구 시스템
│   │   ├── types.ts        # 도구 타입 정의
│   │   ├── registry.ts     # 도구 레지스트리
│   │   ├── tool-executor.ts # LLM tool_calls 실행기
│   │   ├── browser/        # WebView 브라우저 자동화
│   │   ├── file/           # 파일 시스템 도구
│   │   ├── shell/          # 셸/유틸리티 도구
│   │   └── localhost/      # 로컬호스트 테스트 도구
│   ├── types/              # 타입 정의 (CLI 패리티)
│   ├── errors/             # 에러 계층 (CLI 패리티)
│   └── ui/
│       ├── theme/          # iOS HIG 컬러 시스템
│       ├── components/     # iMessage-level 컴포넌트
│       ├── screens/        # Chat, Settings, Sessions, Browser
│       └── hooks/          # useChat (tool 실행 통합)
├── app.json                # Expo 설정
├── eas.json                # EAS Build 설정
└── package.json
```
