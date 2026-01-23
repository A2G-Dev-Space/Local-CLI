# Office Tools

::: danger Windows + Microsoft Office 필수
Office Tools를 사용하려면 **Windows에 Microsoft Office**가 설치되어 있어야 합니다.
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

`office-server.exe`가 네트워크 통신을 시도하기 때문에 발생하는 정상적인 경고입니다.
:::

---

## 이걸로 뭘 할 수 있나요?

::: tip 문서 작업 완전 자동화
AI가 코드만 작성하는 게 아니라, **직접 Office 앱을 열고 문서를 작성**합니다.
코드 → 문서화 → 보고서까지 한 번에!
:::

### 1. 기술 문서 자동 생성
```
"이 함수의 API 문서를 Word로 만들어줘"
→ AI가 코드 분석 → Word 실행 → 제목/본문 작성 → 테이블로 파라미터 정리 → 저장
```

### 2. 데이터 분석 보고서
```
"logs.json 파일 분석해서 Excel 보고서 만들어줘"
→ 데이터 읽기 → Excel 실행 → 시트에 데이터 입력 → 서식 적용 → 차트용 정렬 → 저장
```

### 3. 프레젠테이션 자동 생성
```
"프로젝트 README 기반으로 발표 자료 만들어줘"
→ README 분석 → PowerPoint 실행 → 슬라이드 생성 → 텍스트/이미지 배치 → 저장
```

### 4. 반복 문서 작업
```
"이 템플릿으로 10개 보고서 생성해줘"
→ 데이터 소스 읽기 → 루프 돌면서 문서 생성 → 각각 저장
```

### 5. 코드 + 문서 동시 작업
```
"기능 구현하고 사용 가이드도 Word로 작성해줘"
→ 코드 작성 → 테스트 → Word로 가이드 문서 자동 생성
```

---

## 사용 가능한 도구

### Microsoft Word (16 tools)

| 도구 | 설명 |
|-----|------|
| `word_launch` | Word 실행 (새 문서 또는 기존 파일 열기) |
| `word_write` | 텍스트 작성 (폰트, 크기, 볼드/이탤릭 지원) |
| `word_read` | 문서 내용 읽기 |
| `word_save` | 문서 저장 (.docx, .pdf 등) |
| `word_screenshot` | 현재 문서 스크린샷 |
| `word_close` | Word 종료 |
| `word_set_font` | 선택 영역 폰트 설정 |
| `word_set_paragraph` | 문단 정렬, 줄간격 설정 |
| `word_add_table` | 표 삽입 |
| `word_add_image` | 이미지 삽입 |
| `word_add_hyperlink` | 하이퍼링크 추가 |
| `word_find_replace` | 찾기/바꾸기 |
| `word_set_style` | 스타일 적용 (제목, 본문 등) |
| `word_insert_break` | 페이지/섹션 구분 삽입 |
| `word_select_all` | 전체 선택 |
| `word_goto` | 특정 위치로 이동 |

### Microsoft Excel (27 tools)

| 도구 | 설명 |
|-----|------|
| `excel_launch` | Excel 실행 |
| `excel_write_cell` | 단일 셀에 값 쓰기 |
| `excel_read_cell` | 단일 셀 값 읽기 |
| `excel_write_range` | 범위에 2D 배열 쓰기 |
| `excel_read_range` | 범위 값 읽기 |
| `excel_save` | 통합 문서 저장 |
| `excel_screenshot` | 현재 시트 스크린샷 |
| `excel_close` | Excel 종료 |
| `excel_set_font` | 폰트 설정 (이름, 크기, 색상, 볼드/이탤릭) |
| `excel_set_fill` | 셀 배경색 설정 |
| `excel_set_number_format` | 숫자 형식 (통화, 날짜, 퍼센트 등) |
| `excel_set_border` | 테두리 설정 |
| `excel_set_alignment` | 정렬 (가로, 세로, 텍스트 줄바꿈) |
| `excel_merge_cells` | 셀 병합/해제 |
| `excel_set_column_width` | 열 너비 설정 |
| `excel_set_row_height` | 행 높이 설정 |
| `excel_add_sheet` | 새 시트 추가 |
| `excel_delete_sheet` | 시트 삭제 |
| `excel_rename_sheet` | 시트 이름 변경 |
| `excel_get_sheets` | 모든 시트 목록 조회 |
| `excel_sort_range` | 범위 정렬 |
| `excel_insert_row` | 행 삽입 |
| `excel_delete_row` | 행 삭제 |
| `excel_insert_column` | 열 삽입 |
| `excel_delete_column` | 열 삭제 |
| `excel_freeze_panes` | 틀 고정 |
| `excel_auto_filter` | 자동 필터 적용 |

