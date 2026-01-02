# Web Debugging

Nexus Coder의 Browser Tools를 활용하여 웹 애플리케이션을 디버깅하는 과정을 확인하세요.

## 데모 영상

<video controls width="100%">
  <source src="/videos/web-debugging.mp4" type="video/mp4">
</video>

## 활용 예시

### Console 에러 디버깅

```
> 브라우저 열고 localhost:3000 접속해서 콘솔 에러 확인해줘
> 에러 메시지 보고 원인 분석하고 수정해줘
```

### Network 요청 분석

```
> API 호출이 제대로 되는지 네트워크 로그 확인해줘
> 401 에러 나는 API 찾아서 인증 문제 해결해줘
```

### UI 상태 확인

```
> 버튼 클릭하고 콘솔에 로그 찍히는지 확인해줘
> 폼 제출 후 네트워크 요청 확인해줘
```

### 통합 디버깅 워크플로우

```
> 로그인 기능 테스트하고 문제 있으면 디버깅해서 수정해줘
> 페이지 로드 시 에러나는 것 같은데 확인하고 고쳐줘
```

## 사용 가능한 도구

| 도구 | 설명 |
|------|------|
| `browser_get_console` | JavaScript 콘솔 로그 (log, error, warn) 조회 |
| `browser_get_network` | HTTP 요청/응답 로그 조회 |
| `browser_screenshot` | 현재 페이지 스크린샷 캡처 |
| `browser_get_content` | 페이지 HTML 소스 조회 |

## 팁

- Console과 Network 로그를 함께 확인하면 문제를 빠르게 파악할 수 있습니다
- 스크린샷과 함께 디버깅하면 UI 상태도 확인 가능합니다
- 에러 발생 시 "확인하고 수정해줘"라고 요청하면 자동으로 분석 후 코드 수정까지 진행합니다
