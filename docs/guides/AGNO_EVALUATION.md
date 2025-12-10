# Agno Agent Code Generation Evaluation System

이 시스템은 OPEN-CLI의 Agno Agent 코드 생성 능력을 평가하기 위한 자동화된 평가 도구입니다.

## 개요

`scripts/agno_prompts.md`에 정의된 테스트 케이스들을 사용하여, 실제 `open chat` 명령을 subprocess로 실행하고, 생성된 코드를 다음 기준으로 평가합니다:

### 평가 기준

1. **Docs Search 사용 여부**: 코드 생성 시 문서 검색 기능을 활용했는지 확인
2. **Import 구문 검증**: 생성된 코드의 import 구문이 올바른지 검증
3. **문법 에러 검증**: Python/TypeScript 문법 에러가 없는지 확인
4. **코드 생성 여부**: 마크다운 코드 블록이 실제로 생성되었는지 확인

## 구조

```
src/evaluation/
├── test-case-parser.ts       # agno_prompts.md 파싱
├── subprocess-executor.ts     # 'open chat' 명령 실행
├── code-validator.ts          # 코드 검증 로직
├── report-generator.ts        # 결과 리포트 생성
├── evaluator.ts               # 메인 orchestrator
├── run-evaluation.ts          # CLI 실행 스크립트
└── agno_prompts.md            # 테스트 케이스 프롬프트 데이터
```

## 사용법

### 1. 빌드

```bash
npm run build
```

### 2. 전체 테스트 실행

모든 테스트 케이스를 실행하고 마크다운 리포트를 생성합니다:

```bash
npm run evaluate
```

### 3. 특정 테스트 케이스만 실행

Test Case 1, 2, 3만 실행하고 마크다운과 JSON 리포트를 모두 생성합니다:

```bash
npm run evaluate:quick
```

또는 수동으로 지정:

```bash
npm run evaluate -- --test 1,2,3 --format both
```

### 4. 커스텀 옵션 사용

```bash
# 특정 테스트만 실행
npm run evaluate -- --test 5,10,15

# 타임아웃 설정 (밀리초)
npm run evaluate -- --timeout 600000  # 10분

# JSON 리포트 생성
npm run evaluate -- --format json

# 마크다운과 JSON 둘 다 생성
npm run evaluate -- --format both

# 출력 디렉토리 지정
npm run evaluate -- --output ./my-reports

# 조합 예시
npm run evaluate -- --test 1,2,3 --timeout 600000 --format both --output ./reports
```

## CLI 옵션

| 옵션 | 축약형 | 설명 | 기본값 |
|------|--------|------|--------|
| `--test` | `-t` | 실행할 테스트 케이스 ID (쉼표로 구분) | 모든 테스트 |
| `--timeout` | - | 실행 타임아웃 (밀리초) | 300000 (5분) |
| `--format` | `-f` | 리포트 포맷 (markdown, json, both) | markdown |
| `--output` | `-o` | 리포트 출력 디렉토리 | evaluation-reports/ |
| `--help` | `-h` | 도움말 표시 | - |

## 리포트 형식

### 마크다운 리포트 예시

```markdown
# Agno Agent Code Generation Evaluation Report

**Generated**: 2025-01-26 10:30:45

## Summary

- **Total Tests**: 10
- **Passed**: 7 (70.0%)
- **Failed**: 3 (30.0%)

### Metrics

- **Average Duration**: 45.23s
- **Docs Search Usage**: 80.0%
- **Code Generation Rate**: 90.0%
- **Syntax Validity Rate**: 70.0%
- **Import Validity Rate**: 75.0%

## Detailed Results

### Test Case 1: ✅ PASS

**Prompt**: AgentOS를 사용하여 배포 가능한 Agno Agent 만들어줘

**Expected Files**: 65 files

#### Execution
- Duration: 42.15s
- Exit Code: 0
- Success: Yes

#### Code Analysis
- Code Blocks Found: 1
- Docs Search Used: Yes

#### Validation Results

**Code Block 1**:
- Has Code: Yes
- Syntax Valid: ✅
- Imports Valid: ✅

---
```

### JSON 리포트 예시

