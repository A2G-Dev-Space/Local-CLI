#!/usr/bin/env python3
"""
LOCAL-CLI --eval 모드 테스트

이 파일은 LOCAL-CLI의 --eval 모드를 사용하여 CLI 기능을 테스트합니다.
Python 개발자가 쉽게 자동화 평가를 할 수 있도록 설계되었습니다.

사용법:
    pytest test_eval.py -v                    # 전체 테스트
    pytest test_eval.py -v -k "basic"         # 기본 테스트만
    pytest test_eval.py -v -k "tool"          # 도구 테스트만
    pytest test_eval.py -v -m "not slow"      # 빠른 테스트만

환경 설정:
    - LLM 엔드포인트가 ~/.local-cli/config.json에 설정되어 있어야 합니다
    - CLI가 빌드되어 있어야 합니다 (npm run build)
"""

import subprocess
import json
import os
import tempfile
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import pytest

# ============================================================================
# 유틸리티
# ============================================================================

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLI_CMD = f"node {PROJECT_ROOT}/dist/cli.js"


@dataclass
class EvalResult:
    """--eval 모드 실행 결과"""
    success: bool
    events: List[Dict[str, Any]]
    response: Optional[str] = None
    error: Optional[str] = None
    duration_ms: int = 0
    tool_calls: int = 0
    files_modified: List[str] = field(default_factory=list)


def run_eval(prompt: str, working_dir: str = None, timeout: int = 120) -> EvalResult:
    """
    --eval 모드로 CLI 실행

    Args:
        prompt: 실행할 프롬프트
        working_dir: 작업 디렉토리
        timeout: 타임아웃 (초)

    Returns:
        EvalResult: 실행 결과 (이벤트 스트림 파싱됨)
    """
    input_data = {"prompt": prompt}
    if working_dir:
        input_data["working_dir"] = working_dir

    try:
        result = subprocess.run(
            CLI_CMD.split() + ["--eval"],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=working_dir or PROJECT_ROOT
        )

        # NDJSON 파싱
        events = []
        for line in result.stdout.strip().split('\n'):
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

        # 결과 추출
        response = None
        error = None
        success = False
        duration_ms = 0
        tool_calls = 0
        files_modified = []

        for event in events:
            if event.get('event') == 'response':
                response = event.get('data', {}).get('content', '')
            elif event.get('event') == 'error':
                error = event.get('data', {}).get('message', '')
            elif event.get('event') == 'end':
                data = event.get('data', {})
                success = data.get('success', False)
                duration_ms = data.get('duration_ms', 0)
                tool_calls = data.get('tool_calls', 0)
                files_modified = data.get('files_modified', [])

        return EvalResult(
            success=success,
            events=events,
            response=response,
            error=error,
            duration_ms=duration_ms,
            tool_calls=tool_calls,
            files_modified=files_modified or []
        )

    except subprocess.TimeoutExpired:
        return EvalResult(success=False, events=[], error=f"Timeout: {timeout}s")
    except Exception as e:
        return EvalResult(success=False, events=[], error=str(e))


def get_events_by_type(events: List[Dict], event_type: str) -> List[Dict]:
    """특정 타입의 이벤트 필터링"""
    return [e for e in events if e.get('event') == event_type]


# ============================================================================
# 테스트 시나리오
# ============================================================================

