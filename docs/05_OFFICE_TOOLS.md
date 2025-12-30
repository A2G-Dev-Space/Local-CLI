# Office Tools 설정 가이드

Microsoft Office (Word, Excel, PowerPoint) 자동화 도구 사용을 위한 설정 가이드입니다.

## 요구사항

- Windows에 Microsoft Office 설치
- WSL2 (Ubuntu 등)에서 실행하는 경우 네트워크 설정 필요

## WSL2 네트워크 설정 (WSL Mirrored Mode)

WSL에서 Windows의 Office 서버와 통신하려면 **mirrored networking mode**가 필요합니다.

### 1. .wslconfig 파일 생성/수정

Windows에서 `%USERPROFILE%\.wslconfig` 파일을 생성하거나 수정합니다:

```ini
[wsl2]
networkingMode=mirrored
```

### 2. WSL 재시작

PowerShell (관리자 권한)에서:
```powershell
wsl --shutdown
```

그 후 WSL 터미널을 다시 엽니다.

### 3. 확인

WSL에서 `localhost`로 Windows 서비스에 접근 가능한지 확인:
```bash
curl http://localhost:8765/health
```

## 도구 활성화/비활성화

### 활성화 방법

1. CLI에서 `/tool` 명령어 입력
2. 화살표 키로 원하는 도구 선택 (Word, Excel, PowerPoint)
3. `Enter`로 토글

```
/tool
```

```
┌ Optional Tools ─────────────────────────┐
│ ○ Browser Automation (9 tools)          │
│ ● Microsoft Word (7 tools) (enabled)    │  ← Enter로 토글
│ ○ Microsoft Excel (8 tools)             │
│ ○ Microsoft PowerPoint (12 tools)       │
└─────────────────────────────────────────┘
● enabled  ○ disabled
↑↓: move | Enter: toggle | ESC: close
```

### 비활성화 방법

동일하게 `/tool` → 선택 → `Enter`로 토글

## Office 서버

도구 활성화 시 `office-server.exe`가 자동으로 시작됩니다.

### 수동 시작
```bash
# Windows에서
office-server/dist/office-server.exe --port 8765
```

### 수동 종료
```bash
curl -X POST http://localhost:8765/shutdown
```

또는 도구 비활성화 시 자동 종료됩니다.

## 사용 예시

도구 활성화 후 자연어로 요청:

```
Word 문서 만들어서 "회의록" 이라고 제목 써줘. 글씨 크기는 20으로.
```

```
Excel 열어서 A1에 "이름", B1에 "점수" 쓰고 Arial 폰트로 볼드 처리해줘.
```

```
PowerPoint 프레젠테이션 만들고 첫 슬라이드에 "프로젝트 소개" 텍스트 추가해줘.
```

## 문제 해결

### "Server not responding" 오류

1. WSL mirrored mode 설정 확인
2. Windows 방화벽에서 포트 8765 허용
3. Office가 설치되어 있는지 확인

### 폰트/크기가 적용 안됨

`word_write` 등의 함수에서 직접 폰트 설정:
```
텍스트 쓸 때 font_name, font_size, bold 파라미터 함께 전달
```

### Office 앱이 보이지 않음

Office 서버는 앱을 visible 모드로 실행합니다. 작업 표시줄 또는 다른 모니터 확인.
