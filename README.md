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
| **Desktop GUI (Electron)** | Full-featured desktop app with chat UI, session browser, and log viewer. |
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

### Plan & Execute
Automatically decomposes requests into TODO steps and executes them:

```
You: Add a logging system to the project

TODO List                            1/3
  [x] Create logger.ts
  [ ] Add imports to existing code
  [ ] Apply error handling
```

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

### Session Management
- Save and restore conversation history
- Auto-context compression at 80% capacity
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
