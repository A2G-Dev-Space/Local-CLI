#!/bin/bash

# ============================================================================
# Office Tools Modularization Script
#
# Office 파일들을 도메인별로 분리하고 검증하는 자동화 스크립트
#
# 대상 파일 (총 ~12,900 라인):
# - powerpoint-tools.ts (3,006줄, 66개 도구)
# - excel-tools.ts (2,816줄, 60개 도구)
# - word-tools.ts (2,287줄, 50개 도구)
# - powerpoint-client.ts (1,492줄)
# - excel-client.ts (1,293줄)
# - word-client.ts (1,160줄)
#
# 각 모듈에 대해 3단계 반복:
# 1) 기능 재배치 (claude 실행)
# 2) 배치 검증
# 3) 누락 검증
# ============================================================================

set -e

# 색상 설정
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 로그 파일
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="office_refactor_${TIMESTAMP}.log"
BRANCH_NAME="refactor/office-modularization"

# 모듈 정의 (앱별로)
declare -a APPS=("powerpoint" "excel" "word")

# PowerPoint 도메인
declare -a POWERPOINT_DOMAINS=(
    "launch:launch,create,open,quit,close,screenshot"
    "slides:addSlide,deleteSlide,moveSlide,duplicateSlide,hideSlide,showSlide,setSlideLayout,getSlideCount"
    "shapes:addShape,deleteShape,duplicateShape,rotateShape,getShapeInfo,setShapeName,getShapeList,setShapePosition,setShapeSize,setShapeStyle"
    "text:writeText,readSlide,addTextbox,setFont,setTextAlignment,setBulletList,setLineSpacing,setTextboxBorder,setTextboxFill"
    "tables:addTable,setTableCell,setTableStyle"
    "media:addImage,addVideo,addAudio,addHyperlink,addChart"
    "effects:setTransition,setBackground,setAnimation,addAnimation,setShadow,setReflection,applyTheme,getThemes"
    "zorder:bringToFront,sendToBack,bringForward,sendBackward,alignShapes,distributeShapes,groupShapes,ungroupShapes"
    "sections:addSection,deleteSection,getSections"
    "notes:addNote,getNote,setPlaceholderText,getPlaceholders,getSlideLayouts"
    "export:save,exportPdf,startSlideshow"
)

# Excel 도메인
declare -a EXCEL_DOMAINS=(
    "launch:launch,create,open,quit,close,screenshot"
    "cells:writeCell,readCell,writeRange,readRange,copyRange,pasteRange,clearRange"
    "formatting:setFont,setAlignment,setNumberFormat,setFill,setBorder,mergeCells,unmergeCells"
    "sheets:addSheet,deleteSheet,renameSheet,getSheets,selectSheet"
    "rows-columns:setColumnWidth,setRowHeight,insertRow,deleteRow,insertColumn,deleteColumn,hideRow,hideColumn,showRow,showColumn"
    "data-ops:sortRange,setFormula,groupRows,ungroupRows,findReplace,autoFilter,freezePanes"
    "charts:addChart,setChartTitle,deleteChart"
    "validation:addConditionalFormat,clearConditionalFormat,setDataValidation,clearDataValidation"
    "named-ranges:createNamedRange,getNamedRanges,deleteNamedRange"
    "comments:addComment,getComment,deleteComment"
    "protection:protectSheet,unprotectSheet"
    "media:addImage,addHyperlink"
    "export:exportPdf,print"
)

# Word 도메인
declare -a WORD_DOMAINS=(
    "launch:launch,create,open,quit,close,save,screenshot"
    "text:writeText,readDocument,findReplace,setStyle,getSelectedText,deleteText,selectAll"
    "formatting:setFont,setParagraph,insertBreak"
    "tables:addTable,setTableCell,mergeTableCells,setTableStyle,setTableBorder"
    "content:addImage,addHyperlink,addTextbox,addShape"
    "lists:createBulletList,createNumberedList"
    "headers-footers:insertHeader,insertFooter,insertPageNumber"
    "page-setup:setPageMargins,setPageOrientation,setPageSize,setColumns"
    "bookmarks:addBookmark,getBookmarks,deleteBookmark,gotoBookmark"
    "comments:addComment,getComments,deleteComment,deleteAllComments"
    "watermarks:addWatermark,removeWatermark"
    "navigation:gotoPage,gotoLine,getDocumentInfo,getSelection"
    "undo-redo:undo,redo"
    "export:exportPdf,print"
)

