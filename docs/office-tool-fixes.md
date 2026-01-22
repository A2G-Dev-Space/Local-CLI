# Office Tool Fixes Guide

이 문서는 Word/PowerPoint COM 자동화에서 발생하는 일반적인 문제와 해결 방법을 정리합니다.

---

## 1. `\n` 줄바꿈 문제 (Word)

### 문제

Word tool에서 `\n`이 줄바꿈으로 변환되지 않고 리터럴 문자열로 출력됨.

예: `"Hello\nWorld"` → Word에 `Hello\nWorld`로 표시 (줄바꿈 없음)

### 원인

- `TypeText()`는 `\n`을 줄바꿈으로 해석하지 않음
- `.Text = ` 할당도 마찬가지

### 해결 방법

#### 방법 1: `TypeText()` + `TypeParagraph()` 분리 (wordWrite)

```typescript
// Split text by \n and generate TypeText + TypeParagraph
const lines = text.split(/\\n|\n/);
const typeCommands = lines.map((line, index) => {
  const escapedLine = line.replace(/'/g, "''").replace(/`/g, '``');
  const isLastLine = index === lines.length - 1;
  if (isLastLine) {
    return `$selection.TypeText('${escapedLine}')`;
  } else {
    return `$selection.TypeText('${escapedLine}')\n$selection.TypeParagraph()`;
  }
}).join('\n');
```

#### 방법 2: PowerShell `-replace`로 변환 (.Text = 할당 시)

```powershell
$headerText = '${escapedText}' -replace '\\\\n', [char]10 -replace '\\n', [char]10
$header.Text = $headerText
```

- `[char]10` = LF (Line Feed) 문자
- 두 패턴 모두 처리해야 다양한 입력 케이스 커버

### 영향 받는 함수들

| 함수 | 해결 방법 |
|-----|---------|
| `wordWrite` | TypeText + TypeParagraph 분리 |
| `wordInsertHeader` | PowerShell -replace |
| `wordInsertFooter` | PowerShell -replace |
| `wordSetTableCell` | PowerShell -replace |
| `wordAddTextbox` | PowerShell -replace |

### 영향 받지 않는 함수들

- `wordCreateBulletList` / `wordCreateNumberedList`: 항목별로 이미 `TypeParagraph()` 호출
- `wordAddBookmark`: 북마크 텍스트는 보통 한 줄
- `wordFindReplace`: 검색/치환은 `\n` 그대로 유지해야 함

---

## 2. 테이블 셀 한글 깨짐 문제 (Word/PowerPoint)

### 문제

`wordAddTable` 또는 `powerpointAddTable`로 테이블을 생성할 때 한글이 깨져서 표시됨.

### 원인

Office COM에서 `Range.Text = '...'` 또는 `TextRange.Text = '...'`로 텍스트를 할당하면 **폰트 설정이 초기화될 수 있음**.

### 해결 방법: TEXT FIRST, FONT AFTER (Microsoft 패턴)

Microsoft의 공식 VBA 문서에서 권장하는 패턴:

```vba
' Microsoft Learn 예제 (TextRange.Text property)
With myDocument.Shapes(1).TextFrame.TextRange
    .Text = "Welcome!"      ' 1. 텍스트 먼저 설정
    .Font.Italic = True     ' 2. 폰트 나중에 설정
End With
```

**참고**: [TextRange.Text property - Microsoft Learn](https://learn.microsoft.com/en-us/office/vba/api/PowerPoint.TextRange.Text)

### 구현 (TypeScript → PowerShell)

```typescript
// CORRECT: Text first, font after (Microsoft pattern)
if (data) {
  const dataLines: string[] = [];
  for (let i = 0; i < data.length && i < rows; i++) {
    const row = data[i];
    if (!row) continue;
    for (let j = 0; j < row.length && j < cols; j++) {
      const cellValue = row[j];
      if (cellValue === undefined) continue;
      const cellHasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(cellValue);
      const val = cellValue.replace(/'/g, "''");
      // 1. Text first
      dataLines.push(`$table.Cell(${i + 1}, ${j + 1}).Range.Text = '${val}'`);
      // 2. Font after (only if Korean)
      if (cellHasKorean) {
        dataLines.push(`$table.Cell(${i + 1}, ${j + 1}).Range.Font.Name = 'Malgun Gothic'`);
      }
    }
  }
  dataScript = dataLines.join('\n');
}
```

### 핵심 원칙

> **텍스트를 먼저 입력하고, 그 다음에 폰트를 설정한다.**
>
> This is Microsoft's official recommended pattern for Office COM automation.

---

## 3. 수정된 함수 목록

### Word (`electron/main/tools/office/word-client.ts`)

| 함수 | `\n` 수정 | 한글 폰트 수정 |
|-----|:-------:|:----------:|
| `wordWrite` | ✅ | ✅ |
| `wordInsertHeader` | ✅ | ✅ |
| `wordInsertFooter` | ✅ | ✅ |
| `wordSetTableCell` | ✅ | ✅ |
| `wordAddTextbox` | ✅ | ✅ |
| `wordAddTable` | N/A | ✅ (text first, font after) |
| `wordCreateBulletList` | N/A | ✅ |
| `wordCreateNumberedList` | N/A | ✅ |

### PowerPoint (`electron/main/tools/office/powerpoint-client.ts`)

| 함수 | 한글 폰트 수정 | 패턴 |
|-----|:----------:|------|
| `powerpointWriteText` | ✅ | text first, font after |
| `powerpointAddTextbox` | ✅ | text first, font after |
| `powerpointAddTable` | ✅ | text first, font after (각 셀별) |
| `powerpointSetTableCell` | ✅ | text first, font after |
| `powerpointAddNote` | ✅ | text first, font after |
| `powerpointSetPlaceholderText` | ✅ | text first, font after |

### CLI 버전 (`src/tools/office/`)

별도 PR에서 수정 예정.

---

## 4. 참고 자료

- [TextRange.Text property - Microsoft Learn](https://learn.microsoft.com/en-us/office/vba/api/PowerPoint.TextRange.Text)
- [Range.Text property (Word) - Microsoft Learn](https://learn.microsoft.com/en-us/office/vba/api/Word.Range.Text)
