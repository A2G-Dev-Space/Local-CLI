# Office Automation Server

Flask-based HTTP server that provides COM automation for Microsoft Office applications (Word, Excel, PowerPoint).

## Requirements

- Windows 10/11
- Microsoft Office (Word, Excel, PowerPoint)
- Python 3.10+ (for building from source)

## Quick Start (Pre-built .exe)

```bash
# Run the server
office-server.exe --port 8765

# Test health endpoint
curl http://localhost:8765/health
```

## Building from Source

```bash
# Install dependencies
pip install -r requirements.txt

# Build .exe
python build.py

# Output: dist/office-server.exe
```

## API Endpoints

### Health Check

```bash
GET /health
# Returns server status and active Office applications
```

### Microsoft Word

```bash
POST /word/launch          # Launch Word
POST /word/create          # Create new document
POST /word/write           # Write text: {"text": "Hello World"}
GET  /word/read            # Read document content
POST /word/save            # Save: {"path": "C:\\doc.docx"} (optional)
GET  /word/screenshot      # Capture Word window screenshot
POST /word/close           # Close Word: {"save": true/false}
```

### Microsoft Excel

```bash
POST /excel/launch         # Launch Excel
POST /excel/create         # Create new workbook
POST /excel/write_cell     # Write cell: {"cell": "A1", "value": "Hello"}
POST /excel/read_cell      # Read cell: {"cell": "A1"}
POST /excel/write_range    # Write range: {"start_cell": "A1", "values": [[1,2],[3,4]]}
POST /excel/read_range     # Read range: {"range": "A1:B2"}
POST /excel/save           # Save: {"path": "C:\\data.xlsx"} (optional)
GET  /excel/screenshot     # Capture Excel window screenshot
POST /excel/close          # Close Excel: {"save": true/false}
```

### Microsoft PowerPoint

```bash
POST /powerpoint/launch    # Launch PowerPoint
POST /powerpoint/create    # Create new presentation
POST /powerpoint/add_slide # Add slide: {"layout": 1}
POST /powerpoint/write_text# Write text: {"slide": 1, "shape": 1, "text": "Title"}
POST /powerpoint/read_slide# Read slide: {"slide": 1}
POST /powerpoint/save      # Save: {"path": "C:\\pres.pptx"} (optional)
GET  /powerpoint/screenshot# Capture PowerPoint window screenshot
POST /powerpoint/close     # Close PowerPoint: {"save": true/false}
```

## Example Usage

### Create Excel Report

```bash
# Launch Excel
curl -X POST http://localhost:8765/excel/launch

# Write header
curl -X POST http://localhost:8765/excel/write_range \
  -H "Content-Type: application/json" \
  -d '{"start_cell": "A1", "values": [["Name", "Sales", "Region"]]}'

# Write data
curl -X POST http://localhost:8765/excel/write_range \
  -H "Content-Type: application/json" \
  -d '{"start_cell": "A2", "values": [["John", 1000, "East"], ["Jane", 1500, "West"]]}'

# Take screenshot
curl http://localhost:8765/excel/screenshot

# Save and close
curl -X POST http://localhost:8765/excel/save \
  -H "Content-Type: application/json" \
  -d '{"path": "C:\\Users\\user\\Desktop\\report.xlsx"}'

curl -X POST http://localhost:8765/excel/close
```

### Create PowerPoint Presentation

```bash
# Launch and create
curl -X POST http://localhost:8765/powerpoint/launch

# Add title slide
curl -X POST http://localhost:8765/powerpoint/write_text \
  -H "Content-Type: application/json" \
  -d '{"slide": 1, "shape": 1, "text": "Q4 Report"}'

# Add content slide
curl -X POST http://localhost:8765/powerpoint/add_slide \
  -H "Content-Type: application/json" \
  -d '{"layout": 2}'

# Save
curl -X POST http://localhost:8765/powerpoint/save \
  -H "Content-Type: application/json" \
  -d '{"path": "C:\\Users\\user\\Desktop\\presentation.pptx"}'
```

## Screenshot Response Format

Screenshot endpoints return base64-encoded PNG images:

```json
{
  "success": true,
  "message": "Screenshot captured",
  "image": "iVBORw0KGgoAAAANSUhEUgAA...",
  "format": "png",
  "encoding": "base64"
}
```

## Troubleshooting

### "Office application not found"

Make sure Microsoft Office is installed and activated.

### "Window not found for screenshot"

The Office application window must be visible (not minimized).

### pywin32 installation issues

```bash
pip install pywin32
python -c "import win32com.client"  # Test import

# If import fails, run post-install script:
python Scripts/pywin32_postinstall.py -install
```

## License

MIT