### Microsoft PowerPoint (13 tools)

| 도구 | 설명 |
|-----|------|
| `powerpoint_launch` | PowerPoint 실행 |
| `powerpoint_add_slide` | 새 슬라이드 추가 (레이아웃 선택) |
| `powerpoint_write_text` | 슬라이드에 텍스트 작성 |
| `powerpoint_read_slide` | 슬라이드 내용 읽기 |
| `powerpoint_save` | 프레젠테이션 저장 |
| `powerpoint_screenshot` | 슬라이드 스크린샷 |
| `powerpoint_close` | PowerPoint 종료 |
| `powerpoint_add_textbox` | 텍스트 상자 추가 |
| `powerpoint_set_font` | 텍스트 폰트 설정 |
| `powerpoint_add_image` | 이미지 삽입 |
| `powerpoint_add_animation` | 애니메이션 효과 추가 |
| `powerpoint_set_background` | 슬라이드 배경 설정 |
| `powerpoint_get_slide_count` | 슬라이드 개수 조회 |

---

## 활성화 방법

```bash
# nexus 실행 후
/tool
# → Microsoft Word / Excel / PowerPoint 중 선택 (Enter)
# → ● enabled 상태 확인
```

활성화 시 Office 서버가 자동으로 시작됩니다. 상태는 재시작해도 유지됩니다.

---

## 예시 워크플로우

### 코드 문서화
```
사용자: "src/utils.ts 함수들 분석해서 Word 문서로 정리해줘"

AI 동작:
1. Read 도구로 소스 파일 분석
2. word_launch로 Word 실행
3. word_write로 제목 작성 (볼드, 크기 20)
4. 각 함수마다 word_add_table로 파라미터 표 생성
5. word_save로 utils-documentation.docx 저장
```

### 데이터 보고서
```
사용자: "data.json 읽어서 Excel로 정리하고 헤더는 파란색으로"

AI 동작:
1. Read 도구로 JSON 파일 읽기
2. excel_launch로 Excel 실행
3. excel_write_range로 데이터 입력
4. excel_set_fill로 헤더 행 파란색 설정
5. excel_set_font로 헤더 볼드 처리
6. excel_save로 report.xlsx 저장
```

### 발표 자료 생성
```
사용자: "프로젝트 개요 슬라이드 5장 만들어줘"

AI 동작:
1. powerpoint_launch로 PowerPoint 실행
2. powerpoint_add_slide로 제목 슬라이드 추가
3. powerpoint_write_text로 프로젝트명 작성
4. powerpoint_add_slide 반복하며 내용 슬라이드 추가
5. powerpoint_add_image로 다이어그램 삽입
6. powerpoint_save로 presentation.pptx 저장
```

---

## 문제 해결

### "Server not responding" 오류

1. [WSL 네트워크 설정](/guide/wsl-setup) 확인
2. **Windows 보안 경고에서 "허용" 클릭했는지 확인**
3. Windows 방화벽에서 포트 8765 허용
4. Office가 설치되어 있는지 확인

### Office 앱이 보이지 않음

Office 서버는 앱을 visible 모드로 실행합니다. 작업 표시줄 또는 다른 모니터를 확인하세요.

### 수동 서버 관리

```bash
# 수동 시작 (Windows에서)
office-server/dist/office-server.exe --port 8765

# 수동 종료
curl -X POST http://localhost:8765/shutdown
```