# ============================================================================
# 로깅 함수
# ============================================================================
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_step() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}  STEP: $1${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n" | tee -a "$LOG_FILE"
}

log_substep() {
    echo -e "${CYAN}  → $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}  ✓ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}  ✗ ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}  ⚠ WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

log_phase() {
    echo -e "\n${MAGENTA}┌────────────────────────────────────────────────────────────────┐${NC}" | tee -a "$LOG_FILE"
    echo -e "${MAGENTA}│  PHASE: $1${NC}" | tee -a "$LOG_FILE"
    echo -e "${MAGENTA}└────────────────────────────────────────────────────────────────┘${NC}\n" | tee -a "$LOG_FILE"
}

# ============================================================================
# STEP 0: Git 브랜치 설정
# ============================================================================
setup_branch() {
    log_step "0/6: Git Branch Setup"

    log_substep "Fetching latest from origin..."
    git fetch origin 2>&1 | tee -a "$LOG_FILE"

    log_substep "Checking out main branch..."
    git checkout main 2>&1 | tee -a "$LOG_FILE"

    log_substep "Pulling latest changes..."
    git pull origin main 2>&1 | tee -a "$LOG_FILE"

    log_substep "Creating new branch: $BRANCH_NAME"
    if git show-ref --verify --quiet refs/heads/$BRANCH_NAME; then
        log_warning "Branch already exists, switching to it..."
        git checkout $BRANCH_NAME 2>&1 | tee -a "$LOG_FILE"
    else
        git checkout -b $BRANCH_NAME 2>&1 | tee -a "$LOG_FILE"
    fi

    log_success "Branch setup complete"
}

# ============================================================================
# STEP 1: 공통 유틸리티 추출
# ============================================================================
extract_common_utils() {
    log_step "1/6: Extract Common Utilities"

    claude -p "Office 파일들에서 공통 유틸리티를 추출해줘.

현재 상태 분석:
1. src/tools/office/ 폴더의 모든 파일 읽기
2. 중복되는 코드 패턴 찾기:
   - saveScreenshot() 함수
   - hexToRgb() 색상 변환
   - toWindowsPath() 경로 변환
   - alignment 매핑 상수들
   - OFFICE_SCREENSHOT_DIR 상수

작업:
1. src/tools/office/common/ 폴더 생성
2. src/tools/office/common/utils.ts 생성:
   - saveScreenshot 함수
   - hexToRgb 함수
   - toWindowsPath 함수
   - 기타 공통 함수들

3. src/tools/office/common/constants.ts 생성:
   - OFFICE_SCREENSHOT_DIR
   - alignment 매핑 상수들
   - 기타 공통 상수들

4. src/tools/office/common/types.ts 생성:
   - 공통 타입 정의
   - ToolResult 관련 타입

5. src/tools/office/common/index.ts 생성:
   - barrel export

중요:
- 기존 파일들은 아직 수정하지 마세요
- 새 파일만 생성
- agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 40 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Common utilities extraction complete"
}

# ============================================================================
# STEP 2: 모듈별 분리 (3단계 루프)
# ============================================================================
process_app_module() {
    local app=$1
    local domain_info=$2
    local domain_name=$(echo "$domain_info" | cut -d: -f1)
    local tools=$(echo "$domain_info" | cut -d: -f2)

    log_phase "Processing ${app}/${domain_name}"

    # ─────────────────────────────────────────────────────────────────
    # Phase 1: 기능 재배치
    # ─────────────────────────────────────────────────────────────────
    log_substep "Phase 1/3: Relocating functions for ${app}/${domain_name}"

    claude -p "${app}-tools.ts에서 ${domain_name} 관련 도구들을 분리해줘.

대상 도구들: ${tools}

작업:
1. src/tools/office/${app}-tools.ts 파일 읽기
2. src/tools/office/${app}-tools/${domain_name}.ts 파일 생성
3. 해당 도구들의 코드를 새 파일로 이동:
   - Tool Definition (XXXX_TOOL_DEFINITION)
   - Execute 함수 (executeXxxx)
   - Export (xxxTool)

4. 공통 유틸리티는 '../common'에서 import
5. 클라이언트는 '../${app}-client'에서 import

파일 구조:
\`\`\`typescript
// src/tools/office/${app}-tools/${domain_name}.ts
import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../../types.js';
import { ${app}Client } from '../${app}-client.js';
import { saveScreenshot } from '../common/utils.js';
import { OFFICE_SCREENSHOT_DIR } from '../common/constants.js';

// Tool definitions and implementations here...

export const ${domain_name}Tools: LLMSimpleTool[] = [
  // 해당 도구들 export
];
\`\`\`

중요:
- 원본 파일은 아직 수정하지 마세요
- 새 파일만 생성
- 모든 import 경로 정확히 설정
- agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 30 \
    2>&1 | tee -a "$LOG_FILE"

    # ─────────────────────────────────────────────────────────────────
    # Phase 2: 배치 검증
    # ─────────────────────────────────────────────────────────────────
    log_substep "Phase 2/3: Verifying placement for ${app}/${domain_name}"

    claude -p "방금 생성한 src/tools/office/${app}-tools/${domain_name}.ts 파일을 검증해줘.

검증 항목:
1. 파일이 존재하는지 확인
2. 모든 대상 도구(${tools})가 포함되어 있는지 확인
3. import 문이 올바른지 확인
4. export가 올바른지 확인
5. TypeScript 문법 오류가 없는지 확인

문제 발견 시:
- 즉시 수정
- 수정 내용 보고

원본 파일(src/tools/office/${app}-tools.ts)과 비교해서:
- 도구 정의가 정확히 복사되었는지
- 실행 함수가 정확히 복사되었는지
- 누락된 헬퍼 함수가 없는지

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 20 \
    2>&1 | tee -a "$LOG_FILE"

    # ─────────────────────────────────────────────────────────────────
    # Phase 3: 누락 검증
    # ─────────────────────────────────────────────────────────────────
    log_substep "Phase 3/3: Checking for missing items in ${app}/${domain_name}"

    claude -p "src/tools/office/${app}-tools/${domain_name}.ts에서 누락된 것이 없는지 최종 검증해줘.

검증 항목:
1. 원본의 ${domain_name} 관련 모든 코드가 이동되었는지:
   - Tool Definition 상수
   - execute 함수
   - 헬퍼 함수
   - 타입 정의

2. 의존성 확인:
   - 필요한 모든 import가 있는지
   - 순환 의존성이 없는지

3. 기능 완전성:
   - 각 도구가 독립적으로 동작할 수 있는지
   - 필요한 모든 헬퍼가 포함/import 되었는지

누락 발견 시:
- 즉시 추가
- 추가 내용 보고

최종 확인:
- grep으로 원본 파일에서 해당 도구 이름 검색
- 새 파일과 비교

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 20 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "${app}/${domain_name} processing complete"
}

# ============================================================================
# STEP 2: PowerPoint 모듈 분리
# ============================================================================
process_powerpoint() {
    log_step "2/6: PowerPoint Module Separation"

    # 디렉토리 생성
    mkdir -p src/tools/office/powerpoint-tools

    for domain_info in "${POWERPOINT_DOMAINS[@]}"; do
        process_app_module "powerpoint" "$domain_info"
    done

    # Index 파일 생성
    log_substep "Creating powerpoint-tools/index.ts"
    claude -p "src/tools/office/powerpoint-tools/index.ts 파일을 생성해줘.

모든 도메인 파일들을 import하고 re-export:
- launch.ts
- slides.ts
- shapes.ts
- text.ts
- tables.ts
- media.ts
- effects.ts
- zorder.ts
- sections.ts
- notes.ts
- export.ts

형식:
\`\`\`typescript
export * from './launch.js';
export * from './slides.js';
// ... 등등

// 모든 도구를 하나의 배열로
export const POWERPOINT_TOOLS: LLMSimpleTool[] = [
  ...launchTools,
  ...slidesTools,
  // ... 등등
];
\`\`\`

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 20 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "PowerPoint module separation complete"
}

# ============================================================================
# STEP 3: Excel 모듈 분리
# ============================================================================
process_excel() {
    log_step "3/6: Excel Module Separation"

    # 디렉토리 생성
    mkdir -p src/tools/office/excel-tools

    for domain_info in "${EXCEL_DOMAINS[@]}"; do
        process_app_module "excel" "$domain_info"
    done

    # Index 파일 생성
    log_substep "Creating excel-tools/index.ts"
    claude -p "src/tools/office/excel-tools/index.ts 파일을 생성해줘.

모든 도메인 파일들을 import하고 re-export하는 barrel export 파일.
EXCEL_TOOLS 배열로 모든 도구 export.

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 20 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Excel module separation complete"
}

# ============================================================================
# STEP 4: Word 모듈 분리
# ============================================================================
process_word() {
    log_step "4/6: Word Module Separation"

    # 디렉토리 생성
    mkdir -p src/tools/office/word-tools

    for domain_info in "${WORD_DOMAINS[@]}"; do
        process_app_module "word" "$domain_info"
    done

    # Index 파일 생성
    log_substep "Creating word-tools/index.ts"
    claude -p "src/tools/office/word-tools/index.ts 파일을 생성해줘.

모든 도메인 파일들을 import하고 re-export하는 barrel export 파일.
WORD_TOOLS 배열로 모든 도구 export.

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 20 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Word module separation complete"
}

# ============================================================================
# STEP 5: 전체 검증 및 원본 파일 업데이트
# ============================================================================
final_verification() {
    log_step "5/6: Final Verification & Original File Update"

    # ─────────────────────────────────────────────────────────────────
    # 5.1: 도구 개수 비교
    # ─────────────────────────────────────────────────────────────────
    log_substep "5.1: Comparing tool counts"

    claude -p "원본 파일과 새 모듈의 도구 개수를 비교해줘.

비교 대상:
1. PowerPoint:
   - 원본: src/tools/office/powerpoint-tools.ts (66개 도구)
   - 새 모듈: src/tools/office/powerpoint-tools/*.ts

2. Excel:
   - 원본: src/tools/office/excel-tools.ts (60개 도구)
   - 새 모듈: src/tools/office/excel-tools/*.ts

3. Word:
   - 원본: src/tools/office/word-tools.ts (50개 도구)
   - 새 모듈: src/tools/office/word-tools/*.ts

검증 방법:
1. 원본 파일에서 'export const.*Tool' 패턴 카운트
2. 새 모듈들에서 동일 패턴 카운트
3. 개수 비교

누락된 도구 발견 시:
- 어떤 도구가 누락되었는지 리스트
- 해당 도구를 적절한 도메인 파일에 추가

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 30 \
    2>&1 | tee -a "$LOG_FILE"

    # ─────────────────────────────────────────────────────────────────
    # 5.2: 도구 이름 비교
    # ─────────────────────────────────────────────────────────────────
    log_substep "5.2: Comparing tool names"

    claude -p "원본과 새 모듈의 도구 이름을 정확히 비교해줘.

작업:
1. 원본 파일에서 모든 도구 이름 추출 (function.name 값)
2. 새 모듈들에서 모든 도구 이름 추출
3. 차이점 찾기:
   - 원본에만 있는 도구
   - 새 모듈에만 있는 도구 (오타 가능성)
   - 이름이 변경된 도구

누락/불일치 발견 시:
- 즉시 수정
- 수정 내용 보고

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 30 \
    2>&1 | tee -a "$LOG_FILE"

    # ─────────────────────────────────────────────────────────────────
    # 5.3: TypeScript 컴파일 검증
    # ─────────────────────────────────────────────────────────────────
    log_substep "5.3: TypeScript compilation check"

    claude -p "새 모듈들의 TypeScript 컴파일을 검증해줘.

작업:
1. npx tsc --noEmit 실행
2. 에러 확인

에러 발견 시:
- 에러 내용 분석
- 즉시 수정
- 수정 후 재컴파일 확인

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 40 \
    2>&1 | tee -a "$LOG_FILE"

    # ─────────────────────────────────────────────────────────────────
    # 5.4: 원본 파일 업데이트
    # ─────────────────────────────────────────────────────────────────
    log_substep "5.4: Update original files to use new modules"

    claude -p "원본 파일들을 새 모듈을 사용하도록 업데이트해줘.

작업:
1. src/tools/office/powerpoint-tools.ts:
   - 기존 코드 제거
   - 새 모듈에서 re-export
   \`\`\`typescript
   export * from './powerpoint-tools/index.js';
   export { POWERPOINT_TOOLS } from './powerpoint-tools/index.js';
   \`\`\`

2. src/tools/office/excel-tools.ts:
   - 동일하게 변경

3. src/tools/office/word-tools.ts:
   - 동일하게 변경

이렇게 하면:
- 기존 import를 사용하는 코드가 계속 동작
- 점진적 마이그레이션 가능

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 30 \
    2>&1 | tee -a "$LOG_FILE"

    # ─────────────────────────────────────────────────────────────────
    # 5.5: 최종 빌드 테스트
    # ─────────────────────────────────────────────────────────────────
    log_substep "5.5: Final build test"

    claude -p "최종 빌드 테스트를 실행해줘.

작업:
1. npm run build 실행
2. 빌드 성공 확인
3. 에러 발생 시 수정

빌드 후:
- dist/ 폴더에 새 모듈들이 있는지 확인
- import 경로가 올바른지 확인

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 30 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Final verification complete"
}

# ============================================================================
# STEP 6: PR 생성
# ============================================================================
create_pr() {
    log_step "6/6: Create Pull Request"

    claude -p "모든 변경사항을 커밋하고 PR을 생성해줘.

작업:
1. git status로 변경사항 확인
2. git add로 새 파일들 스테이징
3. 커밋 메시지:
   \`\`\`
   refactor: Office 도구 모듈화

   - powerpoint-tools.ts를 11개 도메인 모듈로 분리
   - excel-tools.ts를 13개 도메인 모듈로 분리
   - word-tools.ts를 14개 도메인 모듈로 분리
   - 공통 유틸리티 추출 (common/)
   - 기존 import 호환성 유지

   Breaking Changes: None (기존 export 유지)
   \`\`\`

4. git push origin $BRANCH_NAME

5. gh pr create:
   - 제목: refactor: Office 도구 모듈화 (~12,900줄 → 38개 모듈)
   - 본문에 변경 내용 상세 설명
   - 파일 구조 변경 설명
   - 테스트 결과 포함

agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 30 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "PR creation complete"
}

# ============================================================================
# 메인 실행
# ============================================================================
main() {
    echo -e "${MAGENTA}"
    echo "╔════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                        ║"
    echo "║   ██████╗ ███████╗███████╗██╗ ██████╗███████╗                          ║"
    echo "║   ██╔═══██╗██╔════╝██╔════╝██║██╔════╝██╔════╝                          ║"
    echo "║   ██║   ██║█████╗  █████╗  ██║██║     █████╗                            ║"
    echo "║   ██║   ██║██╔══╝  ██╔══╝  ██║██║     ██╔══╝                            ║"
    echo "║   ╚██████╔╝██║     ██║     ██║╚██████╗███████╗                          ║"
    echo "║    ╚═════╝ ╚═╝     ╚═╝     ╚═╝ ╚═════╝╚══════╝                          ║"
    echo "║                                                                        ║"
    echo "║   Office Tools Modularization Script                                   ║"
    echo "║   ~12,900 lines → 38 modules                                           ║"
    echo "║                                                                        ║"
    echo "╚════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log "Starting Office Tools Modularization..."
    log "Log file: $LOG_FILE"
    log "Branch: $BRANCH_NAME"
    echo ""

    # 예상 소요 시간 안내
    log_warning "This process will take a long time (~2-4 hours)"
    log_warning "Each module goes through 3 verification phases"
    echo ""

    # 실행 순서
    setup_branch
    extract_common_utils
    process_powerpoint
    process_excel
    process_word
    final_verification
    create_pr

    echo -e "\n${GREEN}"
    echo "╔════════════════════════════════════════════════════════════════════════╗"
    echo "║                   MODULARIZATION COMPLETE!                             ║"
    echo "╚════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log "Modularization completed successfully!"
    log "Check $LOG_FILE for full details."
    log ""
    log "Summary:"
    log "  - PowerPoint: 11 domain modules"
    log "  - Excel: 13 domain modules"
    log "  - Word: 14 domain modules"
    log "  - Common utilities extracted"
    log ""
    log "Next steps:"
    log "  1. Review the PR"
    log "  2. Run tests if available"
    log "  3. Merge when ready"
}

# 스크립트 실행
main "$@"
