# LOCAL-CLI

[![GitHub release](https://img.shields.io/github/v/release/A2G-Dev-Space/Local-CLI)](https://github.com/A2G-Dev-Space/Local-CLI/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)

**OpenAI-Compatible CLI Coding Agent for Local & On-Prem LLM Environments**

> Use your own LLM (vLLM, Ollama, LM Studio, Azure OpenAI, or any OpenAI-compatible API) as a full coding agent - no cloud dependency, no API key costs.

https://github.com/user-attachments/assets/77cc96c9-cb22-4411-8744-3a006b00c580

---

## Why LOCAL-CLI?

| Benefit | Description |
|---------|-------------|
| **Zero Cloud Dependency** | Runs entirely on your local/on-prem LLM. Your code never leaves your network. |
| **No API Cost** | Use open-source models (Llama, Qwen, DeepSeek, etc.) for free. |
| **Any OpenAI-Compatible API** | Works with vLLM, Ollama, LM Studio, Azure OpenAI, Google Gemini, and more. |
| **Autonomous Coding Agent** | Reads, searches, edits, and creates code files - not just chat. |
| **Plan & Execute** | Breaks complex tasks into TODO steps and executes them sequentially. |
| **Safe by Default** | Supervised mode requires your approval before any file modification. |
| **Desktop GUI (Electron)** | Dual-window desktop app with chat + real-time task monitoring. |
| **Vision Model Support** | Analyze images and screenshots with Vision Language Models. |
| **Office Automation** | Control Excel, Word, PowerPoint directly via PowerShell/COM (Windows). |
| **Browser Automation** | Chrome/Edge CDP control - navigate, click, screenshot, scrape data. |

---

## Quick Start

### CLI (Terminal)

```bash
# 1. Clone & Build
git clone https://github.com/A2G-Dev-Space/Local-CLI.git
cd Local-CLI
npm install && npm run build

# 2. Run
node dist/cli.js       # or use 'lcli' after npm link
```

The endpoint setup wizard launches automatically on first run.

### Desktop App (Electron)

Download the latest portable `.exe` from the [Releases](https://github.com/A2G-Dev-Space/Local-CLI/releases) page - no installation required.

---

## Key Features

### Dual-Window Desktop App

The Electron desktop app provides a **Chat Window** and a separate **Task Popup** for real-time TODO monitoring:

- **Chat Window** - Full-featured chat UI with markdown rendering, code syntax highlighting, and file diff viewer
- **Task Popup** - Always-on-top TODO tracker showing current progress, execution status, and tool activity
- **"Waiting for user input"** indicator when the agent needs your response
- **Taskbar flashing** when tasks complete or user input is needed (even when minimized)
- **Auto-expanding input** - Text area grows dynamically up to half the screen height
- **Table paste** - Paste tables from Excel/web and they convert to markdown automatically
- **Image paste** - Paste or attach images for Vision model analysis
- **Per-model selection** - Choose different models for Planning and Execution independently
- **Last folder restore** - Reopens the last working directory on app restart
- **VSCode diff toggle** - Persistent setting for automatic file diff viewing

### Plan & Execute

Automatically decomposes requests into TODO steps and executes them:

```
You: Add a logging system to the project

TODO List                            1/3
  [x] Create logger.ts
  [ ] Add imports to existing code
  [ ] Apply error handling
```

### Vision Language Model (VLM)

Analyze images and screenshots directly from the chat:

- Enable via `/settings` > Vision Model toggle
- Use `read_image` tool to analyze screenshots, diagrams, and UI mockups
- Supports any OpenAI-compatible Vision endpoint
- Automatic screenshot verification for execution results

### Supervised Mode

Every file modification requires your explicit approval:

- **Tab** to toggle between Auto / Supervised mode
- Only file modification tools need approval (read/search are always allowed)
- Reject with feedback to guide the agent's next attempt

### Office Automation (60+ Tools)

| App | Capabilities |
|-----|-------------|
| **Excel** | Read/write cells, create charts, formatting, conditional formatting, pivot tables, formulas |
| **Word** | Write text, headers, tables, images, footnotes, find/replace, styles, TOC |
| **PowerPoint** | Create slides, add text/images/shapes, apply themes, speaker notes |

### Browser Automation

- Navigate pages, click elements, fill forms
- Take screenshots, extract text
- No external server required (Chrome DevTools Protocol)

### LLM Compatibility

Works well even with smaller/weaker open-source models:

- **Schema pre-validation** - Fixes malformed tool calls before execution
- **Smart retry** - Automatically retries on transient LLM errors with context
- **Loop detection** - Breaks out of repetitive tool call cycles
- **Tool name sanitization** - Handles special token contamination in tool names
- **Prompt repetition** - Reinforces critical instructions for models that forget context

### Session Management

- Save and restore conversation history
- Auto-context compression at 80% capacity with TODO preservation
- Resume work exactly where you left off

---

## Commands & Shortcuts

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Help |
| `/clear` | Reset conversation |
| `/compact` | Compress conversation |
| `/load` | Load saved session |
| `/model` | Switch model |
| `/settings` | Settings menu |
| `/usage` | Token usage |
| `/docs` | Docs management |
| `/tool` | Toggle optional tools (browser/office) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+C` | Exit |
| `ESC` | Interrupt current task |
| `Tab` | Toggle Auto / Supervised |
| `@` | File browser |
| `/` | Command autocomplete |

---

## Configuration

```bash
lcli            # Setup wizard on first run
/settings       # Settings menu while running
```

Any OpenAI-compatible API works:
vLLM, Ollama, LM Studio, Azure OpenAI, Google Gemini, or internal LLM servers.

---

## Requirements

- Node.js v20+
- npm v10+
- Git
- Windows (for Office/Browser automation via PowerShell)

---

## Changelog (since v4.0.7)

### v4.5.1
- Fix: Electron shutdown crash (write-after-end)
- Fix: Planning LLM tool_choice fallback for unsupported models
- Fix: Electron chatCompletion response validation crash

### v4.5.0
- Electron: 6 UX improvements (ask_to_user waiting indicator, taskbar flash, auto-expanding input, VSCode diff persistence, table paste, image paste)
- Enhanced Planning/Execution prompts + GPT-OSS reasoning_effort support
- Execution result verification rules with Vision screenshot verification
- Auto-compact parity between CLI and Electron (TODO preservation)
- Screenshot save path migrated to working directory

### v4.4.0
- Per-model selection for Planning and Execution LLMs
- Last opened folder restoration on app restart
- Error telemetry system (ErrorReporter)
- Excel write_range bug fix (#N/A values)
- Excel tool parameter validation + trim handling

### v4.3.0
- Vision Language Model (VLM) support with read_image tool
- Settings UI Vision toggle
- Schema pre-validation + Prompt repetition for weaker LLMs
- Office COM DisplayAlerts auto-suppression
- Office COM Visible always-on + Electron Launch method

### v4.2.0
- Electron Dual-window UI (Chat + Task popup) - major UI refactoring
- LLM message structure improvement (XML-based History/Request separation)
- Smart retry + loop detection for LLM robustness
- Tool name sanitization (special token contamination defense)
- edit_file CRLF/LF normalization for Windows files
- PowerShell curl/wget alias auto-substitution
- Supervised Mode bug fixes + escape character handling

### v4.1.5 - v4.1.7
- UI/UX improvements and docs-search disable
- Planning LLM infinite loop fix (askUser callback)
- 3-second delay + Supervised Mode fixes + model selection bug fix

---

## Documentation

- [Developer Guide](docs/01_DEVELOPMENT.md)
- [Logging System](docs/02_LOGGING.md)
- [Testing Guide](docs/03_TESTING.md)
- [Roadmap](docs/04_ROADMAP.md)

---

## Contact

Email: **gkstdmgk2731@naver.com**

---

## License

MIT License

**GitHub**: https://github.com/A2G-Dev-Space/Local-CLI
