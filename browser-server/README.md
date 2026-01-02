# Browser Automation Server

Flask-based HTTP server that provides Selenium automation for Chrome/Edge browsers.
Designed to run on Windows and be called from WSL.

## Requirements

- Windows 10/11
- Google Chrome or Microsoft Edge
- Python 3.10+ (for building from source)

## Quick Start (Pre-built .exe)

```bash
# Run the server
browser-server.exe --port 8766

# Test health endpoint
curl http://localhost:8766/health
```

## Building from Source

```bash
# Install dependencies
pip install -r requirements.txt

# Build .exe
python build.py

# Output: dist/browser-server.exe
```

## API Endpoints

### Health Check

```bash
GET /health
# Returns server status and browser availability
```

### Browser Control

```bash
POST /browser/launch        # Launch browser: {"headless": false, "browser": "chrome"}
POST /browser/close         # Close browser
POST /browser/navigate      # Navigate: {"url": "https://example.com"}
GET  /browser/screenshot    # Take screenshot (query: ?full_page=true)
POST /browser/click         # Click element: {"selector": "#submit-btn"}
POST /browser/fill          # Fill field: {"selector": "input[name=email]", "value": "test@example.com"}
POST /browser/get_text      # Get text: {"selector": ".message"}
GET  /browser/get_info      # Get page info (URL, title)
GET  /browser/get_html      # Get page HTML source
POST /browser/execute_script# Run JS: {"script": "return document.title"}
GET  /browser/get_console   # Get console logs
GET  /browser/get_network   # Get network request logs
POST /browser/wait_for      # Wait for element: {"selector": "#loaded", "timeout": 10}
POST /browser/focus         # Bring browser window to foreground
```

## Example Usage

### Basic Web Testing

```bash
# Launch browser
curl -X POST http://localhost:8766/browser/launch \
  -H "Content-Type: application/json" \
  -d '{"headless": false, "browser": "chrome"}'

# Navigate to page
curl -X POST http://localhost:8766/browser/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:3000"}'

# Take screenshot
curl http://localhost:8766/browser/screenshot

# Click a button
curl -X POST http://localhost:8766/browser/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "button[type=submit]"}'

# Fill a form field
curl -X POST http://localhost:8766/browser/fill \
  -H "Content-Type: application/json" \
  -d '{"selector": "input[name=email]", "value": "test@example.com"}'

# Close browser
curl -X POST http://localhost:8766/browser/close
```

## Screenshot Response Format

Screenshot endpoint returns base64-encoded PNG images:

```json
{
  "success": true,
  "message": "Screenshot captured",
  "image": "iVBORw0KGgoAAAANSUhEUgAA...",
  "format": "png",
  "encoding": "base64",
  "url": "https://example.com",
  "title": "Example Domain"
}
```

## Integration with Nexus Coder

This server is designed to work with the Nexus Coder browser tools:

1. Start the server on Windows: `browser-server.exe`
2. Nexus Coder (in WSL) will connect via HTTP API
3. Browser automation runs on Windows Chrome/Edge

## Troubleshooting

### "No browser found"

Make sure either Chrome or Edge is installed:
- Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Edge: `C:\Program Files\Microsoft\Edge\Application\msedge.exe`

### WebDriver issues

The server uses `webdriver-manager` to automatically download the correct driver.
If you have issues, try:

```bash
pip install --upgrade webdriver-manager selenium
```

### Firewall issues

If WSL can't connect to the Windows server:
1. Run the server with `--host 0.0.0.0`
2. Allow inbound connections on port 8766 in Windows Firewall

## License

MIT
