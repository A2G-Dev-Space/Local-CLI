# WSL 네트워크 설정

::: danger WSL 사용자 필수 설정
WSL에서 Browser Tools 또는 Office Tools를 사용하려면 **mirrored networking mode** 설정이 필요합니다.
:::

## 왜 필요한가요?

Nexus Coder는 WSL(Linux)에서 실행되지만, Browser와 Office 자동화는 Windows에서 실행됩니다.
WSL과 Windows 간 통신을 위해 mirrored networking mode가 필요합니다.

```
WSL (Nexus Coder) ←→ HTTP API ←→ Windows (.exe 서버) ←→ Chrome/Office
```

::: warning 한 번만 설정하면 됩니다
이 설정은 최초 1회만 하면 됩니다. Browser와 Office 모두 동일한 설정을 사용합니다.
:::

---

## 설정 방법

### Step 1. PowerShell 열기

1. Windows 키를 누릅니다
2. `powershell` 입력
3. **"Windows PowerShell"** 클릭 (관리자 권한 불필요)

### Step 2. 사용자 폴더로 이동

PowerShell에서 다음 명령어 입력:

```powershell
cd $env:USERPROFILE
```

### Step 3. .wslconfig 파일 생성

다음 명령어를 **그대로 복사해서** 붙여넣기:

```powershell
@"
[wsl2]
networkingMode=mirrored
"@ | Out-File -FilePath .wslconfig -Encoding ASCII
```

::: tip 이미 .wslconfig 파일이 있다면?
메모장으로 열어서 `[wsl2]` 섹션에 `networkingMode=mirrored` 줄을 추가하세요:
```powershell
notepad .wslconfig
```
:::

### Step 4. WSL 재시작

같은 PowerShell 창에서:

```powershell
wsl --shutdown
```

### Step 5. WSL 다시 열기

1. Windows 터미널 또는 Ubuntu 앱을 실행
2. nexus 실행 후 `/tool`에서 도구 활성화

---

## 설정 확인 방법

WSL 터미널에서 다음 명령어로 확인:

```bash
cat /proc/sys/kernel/osrelease
# 출력에 "mirrored" 또는 버전 6.x 이상이면 OK
```

---

## Windows 보안 경고

::: danger 반드시 "허용" 클릭 필요
Browser 또는 Office 도구를 **처음 활성화하면 Windows 보안 경고**가 표시됩니다.

**반드시 "허용" 버튼을 클릭해야 정상 작동합니다!**

이 경고는 `browser-server.exe` 또는 `office-server.exe`가 네트워크 통신을 시도하기 때문에 발생합니다.
허용하지 않으면 WSL에서 Windows 서버에 연결할 수 없습니다.
:::

---

## 문제 해결

### "Server not responding" 오류

1. WSL mirrored mode 설정 확인
2. Windows 보안 경고에서 "허용" 클릭했는지 확인
3. Windows 방화벽에서 포트 허용 (Browser: 8766, Office: 8765)

### 설정 후에도 연결 안됨

WSL을 완전히 재시작해보세요:

```powershell
# PowerShell에서
wsl --shutdown
# 그 후 WSL 다시 실행
```
