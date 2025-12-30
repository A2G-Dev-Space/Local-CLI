# Tools

Nexus Coder가 제공하는 도구들입니다.

## 파일 도구

### read_file
파일 내용을 읽습니다.

```
파일 경로와 읽을 범위를 지정할 수 있습니다.
```

### create_file
새 파일을 생성합니다.

### edit_file
기존 파일을 수정합니다.

```
old_string → new_string 방식으로 정확한 위치를 찾아 교체합니다.
```

## 검색 도구

### find_files
파일 이름 패턴으로 검색합니다.

```bash
# 예: 모든 TypeScript 파일 찾기
**/*.ts
```

### search_code
코드 내용으로 검색합니다 (grep 기반).

## 실행 도구

### bash
셸 명령어를 실행합니다.

```bash
# 예: 테스트 실행
npm test
```

### bash_background
백그라운드에서 장시간 실행되는 명령을 시작합니다.

```bash
# 예: 개발 서버 실행
npm run dev
```

- 프로세스가 백그라운드에서 실행되며, 프로세스 ID가 반환됩니다
- `bash_background_status`로 상태 확인 가능
- `bash_background_kill`로 종료 가능

### bash_background_status
실행 중인 백그라운드 프로세스의 상태와 출력을 확인합니다.

```bash
# 특정 프로세스 상태 확인
process_id: "abc123"
```

### bash_background_kill
백그라운드 프로세스를 종료합니다.

```bash
# 프로세스 종료
process_id: "abc123"
```

## TODO 도구

### write_todos
TODO 리스트를 업데이트합니다.

## 문서 검색

### call_docs_search_agent
로컬 문서를 검색합니다.

---

## Optional Tools

`/tool` 명령어로 활성화/비활성화할 수 있는 선택적 도구들입니다.

### Browser Automation Tools

Chrome DevTools Protocol (CDP)를 사용한 브라우저 자동화 도구입니다.

::: info 완벽한 End-to-End 자동화
개발 서버 실행 → 브라우저 접속 → 스크린샷으로 현재 상태 파악 → 코드 수정 → 결과 확인 → 배포까지, 전체 개발 워크플로우를 AI가 자동으로 수행합니다. 더 이상 수동으로 브라우저를 열고 확인할 필요가 없습니다.
:::

::: tip 활성화 방법
`/tool` 입력 후 Browser Automation을 선택하여 활성화합니다.
활성화 상태는 재시작해도 유지됩니다.
:::

#### browser_launch
Chrome 브라우저를 실행합니다.

```
- headless: false (기본값) - 브라우저 창이 보임
- headless: true - 백그라운드 실행
```

#### browser_navigate
지정된 URL로 이동합니다.

```bash
# 예: 로컬 개발 서버
http://localhost:3000
```

#### browser_screenshot
현재 페이지의 스크린샷을 캡처합니다.

```
- full_page: true - 전체 페이지 캡처
- full_page: false - 현재 뷰포트만 캡처
```

#### browser_click
CSS 셀렉터로 요소를 클릭합니다.

```css
/* 예시 */
button[type="submit"]
#login-btn
.nav-link
```

#### browser_fill
입력 필드에 텍스트를 입력합니다.

```css
/* 셀렉터 예시 */
input[name="email"]
#password
textarea.comment
```

#### browser_get_text
요소의 텍스트 내용을 가져옵니다.

```css
/* 에러 메시지 확인 등 */
.error-message
#result
```

#### browser_close
브라우저를 종료합니다.

---

## 사용 예시

### 웹 테스트 워크플로우

```
1. bash_background로 개발 서버 시작
   > npm run dev

2. /tool로 Browser Automation 활성화

3. browser_launch로 브라우저 실행

4. browser_navigate로 localhost:3000 이동

5. browser_screenshot으로 페이지 확인

6. browser_fill, browser_click으로 폼 테스트

7. browser_close로 브라우저 종료

8. bash_background_kill로 서버 종료
```