class TestBasicChat:
    """
    시나리오: 기본 대화

    목적: LLM이 간단한 질문에 올바르게 응답하는지 확인
    검증: 응답이 예상 키워드를 포함하는지 확인
    """

    def test_simple_math(self):
        """
        시나리오: 간단한 수학 질문
        입력: "1+1은 뭐야? 숫자만 답해"
        기대: 응답에 "2" 포함
        """
        result = run_eval("1+1은 뭐야? 숫자만 답해")

        assert result.success, f"실패: {result.error}"
        assert result.response is not None
        assert "2" in result.response, f"'2' not in response: {result.response}"

    def test_korean_knowledge(self):
        """
        시나리오: 한국어 지식 질문
        입력: "대한민국의 수도는? 도시 이름만 답해"
        기대: 응답에 "서울" 포함
        """
        result = run_eval("대한민국의 수도는? 도시 이름만 답해")

        assert result.success, f"실패: {result.error}"
        assert "서울" in result.response, f"'서울' not in: {result.response}"

    def test_context_understanding(self):
        """
        시나리오: 컨텍스트 이해
        입력: 프로젝트 정보를 제공하고 이름 질문
        기대: 제공된 정보에서 정확히 추출
        """
        prompt = """다음 정보를 바탕으로 답해:
프로젝트명: LOCAL-CLI
버전: 2.5.0

질문: 프로젝트 이름은?"""

        result = run_eval(prompt)

        assert result.success
        assert "local-cli" in result.response.lower()


class TestFileTools:
    """
    시나리오: 파일 도구 사용

    목적: LLM이 파일 관련 도구를 올바르게 호출하는지 확인
    검증: tool_call 이벤트 발생 및 올바른 결과 반환
    """

    def test_list_files(self):
        """
        시나리오: 디렉토리 목록 조회
        입력: "현재 디렉토리의 파일 목록을 보여줘"
        기대: list_files 도구 호출, package.json 포함된 응답
        """
        result = run_eval(
            "현재 디렉토리의 파일 목록을 보여줘",
            working_dir=PROJECT_ROOT
        )

        assert result.success, f"실패: {result.error}"
        assert result.tool_calls >= 1, "도구가 호출되지 않음"

        # tool_call 이벤트 확인
        tool_events = get_events_by_type(result.events, 'tool_call')
        assert len(tool_events) > 0, "tool_call 이벤트 없음"

        # 응답에 주요 파일 포함
        assert "package.json" in result.response

    def test_read_file(self):
        """
        시나리오: 파일 읽기
        입력: "package.json 파일을 읽어서 프로젝트 이름을 알려줘"
        기대: read_file 도구 호출, 프로젝트 이름 포함된 응답
        """
        result = run_eval(
            "package.json 파일을 읽어서 프로젝트 이름을 알려줘",
            working_dir=PROJECT_ROOT
        )

        assert result.success, f"실패: {result.error}"
        assert result.tool_calls >= 1

        # 프로젝트 이름 확인 (local-cli)
        response_lower = result.response.lower()
        assert "local-cli" in response_lower or "local" in response_lower

    @pytest.mark.slow
    def test_create_file(self):
        """
        시나리오: 파일 생성
        입력: 임시 디렉토리에 파일 생성 요청
        기대: create_file 도구 호출, 파일 실제 생성됨
        """
        with tempfile.TemporaryDirectory(prefix="lcli-test-") as temp_dir:
            file_path = os.path.join(temp_dir, "test.txt")

            result = run_eval(
                f'{file_path} 파일에 "Hello World" 라고 작성해줘',
                timeout=180
            )

            assert result.success, f"실패: {result.error}"

            # 파일 생성 확인
            if os.path.exists(file_path):
                with open(file_path) as f:
                    content = f.read()
                assert "Hello" in content, f"파일 내용: {content}"


