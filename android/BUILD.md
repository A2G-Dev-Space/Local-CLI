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

## 구조

```
android/
├── App.tsx                 # 앱 엔트리
├── src/
│   ├── core/               # CLI/Electron과 동일한 코어 로직
│   │   ├── llm/            # LLM 클라이언트 (fetch 기반)
│   │   ├── config/         # 설정 관리 (AsyncStorage)
│   │   └── session/        # 세션 관리
│   ├── types/              # 타입 정의 (CLI 패리티)
│   ├── errors/             # 에러 계층 (CLI 패리티)
│   └── ui/
│       ├── theme/          # iOS HIG 컬러 시스템
│       ├── components/     # iMessage-level 컴포넌트
│       ├── screens/        # 화면 (Chat, Settings, Sessions)
│       └── hooks/          # useChat 등
├── app.json                # Expo 설정
├── eas.json                # EAS Build 설정
└── package.json
```