```json
{
  "timestamp": "2025-01-26T10:30:45.123Z",
  "totalTests": 10,
  "passedTests": 7,
  "failedTests": 3,
  "results": [
    {
      "testCase": {
        "id": 1,
        "prompt": "AgentOS를 사용하여 배포 가능한 Agno Agent 만들어줘",
        "filePaths": ["..."]
      },
      "execution": {
        "success": true,
        "stdout": "...",
        "stderr": "",
        "exitCode": 0,
        "duration": 42150
      },
      "validation": [
        {
          "hasCode": true,
          "importsValid": true,
          "syntaxValid": true,
          "importIssues": [],
          "syntaxErrors": [],
          "warnings": []
        }
      ],
      "hasDocsSearch": true,
      "codeBlocksFound": 1,
      "overallSuccess": true
    }
  ],
  "summary": {
    "averageDuration": 45230,
    "docsSearchUsageRate": 80.0,
    "codeGenerationRate": 90.0,
    "syntaxValidRate": 70.0,
    "importValidRate": 75.0
  }
}
```

## 평가 프로세스

1. **테스트 케이스 파싱**: `agno_prompts.md`에서 프롬프트와 예상 파일 경로 추출
2. **Subprocess 실행**: 각 프롬프트에 대해 `open chat {프롬프트} --debug` 실행
3. **코드 추출**: 생성된 출력에서 마크다운 코드 블록 추출
4. **검증**:
   - Docs search 사용 여부 확인 (디버그 로그에서 "docs-search" 키워드 검색)
   - Python/TypeScript 문법 검증 (py_compile, tsc 사용)
   - Import 구문 검증 (Agno 프레임워크 import 확인, ESM 확장자 검증 등)
5. **리포트 생성**: 결과를 마크다운 및/또는 JSON 형식으로 저장

## 성공 조건

테스트 케이스가 성공으로 간주되려면 다음 조건을 **모두** 만족해야 합니다:

- ✅ Subprocess가 정상 종료 (exit code 0)
- ✅ 최소 1개 이상의 코드 블록 생성
- ✅ Docs search 기능 사용
- ✅ 모든 코드 블록의 문법이 유효
- ✅ 모든 코드 블록의 import 구문이 유효

## 코드 검증 세부사항

### Python 검증

1. **문법 검증**: `python3 -m py_compile` 사용
2. **Import 검증**:
   - Agno 프레임워크 import 존재 확인
   - Wildcard import (`*`) 경고
   - 상대 경로 import 경고

### TypeScript 검증

1. **문법 검증**: `npx tsc --noEmit` 사용
2. **Import 검증**:
   - ESM 상대 경로 import에 `.js` 확장자 필수
   - Namespace import (`* as`) 경고

## 출력 파일

리포트는 기본적으로 `evaluation-reports/` 디렉토리에 저장됩니다:

```
evaluation-reports/
├── evaluation-report-2025-01-26T10-30-45-123Z.md
└── evaluation-report-2025-01-26T10-30-45-123Z.json
```

## 개발자 노트

### 새로운 검증 규칙 추가

`src/evaluation/code-validator.ts`에서 `validatePythonCode()` 또는 `validateTypeScriptCode()` 함수를 수정하세요.

### 새로운 평가 지표 추가

1. `src/evaluation/report-generator.ts`의 `EvaluationReport` 인터페이스에 필드 추가
2. `generateReport()` 함수에서 계산 로직 추가
3. `formatReportAsMarkdown()` 함수에서 출력 형식 추가

### Subprocess 동작 커스터마이징

`src/evaluation/subprocess-executor.ts`의 `executeOpenChat()` 함수를 수정하세요.

## 문제 해결

### "python3: command not found"

Python 3가 설치되어 있는지 확인하세요:

```bash
python3 --version
```

### Timeout 에러

복잡한 테스트의 경우 타임아웃을 늘리세요:

```bash
npm run evaluate -- --timeout 600000  # 10분
```

### 메모리 부족

한 번에 실행하는 테스트 개수를 줄이세요:

```bash
npm run evaluate -- --test 1,2,3
```

## 향후 개선 사항

- [ ] 병렬 실행 지원으로 성능 향상
- [ ] 생성된 코드의 실행 가능성 테스트
- [ ] 코드 품질 메트릭 (복잡도, 중복 등) 추가
- [ ] CI/CD 통합
- [ ] 시간별/버전별 성능 트렌드 분석
- [ ] 웹 대시보드로 결과 시각화

## 라이센스

MIT