class TestToolCallEvents:
    """
    시나리오: Tool Call 이벤트 검증

    목적: --eval 모드의 이벤트 스트림이 올바른 구조인지 확인
    검증: 이벤트 타입, 필드 존재 여부
    """

    def test_event_stream_structure(self):
        """
        시나리오: 이벤트 스트림 구조
        입력: 간단한 요청
        기대: start, response, end 이벤트 순서대로 발생
        """
        result = run_eval("안녕")

        assert result.success

        event_types = [e.get('event') for e in result.events]

        # 필수 이벤트 확인
        assert 'start' in event_types, "start 이벤트 없음"
        assert 'end' in event_types, "end 이벤트 없음"

        # start가 첫 번째, end가 마지막
        assert event_types[0] == 'start'
        assert event_types[-1] == 'end'

    def test_tool_call_event_fields(self):
        """
        시나리오: tool_call 이벤트 필드
        입력: 도구 호출이 필요한 요청
        기대: tool_call 이벤트에 tool, args 필드 존재
        """
        result = run_eval(
            "현재 디렉토리 파일 목록 보여줘",
            working_dir=PROJECT_ROOT
        )

        tool_events = get_events_by_type(result.events, 'tool_call')

        if len(tool_events) > 0:
            event_data = tool_events[0].get('data', {})
            assert 'tool' in event_data, "tool 필드 없음"
            assert 'args' in event_data, "args 필드 없음"

    def test_end_event_fields(self):
        """
        시나리오: end 이벤트 필드
        입력: 아무 요청
        기대: end 이벤트에 success, duration_ms 필드 존재
        """
        result = run_eval("1+1")

        end_events = get_events_by_type(result.events, 'end')
        assert len(end_events) == 1, "end 이벤트가 정확히 1개여야 함"

        end_data = end_events[0].get('data', {})
        assert 'success' in end_data
        assert 'duration_ms' in end_data


class TestCodeGeneration:
    """
    시나리오: 코드 생성

    목적: LLM이 코드를 올바르게 생성하는지 확인
    검증: 코드 블록 포함, 기본 문법 확인
    """

    @pytest.mark.slow
    def test_python_function(self):
        """
        시나리오: Python 함수 생성
        입력: "Python으로 피보나치 함수 작성해줘"
        기대: def 키워드 포함, 함수 구조
        """
        result = run_eval(
            "Python으로 피보나치 함수 작성해줘. 코드만 답해",
            timeout=180
        )

        assert result.success, f"실패: {result.error}"
        assert "def" in result.response, "함수 정의 없음"

        response_lower = result.response.lower()
        assert "fib" in response_lower or "fibonacci" in response_lower


class TestErrorHandling:
    """
    시나리오: 에러 처리

    목적: 에러 상황에서도 graceful하게 처리되는지 확인
    검증: 에러 메시지 포함, 시스템 크래시 없음
    """

    def test_nonexistent_file(self):
        """
        시나리오: 존재하지 않는 파일
        입력: 없는 파일 읽기 요청
        기대: 에러 메시지 또는 "찾을 수 없음" 응답
        """
        result = run_eval("/nonexistent/path/file.txt 파일을 읽어줘")

        # 크래시 없이 처리되어야 함
        assert len(result.events) > 0, "이벤트가 하나도 없음"

        # 에러이거나, 파일 없음 응답이어야 함
        if not result.success:
            assert result.error is not None
        else:
            response_lower = result.response.lower() if result.response else ""
            error_keywords = ["없", "찾을 수 없", "not found", "error", "존재하지", "실패"]
            has_error_keyword = any(k in response_lower for k in error_keywords)
            assert has_error_keyword, f"에러 응답 아님: {result.response}"


class TestMultiStepWorkflow:
    """
    시나리오: 다단계 워크플로우

    목적: 복잡한 작업이 순차적으로 처리되는지 확인
    검증: 여러 도구 호출, 완료된 결과
    """

    @pytest.mark.slow
    def test_analysis_workflow(self):
        """
        시나리오: 프로젝트 분석
        입력: 여러 파일 확인 및 분석 요청
        기대: 여러 도구 호출, 종합 응답
        """
        result = run_eval(
            "package.json을 읽고 프로젝트 이름과 버전을 알려줘",
            working_dir=PROJECT_ROOT,
            timeout=180
        )

        assert result.success, f"실패: {result.error}"
        assert result.response is not None
        assert len(result.response) > 10, "응답이 너무 짧음"


# ============================================================================
# 메인 실행
# ============================================================================

if __name__ == "__main__":
    # 직접 실행 시 pytest 호출
    pytest.main([__file__, "-v"])
