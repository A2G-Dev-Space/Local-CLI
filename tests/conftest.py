"""pytest 설정"""

import pytest


def pytest_configure(config):
    """커스텀 마커 등록"""
    config.addinivalue_line("markers", "slow: 느린 테스트 (2분+ 소요)")
    config.addinivalue_line("markers", "llm: LLM 연결 필요")
    config.addinivalue_line("markers", "tool: 도구 호출 테스트")
