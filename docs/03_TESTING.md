# 테스트 가이드 (Testing Guide)

이 문서는 LOCAL-CLI의 `--eval` 모드를 사용한 Python 테스트 시스템을 설명합니다.

---

## 목차

1. [빠른 시작](#1-빠른-시작)
2. [--eval 모드 소개](#2---eval-모드-소개)
3. [Python 테스트](#3-python-테스트)
4. [테스트 시나리오](#4-테스트-시나리오)
5. [이벤트 스트림](#5-이벤트-스트림)
6. [새 테스트 추가하기](#6-새-테스트-추가하기)
7. [문제 해결](#7-문제-해결)

---

## 1. 빠른 시작

### 사전 요구사항

```bash
# Python 3.8+ 필요
python --version

# pytest 설치
pip install pytest

# CLI 빌드
npm run build
```

### 테스트 실행

```bash
# 전체 테스트
npm run test

# 빠른 테스트 (느린 테스트 제외)
npm run test:quick

# 직접 pytest 실행
cd tests && python -m pytest test_eval.py -v
```

---

## 2. --eval 모드 소개

`--eval` 모드는 Python 개발자가 LOCAL-CLI를 자동화 평가할 수 있도록 설계되었습니다.

### 기본 사용법

```bash
# stdin으로 JSON 입력, stdout으로 NDJSON 이벤트 출력
echo '{"prompt": "1+1은?"}' | lcli --eval
```

### 입력 스키마

```json
{
  "prompt": "실행할 프롬프트 (필수)",
  "working_dir": "작업 디렉토리 (선택)"
}
```

### 출력 (NDJSON 이벤트 스트림)

```jsonl
{"event": "start", "timestamp": "...", "data": {"prompt": "...", "model": "...", "endpoint": "...", "working_dir": "..."}}
{"event": "tool_call", "timestamp": "...", "data": {"tool": "list_files", "args": {...}}}
{"event": "tool_result", "timestamp": "...", "data": {"tool": "...", "success": true, "result": "..."}}
{"event": "response", "timestamp": "...", "data": {"content": "최종 응답"}}
{"event": "end", "timestamp": "...", "data": {"success": true, "duration_ms": 1234, "tool_calls": 2}}
```

### Python에서 사용

```python
import subprocess
import json

def eval_lcli(prompt: str) -> dict:
    result = subprocess.run(
        ["lcli", "--eval"],
        input=json.dumps({"prompt": prompt}),
        capture_output=True,
        text=True,
        timeout=120
    )

    events = [json.loads(line) for line in result.stdout.strip().split('\n') if line]
    return events

# 사용 예시
events = eval_lcli("1+1은?")
response = next(e for e in events if e["event"] == "response")
print(response["data"]["content"])  # "2"
```

---

## 3. Python 테스트

### 파일 구조

```
tests/
├── test_eval.py       # 메인 테스트 파일
└── requirements.txt   # Python 의존성
```

### 테스트 실행 옵션

```bash
# 전체 테스트
pytest test_eval.py -v

# 특정 클래스만
pytest test_eval.py::TestBasicChat -v

# 특정 테스트만
pytest test_eval.py::TestBasicChat::test_simple_math -v

# 키워드로 필터링
pytest test_eval.py -v -k "file"

# 느린 테스트 제외
pytest test_eval.py -v -m "not slow"

# 병렬 실행 (pytest-xdist 필요)
pytest test_eval.py -v -n 4
```

### 테스트 마커

| 마커 | 설명 |
|------|------|
| `@pytest.mark.slow` | 느린 테스트 (2분+ 소요) |
| `@pytest.mark.llm` | LLM 연결 필요 |
| `@pytest.mark.tool` | 도구 호출 테스트 |

---

## 4. 테스트 시나리오

### 4.1 기본 대화 (TestBasicChat)

| 테스트 | 설명 | 검증 |
|--------|------|------|
| `test_simple_math` | 간단한 수학 질문 | 응답에 "2" 포함 |
| `test_korean_knowledge` | 한국어 지식 질문 | 응답에 "서울" 포함 |
| `test_context_understanding` | 컨텍스트 이해 | 제공된 정보 추출 |

### 4.2 파일 도구 (TestFileTools)

| 테스트 | 설명 | 검증 |
|--------|------|------|
| `test_list_files` | 디렉토리 목록 | list_files 호출, 파일 목록 |
| `test_read_file` | 파일 읽기 | read_file 호출, 내용 추출 |
| `test_create_file` | 파일 생성 | create_file 호출, 파일 생성됨 |

### 4.3 이벤트 구조 (TestToolCallEvents)

| 테스트 | 설명 | 검증 |
|--------|------|------|
| `test_event_stream_structure` | 이벤트 순서 | start → ... → end |
| `test_tool_call_event_fields` | tool_call 필드 | tool, args 존재 |
| `test_end_event_fields` | end 필드 | success, duration_ms 존재 |

### 4.4 코드 생성 (TestCodeGeneration)

| 테스트 | 설명 | 검증 |
|--------|------|------|
| `test_python_function` | Python 함수 생성 | def 키워드 포함 |

### 4.5 에러 처리 (TestErrorHandling)

| 테스트 | 설명 | 검증 |
|--------|------|------|
| `test_nonexistent_file` | 없는 파일 읽기 | graceful 에러 처리 |

### 4.6 다단계 워크플로우 (TestMultiStepWorkflow)

| 테스트 | 설명 | 검증 |
|--------|------|------|
| `test_analysis_workflow` | 프로젝트 분석 | 여러 도구 호출, 종합 응답 |

---

## 5. 이벤트 스트림

### 이벤트 타입

| 이벤트 | 설명 | 데이터 필드 |
|--------|------|------------|
| `start` | 시작 | prompt, model, endpoint, working_dir |
| `todo` | TODO 상태 변경 | action, id, title, status |
| `tool_call` | 도구 호출 | tool, args |
| `tool_result` | 도구 결과 | tool, success, result/error |
| `response` | 최종 응답 | content |
| `error` | 에러 발생 | message, code |
| `end` | 종료 | success, duration_ms, tool_calls, todos, files_modified |

### TODO 액션

| 액션 | 설명 |
|------|------|
| `created` | TODO 생성됨 |
| `started` | TODO 시작됨 |
| `completed` | TODO 완료됨 |
| `failed` | TODO 실패함 |

### 이벤트 파싱 예시

```python
def parse_events(stdout: str) -> dict:
    """NDJSON 이벤트 파싱"""
    events = []
    for line in stdout.strip().split('\n'):
        if line:
            events.append(json.loads(line))

    result = {
        "events": events,
        "response": None,
        "success": False,
        "tool_calls": 0
    }

    for event in events:
        if event["event"] == "response":
            result["response"] = event["data"]["content"]
        elif event["event"] == "end":
            result["success"] = event["data"]["success"]
            result["tool_calls"] = event["data"].get("tool_calls", 0)

    return result
```

---

## 6. 새 테스트 추가하기

### 기본 구조

```python
class TestMyFeature:
    """
    시나리오: 기능 설명

    목적: 무엇을 테스트하는지
    검증: 어떻게 검증하는지
    """

    def test_my_case(self):
        """
        시나리오: 구체적인 테스트 케이스
        입력: "프롬프트 내용"
        기대: 예상 결과
        """
        result = run_eval("프롬프트")

        assert result.success, f"실패: {result.error}"
        assert "예상 키워드" in result.response
```

### 도구 호출 테스트

```python
def test_with_tool(self):
    """파일 읽기 도구 테스트"""
    result = run_eval(
        "package.json 파일을 읽어줘",
        working_dir=PROJECT_ROOT
    )

    assert result.success
    assert result.tool_calls >= 1

    # tool_call 이벤트 확인
    tool_events = get_events_by_type(result.events, 'tool_call')
    assert len(tool_events) > 0
```

### 느린 테스트 마킹

```python
@pytest.mark.slow
def test_complex_operation(self):
    """복잡한 작업 (2분+ 소요)"""
    result = run_eval("...", timeout=180)
    # ...
```

---

## 7. 문제 해결

### Q: 테스트가 타임아웃됩니다

**A:** timeout 값을 늘려보세요.

```python
result = run_eval("...", timeout=300)  # 5분
```

### Q: LLM 연결 에러가 발생합니다

**A:** 설정을 확인하세요.

```bash
# CLI 실행해서 설정 확인
lcli

# /settings → LLMs 에서 엔드포인트 확인
```

### Q: 특정 테스트만 실행하고 싶습니다

**A:** pytest 필터 옵션을 사용하세요.

```bash
# 클래스로 필터
pytest test_eval.py::TestBasicChat -v

# 키워드로 필터
pytest test_eval.py -k "file" -v

# 마커로 필터
pytest test_eval.py -m "not slow" -v
```

### Q: 이벤트가 제대로 파싱되지 않습니다

**A:** CLI가 빌드되어 있는지 확인하세요.

```bash
npm run build
```

---

## PR 체크리스트

PR 생성 전 다음을 확인하세요:

- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] `npm run test` 또는 `npm run test:quick` 통과

```bash
# 한 번에 검증
npm run prepr && npm run test:quick
```

---

## 예시: 커스텀 평가 스크립트

```python
#!/usr/bin/env python3
"""커스텀 평가 스크립트 예시"""

import sys
sys.path.insert(0, 'tests')

from test_eval import run_eval

def evaluate_code_generation():
    """코드 생성 능력 평가"""
    prompts = [
        "Python으로 피보나치 함수 작성해줘",
        "JavaScript로 배열 정렬 함수 작성해줘",
        "TypeScript로 인터페이스 정의해줘",
    ]

    results = []
    for prompt in prompts:
        result = run_eval(prompt, timeout=180)
        results.append({
            "prompt": prompt,
            "success": result.success,
            "has_code": "def" in (result.response or "") or "function" in (result.response or ""),
            "duration_ms": result.duration_ms
        })

    # 결과 요약
    success_rate = sum(1 for r in results if r["success"]) / len(results)
    print(f"Success Rate: {success_rate:.1%}")

    for r in results:
        status = "✅" if r["success"] and r["has_code"] else "❌"
        print(f"  {status} {r['prompt'][:40]}... ({r['duration_ms']}ms)")

if __name__ == "__main__":
    evaluate_code_generation()
```

---

**질문이 있으면 GitHub Issues를 이용해주세요!**
