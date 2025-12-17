# LOCAL-CLI v2.6.0

[![GitHub release](https://img.shields.io/github/v/release/A2G-Dev-Space/Local-CLI)](https://github.com/A2G-Dev-Space/Local-CLI/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)

**OpenAI-Compatible Local CLI Coding Agent**

> Standalone AI coding agent for local LLM environments.
> Works with vLLM, Ollama, LM Studio, and any OpenAI-compatible API.

---

## Quick Start

```bash
# 1. Install
git clone https://github.com/A2G-Dev-Space/Local-CLI.git
cd Local-CLI
npm install && npm run build

# 2. Run
node dist/cli.js       # or use 'lcli' command after npm link
```

The LLM endpoint setup wizard will automatically run on first launch.

---

## Key Features

### Supervised Mode
Request user approval before executing file modification tools.

```
┌─────────────────────────────────────────────────────────────┐
│  🔧 create_file                                              │
│  ─────────────────────────────────────────────────────────   │
│  📁 file_path: /src/utils/helper.ts                          │
│  📝 content: export function helper() { ... }                │
│  ─────────────────────────────────────────────────────────   │
│  ▸ [1] ✅ Approve                                            │
│    [2] ❌ Reject                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Tab key** - Toggle Auto ↔ Supervised mode
- **Only file modification tools** require approval (read_file, list_files, etc. run automatically)
- **On Reject** - Enter comment → AI retries with feedback

### Plan & Execute Architecture
Automatically breaks down user requests into TODO lists and executes them sequentially.

```
You: Add a logging system to the project

✶ Planning... (esc to interrupt · 5s · ↑ 1.2k tokens)

📋 3 tasks created:
  1. Create logger.ts file
  2. Add logger import to existing files
  3. Apply logger to error handling
```

### Static Log UI
Claude Code-style scrollable log history:
- Tool-specific icons (📖 read, 📝 create, ✏️ edit, 📂 list, 🔍 find, 🔧 bash, 💬 message)
- Diff format for file changes (blue: added, red: deleted)
- Real-time progress display

### LLM Tools
| Tool | Description | Requires Approval |
|------|-------------|-------------------|
| `read_file` | Read file | ❌ |
| `create_file` | Create new file | ✅ |
| `edit_file` | Edit existing file (line-by-line) | ✅ |
| `list_files` | List directory | ❌ |
| `find_files` | Search files (glob pattern) | ❌ |
| `bash` | Execute shell commands (v2.2.0) | ✅ |
| `tell_to_user` | Send message to user | ❌ |
| `ask_user` | Ask user a question | ❌ |

### Slash Commands
| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/clear` | Reset conversation |
| `/compact` | Compress conversation (save context) |
| `/load` | Load saved session |
| `/model` | Switch LLM model |
| `/settings` | Settings menu |
| `/usage` | Token usage statistics |
| `/docs` | Documentation management |

### Keyboard Shortcuts
- `Ctrl+C` - Exit
- `ESC` - Interrupt current execution
- `Tab` - Toggle Auto ↔ Supervised mode
- `@` - File browser
- `/` - Command autocomplete

---

## Main Features

### v2.6.0 New Features

| Feature | Description |
|---------|-------------|
| **Planning-Only Mode** | All requests use TODO-based plan mode (classifier removed) |
| **Simplified TODO** | TodoItem uses `title` only (no `description`) |
| **write_todos Tool** | Claude Code style - replaces entire TODO list (replaces `update-todo-list`, `get-todo-list`) |
| **tell_to_user First** | LLM must communicate results via `tell_to_user` before calling `write_todos` |

### v2.5.x Features

| Feature | Description |
|---------|-------------|
| **--eval mode** | Evaluation mode for Python automation tests (stdin JSON → stdout NDJSON) |
| **Python Tests** | pytest-based test suite (`npm run test`) |
| **NDJSON Event Stream** | start, tool_call, tool_result, response, end events |

```bash
# --eval mode usage
echo '{"prompt": "1+1은?"}' | lcli --eval

# Run Python tests
npm run test        # Full test
npm run test:quick  # Quick test
```

### v2.4.x New Features

| Feature | Description |
|---------|-------------|
| **Markdown Rendering** | Assistant responses render markdown (bold, italic, code blocks, lists) in CLI |
| **LLM-based Docs Search** | Intelligent documentation search - LLM decides when to search based on folder structure |
| **Hierarchical Docs Navigation** | New docs search agent with folder-based navigation |
| **Docs Search Progress UI** | Real-time progress display during documentation search |
| **Centralized Prompts** | All prompts moved to `src/prompts/` |
| **Restructured Agents** | Agents reorganized under `src/agents/` |

### v2.2.0 New Features

| Feature | Description |
|---------|-------------|
| **Unified Execution Loop** | Planning and Direct mode now share the same execution pattern |
| **TODO Context Injection** | TODO state injected per-invoke, not stored in history (prevents context pollution) |
| **Bash Tool** | Execute shell commands (git, npm, build, test) with security validation |
| **Language Priority** | AI responds in the same language as user input (Korean → Korean, English → English) |
| **Auto-Compact Enhancement** | Preserves last 2 messages when compacting for better continuity |
| **Error Retry** | Auto-retry failed tool calls up to 3 times before giving up |

### Supervised Mode
- Request user approval before file modification
- Toggle Auto/Supervised mode with Tab key
- Provide feedback via comments on Reject

### Session Management
- Auto-save/restore conversation history between TODO tasks
- Preserve full context including tool calls/responses
- History only resets on `/compact`

### Context Usage Display
- Status bar shows `Context (1.3K / 13%)` format
- Auto-Compact runs automatically at 80% usage

### Single Tool Execution
- `parallel_tool_calls: false` API parameter enforced
- LLM calls only one tool at a time for stable execution

---

## Configuration

### Add LLM Endpoint

```bash
# Run setup wizard
lcli    # First run auto-launches wizard

# Or via settings
/settings
```

Compatible with any OpenAI-compatible API server:
- vLLM, Ollama, LM Studio
- Azure OpenAI, Google Gemini (OpenAI Compatible)
- Internal LLM servers

### CLI Options

```bash
lcli              # Default run
lcli --verbose    # Verbose logging
lcli --debug      # Debug mode
```

---

## Directory Structure

```
~/.local-cli/
├── config.json        # Configuration file
├── endpoints.json     # Endpoint settings
├── usage.json         # Usage statistics
├── docs/              # Downloaded docs
└── projects/          # Project-specific sessions
```

---

## Requirements

- Node.js v20+
- npm v10+
- Git (for doc downloads)

---

## Documentation

- [Developer Guide](docs/01_DEVELOPMENT.md)
- [Logging System](docs/02_LOGGING.md)
- [Testing Guide](docs/03_TESTING.md)
- [Roadmap](docs/04_ROADMAP.md)

---

## License

MIT License

---

## Keywords

`AI coding assistant` `local LLM` `offline AI` `CLI tool` `vLLM` `Ollama` `LM Studio` `OpenAI compatible` `code generation` `developer tools` `TypeScript` `Node.js` `coding agent`

---

**GitHub**: https://github.com/A2G-Dev-Space/Local-CLI
