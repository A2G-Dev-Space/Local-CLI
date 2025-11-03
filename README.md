# A2G-CLI (AI2Go CLI)

**오프라인 기업 환경을 위한 완전한 로컬 LLM CLI 플랫폼**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/your-repo/a2g-cli)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

---

## 📋 프로젝트 개요

A2G-CLI는 **Gemini CLI의 개념을 기업 환경에 맞춰 완전히 재구축**한 프로젝트입니다. 인터넷 연결이 없는 회사 네트워크 환경에서 로컬 OpenAI Compatible 모델들을 활용하여 코드 작성, 분석, 문제 해결을 지원하는 **엔터프라이즈급 CLI 도구**입니다.

### 핵심 가치 제안
- ✅ **완전 오프라인 운영**: 인터넷 없이 독립적으로 작동
- ✅ **사내 모델 통합**: 기업의 로컬 LLM 서버와 직접 연결
- ✅ **제로 의존성 배포**: Git Clone만으로 설치 가능
- ✅ **침입적 LLM 도구**: 파일 시스템, 쉘 명령, 로컬 문서 접근 권한
- ✅ **엔터프라이즈 설정**: 멀티 모델 관리, 엔드포인트 검증, 팀 프리셋

---

## 🚀 빠른 시작

### 필수 요구사항
- Node.js >= 20.0.0
- npm >= 10.0.0

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-repo/a2g-cli.git
cd a2g-cli

# 의존성 설치
npm install

# 빌드
npm run build

# 실행
npm start
```

### 개발 모드

```bash
# TypeScript를 직접 실행
npm run dev
```

---

## 📦 프로젝트 구조

```
a2g-cli/
├── src/                    # 소스 코드
│   ├── cli.ts             # CLI Entry Point
│   ├── index.ts           # Main Export
│   ├── core/              # 핵심 로직
│   ├── ui/                # 터미널 UI 컴포넌트
│   ├── tools/             # LLM Tools
│   ├── utils/             # 유틸리티 함수
│   └── types/             # TypeScript 타입 정의
├── tests/                 # 테스트 파일
├── docs/                  # 문서
├── dist/                  # 빌드 출력
├── PROGRESS.md           # 개발 진행 상황
├── INTEGRATED_PROJECT_DOCUMENT.md  # 프로젝트 전체 문서
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🎯 개발 로드맵

### Phase 1: 기초 구축 (3-6개월)
- [x] 프로젝트 초기 설정
- [ ] 기본 CLI 프레임워크
- [ ] 로컬 모델 엔드포인트 연결
- [ ] 파일 시스템 도구
- [ ] 기본 명령어 시스템

### Phase 2: 상호작용 고도화 (6-12개월)
- [ ] 인터랙티브 터미널 UI (Ink/React 기반)
- [ ] 고급 설정 관리
- [ ] 로컬 문서 시스템
- [ ] 사용자 메모리/세션 관리

### Phase 3: 엔터프라이즈 기능 (12-18개월)
- [ ] 팀 협업 기능
- [ ] 감사 로그 및 보안
- [ ] 고급 RAG/검색
- [ ] 커스텀 플러그인 시스템

### Phase 4: 최적화 & 확장 (18-24개월+)
- [ ] 성능 최적화
- [ ] 마이그레이션 도구
- [ ] IDE 통합
- [ ] 커뮤니티 기여 프레임워크

---

## 🛠️ 기술 스택

- **언어**: TypeScript
- **런타임**: Node.js v20+
- **CLI 프레임워크**: Commander.js
- **HTTP 클라이언트**: Axios
- **터미널 UI**: Chalk, Ora, Inquirer
- **타입 검사**: TypeScript Strict Mode
- **린팅**: ESLint + @typescript-eslint
- **포맷팅**: Prettier

---

## 📚 문서

자세한 문서는 다음 파일들을 참조하세요:

- [PROGRESS.md](./PROGRESS.md) - 개발 진행 상황 및 규칙
- [INTEGRATED_PROJECT_DOCUMENT.md](./INTEGRATED_PROJECT_DOCUMENT.md) - 전체 프로젝트 문서
- [docs/](./docs/) - 추가 문서 (추후 추가 예정)

---

## 🤝 기여

이 프로젝트는 현재 초기 개발 단계입니다. 기여 가이드라인은 추후 업데이트 예정입니다.

---

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.

---

## 👥 팀

A2G-CLI Team

---

**현재 버전**: 0.1.0
**마지막 업데이트**: 2025-11-03
