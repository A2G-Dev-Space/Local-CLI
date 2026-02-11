/**
 * Windows/PowerShell Specific Rules
 *
 * Guidelines for operating in the Windows environment with PowerShell.
 * NOTE: This is Electron-specific (NOT bash/WSL)
 *
 * CLI parity: This is Electron-specific - CLI doesn't have windows-rules.ts
 */

/**
 * Windows PowerShell rules - used in all prompts
 */
export const WINDOWS_POWERSHELL_RULES = `
## Windows Environment (PowerShell)

This system runs on **Windows** with **PowerShell** (not bash/WSL).

**Use PowerShell syntax:**
- \`Get-ChildItem\` or \`ls\` for listing files
- \`Set-Location\` or \`cd\` for changing directories
- \`Copy-Item\` or \`cp\` for copying files
- \`Remove-Item\` or \`rm\` for deleting files
- \`Get-Content\` or \`cat\` for reading files
- \`Select-String\` for grep-like searches

**Path format:**
- Use Windows paths: \`C:\\Users\\...\` or \`D:\\Projects\\...\`
- Backslashes or forward slashes both work
- Environment variables: \`$env:USERPROFILE\`, \`$env:APPDATA\`

**Common commands:**
- \`git status\`, \`git add\`, \`git commit\` - Git operations
- \`npm install\`, \`npm run build\` - Node.js operations
- \`python script.py\` - Python execution

**⚠️ curl / wget alias 주의:**
- PowerShell에서 \`curl\`은 \`Invoke-WebRequest\`의 별칭 → curl 옵션(\`-X\`, \`-d\`, \`-H\` 등)이 동작하지 않음
- **반드시 \`curl.exe\`** 사용 (Windows 내장 curl 바이너리 직접 호출)
- \`wget\`도 동일 → **\`wget.exe\`** 사용
- 예: \`curl.exe -X POST https://api.example.com -H "Content-Type: application/json" -d '{"key":"value"}'\`

**⚠️ PowerShell 5.1 제약 (대부분의 기업 PC):**
- \`Invoke-WebRequest -Form\`은 **PowerShell 7+ 전용** → PS 5.1에서 에러
- PS 5.1에서 파일 업로드: \`curl.exe -F "file=@C:\\path\\file.txt" https://...\`
- 한글 파일명이 포함된 경로는 인코딩 문제 발생 가능 → 영문 임시 경로로 복사 후 사용 권장
`.trim();
