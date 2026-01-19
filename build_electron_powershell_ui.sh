#!/bin/bash

# ============================================================================
# Nexus Coder - Electron PowerShell UI 자동화 빌드 스크립트
#
# 요구사항:
# 1. main latest에서 신규 branch 생성
# 2. Electron 기반 PowerShell UI (모던 디자인, 파일 열기)
# 3. 파일 edit + assistant 대화
# 4. 새 폴더 열면 경로 기반 CLI 재시작
# 5. slash 기능 아이콘 클릭 UI/UX
# 6. 크기 조절 가능한 반응형 디자인
# 7. 디버깅 가능한 로깅 시스템
# 8. Electron debug 모드 검증
# 9. 버그/에러 exception 처리 확인
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
LOG_FILE="electron_build_${TIMESTAMP}.log"
BRANCH_NAME="feat/electron-powershell-ui"

# 로깅 함수
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

# ============================================================================
# STEP 1: Git 브랜치 설정
# ============================================================================
setup_branch() {
    log_step "1/9: Git Branch Setup"

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
# STEP 2: Electron 기본 구조 및 의존성 설정
# ============================================================================
setup_electron_base() {
    log_step "2/9: Electron Base Setup & Dependencies"

    claude -p "Electron 기반 PowerShell UI를 위한 기본 구조를 설정해줘.

해야 할 작업:
1. package.json 업데이트:
   - electron, electron-builder 의존성 추가
   - electron-forge 또는 vite-plugin-electron 추가
   - 스크립트 추가: electron:dev, electron:build, electron:debug

2. electron/ 폴더 구조 생성:
   - electron/main/index.ts (메인 프로세스)
   - electron/preload/index.ts (프리로드 스크립트)
   - electron/renderer/ (렌더러 - React)

3. TypeScript 설정:
   - tsconfig.electron.json 생성
   - 타입 정의 추가

4. Vite 설정 (electron-vite 또는 vite-plugin-electron):
   - vite.config.ts 업데이트 또는 생성
   - 빌드 설정 최적화

중요:
- 기존 CLI 코드와 공존할 수 있도록 설정
- Windows PowerShell 환경 고려
- agent 사용 금지, 직접 작업" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 40 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Electron base setup complete"
}

# ============================================================================
# STEP 3: 메인 프로세스 구현 (PowerShell 통합)
# ============================================================================
implement_main_process() {
    log_step "3/9: Main Process with PowerShell Integration"

    claude -p "Electron 메인 프로세스를 구현해줘. PowerShell 통합 포함.

구현 항목:

1. electron/main/index.ts 완성:
   - BrowserWindow 생성 (모던한 프레임리스 디자인)
   - 커스텀 타이틀바 지원
   - 크기 조절/최소화/최대화/닫기 버튼
   - 다크/라이트 테마 지원

2. PowerShell 통합:
   - electron/main/powershell-manager.ts 생성
   - PowerShell 프로세스 생성/관리
   - 명령어 실행 및 결과 수신
   - 스트리밍 출력 지원
   - 에러 핸들링

3. IPC 통신:
   - electron/main/ipc-handlers.ts
   - 파일 열기/저장 다이얼로그
   - 폴더 선택 다이얼로그
   - CLI 재시작 기능
   - 현재 작업 디렉토리 변경

4. 로깅 시스템:
   - electron/main/logger.ts
   - 로그 파일 저장 (날짜별)
   - 로그 레벨 설정
   - 로그 파일 열기/다운로드 기능

5. 에러 핸들링:
   - 전역 에러 핸들러
   - 크래시 리포터 설정
   - uncaughtException 처리

중요:
- Windows 환경 최적화
- 보안 best practices (contextIsolation, sandbox)
- agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 50 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Main process implementation complete"
}

# ============================================================================
# STEP 4: 렌더러 프로세스 UI 구현 (모던 디자인)
# ============================================================================
implement_renderer_ui() {
    log_step "4/9: Renderer UI Implementation (Modern Design)"

    claude -p "Electron 렌더러 프로세스 UI를 구현해줘. 모던하고 전문적인 디자인으로.

구현 항목:

1. 전체 레이아웃 (electron/renderer/):
   - App.tsx: 메인 레이아웃 컴포넌트
   - 커스텀 타이틀바
   - 사이드바 (토글 가능)
   - 메인 컨텐츠 영역
   - 상태바

2. 파일 탐색기 컴포넌트:
   - components/FileExplorer.tsx
   - 트리 뷰 형태의 파일/폴더 탐색
   - 파일 아이콘 (확장자별)
   - 우클릭 컨텍스트 메뉴
   - 드래그 앤 드롭 지원

3. 에디터 컴포넌트:
   - components/Editor.tsx
   - Monaco Editor 또는 CodeMirror 통합
   - 구문 강조
   - 줄 번호
   - 미니맵
   - 탭 기반 다중 파일 편집

4. 터미널/채팅 영역:
   - components/Terminal.tsx
   - PowerShell 출력 표시
   - 스크롤 가능
   - ANSI 색상 지원

   - components/ChatPanel.tsx
   - Assistant와 대화
   - 마크다운 렌더링
   - 코드 블록 복사 기능

5. 스타일링:
   - styles/global.css
   - CSS 변수 기반 테마 시스템
   - 다크/라이트 모드
   - 부드러운 애니메이션
   - 그림자 및 글래스모피즘 효과

디자인 요구사항:
- 모던하고 미니멀한 디자인
- VS Code 스타일 참고
- 색상: 딥 블루/퍼플 그라데이션 액센트
- 폰트: Inter, JetBrains Mono (코드용)
- agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 60 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Renderer UI implementation complete"
}

# ============================================================================
# STEP 5: Slash 커맨드 아이콘 UI 구현
# ============================================================================
implement_slash_commands_ui() {
    log_step "5/9: Slash Commands Icon-based UI"

    claude -p "Slash 커맨드들을 아이콘 클릭 기반 UI로 구현해줘.

기존 slash 커맨드 확인:
- src/core/slash-command-handler.ts 파일 읽어서 현재 slash 커맨드 목록 파악

구현 항목:

1. 커맨드 팔레트:
   - components/CommandPalette.tsx
   - Ctrl+Shift+P 또는 F1으로 열기
   - 검색 가능한 커맨드 목록
   - 최근 사용 커맨드 표시

2. 툴바 구현:
   - components/Toolbar.tsx
   - 주요 커맨드 아이콘 버튼
   - 툴팁 표시
   - 단축키 힌트

3. 사이드바 액션:
   - components/SidebarActions.tsx
   - 파일 작업 (새 파일, 열기, 저장)
   - Git 작업 (커밋, 푸시, 풀)
   - 검색 기능
   - 설정

4. 플로팅 액션 버튼:
   - components/FloatingActions.tsx
   - 우측 하단 플로팅 버튼
   - 빠른 액션 메뉴
   - 애니메이션 효과

5. 아이콘 시스템:
   - Lucide React 또는 Heroicons 사용
   - 일관된 아이콘 크기 및 스타일
   - 호버/클릭 상태 피드백

각 slash 커맨드에 대해:
- /help → 도움말 아이콘
- /clear → 새로고침 아이콘
- /settings → 설정 아이콘
- /model → AI 모델 아이콘
- 기타 커맨드들도 적절한 아이콘 매핑

중요:
- 키보드 단축키도 함께 지원
- 접근성 (ARIA 속성)
- agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 50 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Slash commands UI implementation complete"
}

# ============================================================================
# STEP 6: 반응형 디자인 및 크기 조절
# ============================================================================
implement_responsive_design() {
    log_step "6/9: Responsive Design & Resizable Panels"

    claude -p "반응형 디자인과 크기 조절 가능한 패널을 구현해줘.

구현 항목:

1. 리사이즈 가능한 패널:
   - components/ResizablePanel.tsx
   - 드래그로 패널 크기 조절
   - 최소/최대 크기 제한
   - 더블클릭으로 기본 크기 복원
   - 패널 접기/펼치기

2. 레이아웃 시스템:
   - hooks/useResizable.ts
   - 패널 크기 상태 관리
   - localStorage에 크기 저장
   - 창 크기 변경 시 비율 유지

3. 반응형 브레이크포인트:
   - 작은 창: 사이드바 자동 숨김
   - 중간 창: 기본 레이아웃
   - 큰 창: 확장 레이아웃

4. 분할 뷰:
   - components/SplitView.tsx
   - 가로/세로 분할
   - 다중 분할 지원
   - 분할 비율 저장

5. 창 상태 관리:
   - 창 크기/위치 저장
   - 최대화 상태 기억
   - 멀티 모니터 지원

6. CSS 구현:
   - Flexbox/Grid 기반 레이아웃
   - CSS 변수로 크기 관리
   - 부드러운 전환 애니메이션

중요:
- 성능 최적화 (리사이즈 시 60fps)
- 터치 디바이스 지원 고려
- agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 40 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Responsive design implementation complete"
}

# ============================================================================
# STEP 7: 로깅 시스템 검증 및 UI
# ============================================================================
implement_logging_system() {
    log_step "7/9: Logging System Verification & UI"

    claude -p "로깅 시스템을 검증하고 로그 뷰어 UI를 구현해줘.

검증 항목:

1. 기존 로거 확인:
   - src/utils/logger.ts 읽기
   - 현재 로깅 방식 파악
   - 로그 레벨 확인

2. Electron용 로거 확장:
   - electron/main/logger.ts
   - 파일 로깅 (electron-log 또는 winston)
   - 날짜별 로그 파일 로테이션
   - 로그 레벨: debug, info, warn, error
   - 메인/렌더러 프로세스 구분

3. 로그 뷰어 UI:
   - components/LogViewer.tsx
   - 실시간 로그 스트리밍
   - 로그 레벨별 필터링
   - 검색 기능
   - 타임스탬프 표시
   - 색상 구분 (레벨별)

4. 로그 관리 기능:
   - 로그 파일 목록 보기
   - 로그 파일 열기
   - 로그 파일 다운로드
   - 로그 파일 삭제
   - 로그 폴더 열기

5. 개발자 도구:
   - Ctrl+Shift+I로 DevTools 열기
   - 콘솔 로그 연동
   - 성능 모니터링

중요:
- Linux CLI 스타일 디버깅 가능하게
- 로그 문서 형식 준수
- agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 40 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Logging system implementation complete"
}

# ============================================================================
# STEP 8: Electron Debug 모드 검증
# ============================================================================
verify_electron_debug() {
    log_step "8/9: Electron Debug Mode Verification"

    claude -p "Electron 앱을 debug 모드로 실행하고 문제가 없는지 검증해줘.

검증 항목:

1. 빌드 및 실행:
   - npm install 실행
   - npm run electron:dev 실행 (또는 해당 스크립트)
   - 빌드 에러 확인 및 수정

2. 런타임 검증:
   - 앱이 정상적으로 시작되는지
   - 창이 올바르게 표시되는지
   - DevTools에서 에러가 없는지
   - 콘솔 경고 확인

3. 기능 테스트:
   - 파일 열기/저장 동작
   - PowerShell 명령 실행
   - 폴더 변경 및 CLI 재시작
   - Slash 커맨드 동작
   - 패널 리사이즈

4. 메모리/성능:
   - 메모리 누수 확인
   - CPU 사용량 확인
   - 렌더링 성능

5. 에러 수정:
   - 발견된 에러 즉시 수정
   - TypeScript 에러 해결
   - 런타임 에러 해결

중요:
- 모든 에러를 해결할 때까지 반복
- 문제 발생 시 상세히 보고
- agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 60 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Electron debug verification complete"
}

# ============================================================================
# STEP 9: 에러 및 Exception 처리 최종 검증
# ============================================================================
verify_error_handling() {
    log_step "9/9: Error & Exception Handling Final Verification"

    claude -p "모든 에러와 exception 처리가 완벽한지 최종 검증해줘.

검증 항목:

1. 에러 경계 (Error Boundaries):
   - React Error Boundary 구현 확인
   - 에러 발생 시 폴백 UI 표시
   - 에러 리포팅

2. Try-Catch 블록:
   - 모든 비동기 작업에 try-catch
   - IPC 통신 에러 처리
   - 파일 시스템 에러 처리
   - PowerShell 에러 처리

3. 전역 에러 핸들러:
   - process.on('uncaughtException')
   - process.on('unhandledRejection')
   - window.onerror
   - window.onunhandledrejection

4. 사용자 피드백:
   - 에러 토스트/알림
   - 상세 에러 메시지
   - 복구 옵션 제공

5. 로깅:
   - 모든 에러가 로그에 기록되는지
   - 스택 트레이스 포함
   - 컨텍스트 정보 포함

6. 엣지 케이스:
   - 파일이 없을 때
   - 권한이 없을 때
   - 네트워크 오류
   - PowerShell 실행 실패

7. TypeScript 검증:
   - tsc --noEmit 실행
   - 타입 에러 확인 및 수정
   - strict 모드 준수

8. ESLint 검증:
   - npm run lint 실행
   - 경고/에러 확인 및 수정

누락된 에러 처리가 있으면 즉시 추가해줘.
agent 사용 금지" \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 50 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Error handling verification complete"
}

# ============================================================================
# 최종 정리 및 커밋
# ============================================================================
finalize() {
    log_step "Finalizing: Commit & Summary"

    claude -p "모든 작업이 완료되었습니다. 최종 정리를 해주세요.

1. 모든 변경사항 확인:
   - git status로 변경된 파일 목록 확인
   - 불필요한 파일 정리 (.gitignore 업데이트 필요시)

2. 빌드 테스트:
   - npm run build (기존 CLI)
   - npm run electron:build (새 Electron 앱)

3. README 업데이트:
   - Electron 앱 실행 방법 추가
   - 새로운 기능 설명
   - 단축키 목록

4. 변경사항 커밋:
   - 의미 있는 커밋 메시지로 커밋
   - feat: Add Electron PowerShell UI

최종 상태를 보고해주세요." \
    --verbose --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 30 \
    2>&1 | tee -a "$LOG_FILE"

    log_success "Finalization complete"
}

# ============================================================================
# 메인 실행
# ============================================================================
main() {
    echo -e "${MAGENTA}"
    echo "╔════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                        ║"
    echo "║   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗                          ║"
    echo "║   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝                          ║"
    echo "║   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗                          ║"
    echo "║   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║                          ║"
    echo "║   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║                          ║"
    echo "║   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝                          ║"
    echo "║                                                                        ║"
    echo "║   Electron PowerShell UI Builder                                       ║"
    echo "║   Automated Build Script v1.0                                          ║"
    echo "║                                                                        ║"
    echo "╚════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log "Starting Electron PowerShell UI Build..."
    log "Log file: $LOG_FILE"
    log "Branch: $BRANCH_NAME"
    echo ""

    # 실행 순서
    setup_branch
    setup_electron_base
    implement_main_process
    implement_renderer_ui
    implement_slash_commands_ui
    implement_responsive_design
    implement_logging_system
    verify_electron_debug
    verify_error_handling
    finalize

    echo -e "\n${GREEN}"
    echo "╔════════════════════════════════════════════════════════════════════════╗"
    echo "║                     BUILD COMPLETE!                                    ║"
    echo "╚════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log "Build completed successfully!"
    log "Check $LOG_FILE for full details."
    log ""
    log "Next steps:"
    log "  1. Review the changes: git diff"
    log "  2. Test the Electron app: npm run electron:dev"
    log "  3. Create a PR when ready"
}

# 스크립트 실행
main "$@"
