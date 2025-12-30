# Browser Tools

::: danger Chrome 설치 필수
Browser Tools를 사용하려면 **Chrome 또는 Chromium**이 설치되어 있어야 합니다.
:::

## Chrome 설치

### Ubuntu/Debian (WSL 포함)

```bash
# 다운로드
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb --no-check-certificate

# 설치
sudo dpkg -i google-chrome-stable_current_amd64.deb

# 의존성 해결 (필요시)
sudo apt-get install -f -y

# 설치 확인
which google-chrome
```

### 설치 확인 후 활성화

```bash
nexus
# 실행 후 /tool 입력 → Browser Automation 선택
```

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
| `browser_launch` | Chrome 브라우저 실행 |
| `browser_navigate` | URL로 이동 |
| `browser_screenshot` | 페이지 스크린샷 캡처 |
| `browser_click` | 요소 클릭 |
| `browser_fill` | 입력 필드에 텍스트 입력 |
| `browser_get_text` | 요소의 텍스트 가져오기 |
| `browser_close` | 브라우저 종료 |

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
