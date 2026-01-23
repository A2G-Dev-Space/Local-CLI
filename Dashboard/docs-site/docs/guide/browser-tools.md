# Browser Tools

::: danger Windows + Chrome/Edge 필수
Browser Tools를 사용하려면 **Windows에 Chrome 또는 Edge**가 설치되어 있어야 합니다.
WSL에서 실행 시 네트워크 설정이 필요합니다.
:::

## 사전 설정

::: warning WSL 사용자 필수
WSL 환경에서 사용하려면 **mirrored networking mode** 설정이 필요합니다.

👉 **[WSL 네트워크 설정 가이드](/guide/wsl-setup)** 를 먼저 확인하세요.
:::

::: danger 보안 경고 - 반드시 "허용" 클릭
처음 활성화 시 Windows 보안 경고가 표시됩니다.

**⚠️ 반드시 "허용" 버튼을 클릭해야 정상 작동합니다!**

`browser-server.exe`가 네트워크 통신을 시도하기 때문에 발생하는 정상적인 경고입니다.
:::

---

## 이걸로 뭘 할 수 있나요?

::: tip 완벽한 End-to-End 자동화
AI가 코드만 수정하는 게 아니라, **직접 브라우저를 열고 결과를 확인**합니다.
:::

### 1. UI 버그 수정
```
"로그인 버튼이 안 눌려요"
→ AI가 브라우저 열고 → 버튼 클릭 시도 → 에러 확인 → 코드 수정 → 다시 테스트 → 성공 확인
```

### 2. 스타일 수정
```
"헤더 색상을 파란색으로 바꿔주세요"
→ 코드 수정 → 스크린샷 캡처 → 결과 확인 → 필요시 재수정
```

### 3. 폼 테스트
```
"회원가입 폼 테스트해줘"
→ 브라우저 열기 → 입력 필드 채우기 → 제출 → 결과 확인 → 에러 있으면 수정
```

### 4. 반응형 테스트
```
"모바일에서 레이아웃 확인해줘"
→ 뷰포트 변경 → 스크린샷 → 문제점 파악 → CSS 수정
```

---

## 사용 가능한 도구

| 도구 | 설명 |
|-----|------|
| `browser_launch` | Chrome/Edge 브라우저 실행 |
| `browser_navigate` | URL로 이동 |
| `browser_screenshot` | 페이지 스크린샷 캡처 (Vision 모델 필요) |
| `browser_click` | 요소 클릭 |
| `browser_fill` | 입력 필드에 텍스트 입력 |
| `browser_get_text` | 요소의 텍스트 가져오기 |
| `browser_get_content` | 페이지 HTML 조회 |
| `browser_get_console` | 브라우저 Console 로그 조회 |
| `browser_get_network` | 네트워크 요청/응답 로그 조회 |
| `browser_focus` | 브라우저 창을 맨 앞으로 가져오기 |
| `browser_close` | 브라우저 종료 |

### browser_get_content

페이지의 **HTML 소스**를 반환합니다. DOM 구조와 요소들을 확인할 수 있습니다.

::: tip Vision 미지원 모델에서 유용
`browser_screenshot`은 Vision 모델이 필요하지만, `browser_get_content`는 텍스트만 반환하므로 모든 모델에서 사용 가능합니다.
:::

### browser_get_console

브라우저 Console 로그(log, error, warn 등)를 수집합니다.

::: warning 디버깅에 필수
JavaScript 에러, API 호출 로그 등을 확인할 때 사용합니다.
:::

### browser_get_network

네트워크 요청과 응답을 조회합니다. API 디버깅에 유용합니다.

```
➡️ GET https://api.example.com/users
✅ 200 OK - https://api.example.com/users (application/json)
```

---

## 활성화 방법

```bash
# nexus 실행 후
/tool
# → Browser Automation 선택 (Enter)
# → ● enabled 상태 확인
```

활성화 상태는 재시작해도 유지됩니다.

---

## 예시 워크플로우

```
사용자: "개발 서버 띄우고 메인 페이지 스크린샷 찍어줘"

AI 동작:
1. bash_background로 npm run dev 실행
2. browser_launch로 Chrome 실행
3. browser_navigate로 localhost:3000 이동
4. browser_screenshot으로 스크린샷 캡처
5. 결과 이미지 표시
```

개발자가 직접 브라우저를 열 필요 없이, AI가 모든 것을 처리합니다.

---

## 문제 해결

### "Server not responding" 오류

1. [WSL 네트워크 설정](/guide/wsl-setup) 확인
2. **Windows 보안 경고에서 "허용" 클릭했는지 확인**
3. Windows 방화벽에서 포트 8766 허용
4. Chrome 또는 Edge가 설치되어 있는지 확인

### 브라우저가 보이지 않음

Browser 서버는 브라우저를 visible 모드로 실행합니다. 작업 표시줄 또는 다른 모니터를 확인하세요.
`browser_focus` 도구로 창을 맨 앞으로 가져올 수 있습니다.

### 수동 서버 관리

```bash
# 수동 시작 (Windows에서)
browser-server.exe --port 8766

# 수동 종료
curl -X POST http://localhost:8766/shutdown
```
