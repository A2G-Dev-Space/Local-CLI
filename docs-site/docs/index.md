---
layout: home

hero:
  name: "Nexus Coder"
  text: "완벽한 코딩 자동화를 꿈꿉니다"
  tagline: 폐쇄망 지원 AI 코딩 어시스턴트
  actions:
    - theme: brand
      text: 시작하기
      link: /guide/getting-started
    - theme: alt
      text: 데모 보기
      link: /demos/

features:
  - icon: 🎯
    title: Planning Mode
    details: 복잡한 작업을 TODO 리스트로 분해하여 체계적으로 실행합니다.
  - icon: 🛠️
    title: Powerful Tools
    details: 파일 편집, 명령 실행, 코드 검색 등 다양한 도구를 제공합니다.
  - icon: 🔒
    title: Air-Gapped Ready
    details: 폐쇄망 환경에서 완벽하게 동작하도록 설계되었습니다.
  - icon: ⚡
    title: Context Management
    details: 긴 대화도 자동 압축으로 컨텍스트를 효율적으로 관리합니다.
---

## 빠른 시작

Node.js 설치 없이 바이너리로 바로 실행:

```bash
# 1. 다운로드
mkdir -p ~/nexus-download && cd ~/nexus-download
wget https://github.samsungds.net/syngha-han/nexus-coder/raw/main/nexus.gz --no-check-certificate
wget https://github.samsungds.net/syngha-han/nexus-coder/raw/main/yoga.wasm --no-check-certificate

# 2. 압축 해제 및 실행
gunzip nexus.gz && chmod +x nexus
./nexus

# 3. 셸 리로드 후 어디서든 실행
source ~/.bashrc && nexus
```

자세한 설치 방법은 [Installation](/guide/installation)을 참조하세요.
