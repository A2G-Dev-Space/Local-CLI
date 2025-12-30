"""
Office Automation Server

Flask-based HTTP server that provides COM automation for Microsoft Office applications.
Designed to run on Windows and be called from WSL.

Usage:
    python server.py [--port 8765] [--host 0.0.0.0]

Or as compiled .exe:
    office-server.exe [--port 8765]
"""

import argparse
import base64
import io
import json
import sys
import os
from typing import Optional, Dict, Any

# Flask for HTTP server
from flask import Flask, request, jsonify
from flask_cors import CORS

# Windows COM automation
import pythoncom
import win32com.client
import win32gui
import win32ui
import win32con
import win32api
from PIL import Image

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from WSL

# Global application instances (to maintain state across requests)
office_apps: Dict[str, Any] = {
    'word': None,
    'excel': None,
    'powerpoint': None
}

# Initialize COM for main thread at startup
pythoncom.CoInitialize()


def get_or_create_word():
    """Get existing Word instance or create new one (re-dispatch if needed)"""
    global office_apps
    try:
        if office_apps['word'] is not None:
            # Try to access the object - will fail if disconnected
            _ = office_apps['word'].Visible
            return office_apps['word']
    except Exception:
        # Clear the reference if it's broken
        office_apps['word'] = None

    # Create new instance
    office_apps['word'] = win32com.client.Dispatch("Word.Application")
    return office_apps['word']


def get_or_create_excel():
    """Get existing Excel instance or create new one (re-dispatch if needed)"""
    global office_apps
    try:
        if office_apps['excel'] is not None:
            _ = office_apps['excel'].Visible
            return office_apps['excel']
    except Exception:
        # Clear the reference if it's broken
        office_apps['excel'] = None

    office_apps['excel'] = win32com.client.Dispatch("Excel.Application")
    return office_apps['excel']


def get_or_create_powerpoint():
    """Get existing PowerPoint instance or create new one (re-dispatch if needed)"""
    global office_apps
    try:
        if office_apps['powerpoint'] is not None:
            _ = office_apps['powerpoint'].Visible
            return office_apps['powerpoint']
    except Exception:
        # Clear the reference if it's broken
        office_apps['powerpoint'] = None

    office_apps['powerpoint'] = win32com.client.Dispatch("PowerPoint.Application")
    return office_apps['powerpoint']


def get_error_response(message: str, details: Optional[str] = None) -> Dict:
    """Create standardized error response"""
    response = {'success': False, 'error': message}
    if details:
        response['details'] = details
    return response


def get_success_response(message: str, data: Optional[Dict] = None) -> Dict:
    """Create standardized success response"""
    response = {'success': True, 'message': message}
    if data:
        response.update(data)
    return response


def capture_window_screenshot(hwnd: int) -> Optional[str]:
    """Capture screenshot of a window using mss (works with DirectX/GPU rendering)"""
    try:
        import ctypes

        # Restore window if minimized
        ctypes.windll.user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        win32api.Sleep(100)

        # Move window to primary monitor (0, 0) to ensure it's visible
        # First get current size
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        width = right - left
        height = bottom - top

        # Move to primary monitor at position (50, 50) with same size
        ctypes.windll.user32.SetWindowPos(hwnd, 0, 50, 50, min(width, 1600), min(height, 900), 0x0040)
        win32api.Sleep(200)

        # Now maximize on primary monitor
        ctypes.windll.user32.ShowWindow(hwnd, 3)  # SW_MAXIMIZE
        win32api.Sleep(300)

        # Get window dimensions after maximize
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        width = right - left
        height = bottom - top

        if width <= 0 or height <= 0:
            print(f"Invalid window dimensions: {width}x{height}")
            return None

        # Bring window to front
        try:
            win32gui.SetForegroundWindow(hwnd)
        except:
            pass
        win32api.Sleep(500)  # Wait for window to fully render

        # Get updated position after all window operations
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        width = right - left
        height = bottom - top

        # Use mss for screen capture
        try:
            import mss
            with mss.mss() as sct:
                # Capture from primary monitor (index 1)
                # monitors[0] is virtual screen, monitors[1] is primary
                primary = sct.monitors[1]

                # If window is within primary monitor, capture just the window area
                # Otherwise capture full primary monitor
                if left >= 0 and top >= 0 and right <= primary["width"] and bottom <= primary["height"]:
                    monitor = {
                        "left": left,
                        "top": top,
                        "width": width,
                        "height": height
                    }
                else:
                    # Window might be on secondary monitor or off-screen
                    # Capture full primary monitor as fallback
                    monitor = primary

                print(f"MSS capturing: window=({left},{top},{width}x{height}), monitor={monitor}")

                # Capture
                sct_img = sct.grab(monitor)

                # Convert to PIL Image
                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")

                # Convert to base64
                buffer = io.BytesIO()
                img.save(buffer, format='PNG')
                return base64.b64encode(buffer.getvalue()).decode('utf-8')
        except ImportError:
            print("mss not available, trying pyautogui")
        except Exception as e:
            print(f"mss screenshot failed: {e}")
            import traceback
            traceback.print_exc()

        # Fallback: pyautogui
        try:
            import pyautogui
            screen_width, screen_height = pyautogui.size()
            cap_left = max(0, left)
            cap_top = max(0, top)
            cap_width = min(width, screen_width - cap_left)
            cap_height = min(height, screen_height - cap_top)

            screenshot = pyautogui.screenshot(region=(cap_left, cap_top, cap_width, cap_height))
            buffer = io.BytesIO()
            screenshot.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
        except Exception as e:
            print(f"pyautogui screenshot failed: {e}")

        # Final fallback: PrintWindow API method
        hwnd_dc = win32gui.GetWindowDC(hwnd)
        mfc_dc = win32ui.CreateDCFromHandle(hwnd_dc)
        save_dc = mfc_dc.CreateCompatibleDC()

        save_bitmap = win32ui.CreateBitmap()
        save_bitmap.CreateCompatibleBitmap(mfc_dc, width, height)
        save_dc.SelectObject(save_bitmap)

        try:
            result = ctypes.windll.user32.PrintWindow(hwnd, save_dc.GetSafeHdc(), 2)
            if not result:
                save_dc.BitBlt((0, 0), (width, height), mfc_dc, (0, 0), win32con.SRCCOPY)
        except:
            save_dc.BitBlt((0, 0), (width, height), mfc_dc, (0, 0), win32con.SRCCOPY)

        bmp_info = save_bitmap.GetInfo()
        bmp_str = save_bitmap.GetBitmapBits(True)

        img = Image.frombuffer(
            'RGB',
            (bmp_info['bmWidth'], bmp_info['bmHeight']),
            bmp_str, 'raw', 'BGRX', 0, 1
        )

        win32gui.DeleteObject(save_bitmap.GetHandle())
        save_dc.DeleteDC()
        mfc_dc.DeleteDC()
        win32gui.ReleaseDC(hwnd, hwnd_dc)

        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode('utf-8')

    except Exception as e:
        print(f"Screenshot error: {e}")
        import traceback
        traceback.print_exc()
        return None


def find_window_by_class_or_title(class_name: str, title_pattern: str = None) -> Optional[int]:
    """Find window by class name or title pattern"""
    hwnd = win32gui.FindWindow(class_name, None)
    if hwnd:
        return hwnd

    # If not found by class, try to enumerate all windows
    result = []

    def enum_callback(hwnd, results):
        if win32gui.IsWindowVisible(hwnd):
            window_title = win32gui.GetWindowText(hwnd)
            window_class = win32gui.GetClassName(hwnd)
            if class_name and class_name.lower() in window_class.lower():
                results.append(hwnd)
            elif title_pattern and title_pattern.lower() in window_title.lower():
                results.append(hwnd)
        return True

    win32gui.EnumWindows(enum_callback, result)
    return result[0] if result else None


# =============================================================================
# Health Check Endpoints
# =============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'status': 'running',
        'version': '1.0.0',
        'apps': {
            'word': office_apps['word'] is not None,
            'excel': office_apps['excel'] is not None,
            'powerpoint': office_apps['powerpoint'] is not None
        }
    })


@app.route('/shutdown', methods=['POST'])
def shutdown():
    """Shutdown the server"""
    # Close all Office applications first
    for app_name in ['word', 'excel', 'powerpoint']:
        try:
            if office_apps[app_name]:
                office_apps[app_name].Quit()
                office_apps[app_name] = None
        except:
            pass

    # Shutdown Flask
    func = request.environ.get('werkzeug.server.shutdown')
    if func:
        func()
    return jsonify({'success': True, 'message': 'Server shutting down'})


# =============================================================================
# Microsoft Word Endpoints
# =============================================================================

@app.route('/word/launch', methods=['POST'])
def word_launch():
    """Launch Microsoft Word"""
    try:
        word = get_or_create_word()
        word.Visible = True

        # Create new document if none exists
        if word.Documents.Count == 0:
            word.Documents.Add()

        return jsonify(get_success_response('Word launched successfully'))
    except Exception as e:
        return jsonify(get_error_response('Failed to launch Word', str(e)))


@app.route('/word/create', methods=['POST'])
def word_create():
    """Create a new Word document"""
    try:
        word = get_or_create_word()
        word.Visible = True
        doc = word.Documents.Add()
        return jsonify(get_success_response('New document created', {
            'document_name': doc.Name
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to create document', str(e)))


def normalize_text(text: str) -> str:
    """Normalize text by converting escape sequences and HTML entities"""
    import html
    # Convert literal \n, \t to actual characters
    text = text.replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\r')
    # Decode HTML entities (&#10; -> newline, &amp; -> &, etc.)
    text = html.unescape(text)
    return text


@app.route('/word/write', methods=['POST'])
def word_write():
    """Write text to the active Word document with optional font settings"""
    try:
        data = request.json or {}
        text = normalize_text(data.get('text', ''))
        font_name = data.get('font_name')
        font_size = data.get('font_size')
        bold = data.get('bold')
        italic = data.get('italic')

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        selection = word.Selection

        # Apply font settings BEFORE writing text (so new text inherits them)
        if font_name:
            selection.Font.Name = font_name
        if font_size:
            selection.Font.Size = int(font_size)
        if bold is not None:
            selection.Font.Bold = -1 if bold else 0
        if italic is not None:
            selection.Font.Italic = -1 if italic else 0

        selection.TypeText(text)

        return jsonify(get_success_response('Text written successfully'))
    except Exception as e:
        return jsonify(get_error_response('Failed to write text', str(e)))


@app.route('/word/read', methods=['GET'])
def word_read():
    """Read content from the active Word document"""
    try:
        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        doc = word.ActiveDocument
        content = doc.Content.Text

        return jsonify(get_success_response('Content read successfully', {
            'content': content,
            'document_name': doc.Name
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to read content', str(e)))


@app.route('/word/save', methods=['POST'])
def word_save():
    """Save the active Word document"""
    try:
        data = request.json or {}
        file_path = data.get('path')

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        doc = word.ActiveDocument

        if file_path:
            doc.SaveAs2(file_path)
        else:
            doc.Save()

        return jsonify(get_success_response('Document saved', {
            'path': doc.FullName
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to save document', str(e)))


@app.route('/word/screenshot', methods=['GET'])
def word_screenshot():
    """Take screenshot of Word document using CopyAsPicture"""
    try:
        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        doc = word.ActiveDocument

        # Method 1: Use Selection.CopyAsPicture
        try:
            from PIL import ImageGrab

            # Select all content
            word.Selection.WholeStory()
            win32api.Sleep(100)

            # Copy as picture to clipboard
            # wdCopyPictureFormat: 0=Printer, 1=Screen
            word.Selection.CopyAsPicture()
            win32api.Sleep(200)

            # Grab from clipboard
            img = ImageGrab.grabclipboard()
            if img:
                buffer = io.BytesIO()
                img.save(buffer, format='PNG')
                return jsonify(get_success_response('Screenshot captured', {
                    'image': base64.b64encode(buffer.getvalue()).decode('utf-8'),
                    'format': 'png',
                    'encoding': 'base64'
                }))
        except Exception as e:
            print(f"CopyAsPicture method failed: {e}")

        # Method 2: Export to PDF then convert (fallback)
        try:
            import tempfile
            import os

            # Try PyMuPDF if available
            try:
                import fitz  # PyMuPDF

                temp_pdf = os.path.join(tempfile.gettempdir(), 'word_temp.pdf')
                # wdExportFormatPDF = 17
                doc.ExportAsFixedFormat(temp_pdf, 17)

                if os.path.exists(temp_pdf):
                    pdf_doc = fitz.open(temp_pdf)
                    page = pdf_doc[0]  # First page
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for quality
                    img_data = pix.tobytes("png")
                    pdf_doc.close()
                    os.remove(temp_pdf)

                    return jsonify(get_success_response('Screenshot captured', {
                        'image': base64.b64encode(img_data).decode('utf-8'),
                        'format': 'png',
                        'encoding': 'base64'
                    }))
            except ImportError:
                print("PyMuPDF not available")
        except Exception as e:
            print(f"PDF export method failed: {e}")

        return jsonify(get_error_response('Failed to capture screenshot'))
    except Exception as e:
        return jsonify(get_error_response('Screenshot failed', str(e)))


@app.route('/word/set_font', methods=['POST'])
def word_set_font():
    """Set font properties for selected text or entire document"""
    try:
        data = request.json or {}
        font_name = data.get('font_name')
        font_size = data.get('font_size')
        bold = data.get('bold')
        italic = data.get('italic')
        underline = data.get('underline')
        color = data.get('color')  # RGB hex string like '#FF0000'
        highlight = data.get('highlight')  # Highlight color index

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        selection = word.Selection

        if font_name:
            selection.Font.Name = font_name
        if font_size:
            selection.Font.Size = int(font_size)
        if bold is not None:
            selection.Font.Bold = -1 if bold else 0
        if italic is not None:
            selection.Font.Italic = -1 if italic else 0
        if underline is not None:
            selection.Font.Underline = 1 if underline else 0
        if color:
            if isinstance(color, str) and color.startswith('#'):
                hex_color = color.lstrip('#')
                rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                color_int = rgb[0] + (rgb[1] << 8) + (rgb[2] << 16)
            else:
                color_int = int(color)
            selection.Font.Color = color_int
        if highlight is not None:
            selection.Range.HighlightColorIndex = highlight

        return jsonify(get_success_response('Font properties updated'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set font', str(e)))


@app.route('/word/set_paragraph', methods=['POST'])
def word_set_paragraph():
    """Set paragraph formatting"""
    try:
        data = request.json or {}
        alignment = data.get('alignment')  # 'left', 'center', 'right', 'justify'
        line_spacing = data.get('line_spacing')  # 1.0, 1.5, 2.0, etc.
        space_before = data.get('space_before')  # points
        space_after = data.get('space_after')  # points
        first_line_indent = data.get('first_line_indent')  # points
        left_indent = data.get('left_indent')  # points
        right_indent = data.get('right_indent')  # points

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        selection = word.Selection
        para = selection.ParagraphFormat

        alignment_map = {
            'left': 0,      # wdAlignParagraphLeft
            'center': 1,    # wdAlignParagraphCenter
            'right': 2,     # wdAlignParagraphRight
            'justify': 3    # wdAlignParagraphJustify
        }

        if alignment and alignment.lower() in alignment_map:
            para.Alignment = alignment_map[alignment.lower()]
        if line_spacing:
            para.LineSpacingRule = 5  # wdLineSpaceMultiple
            para.LineSpacing = line_spacing * 12  # Convert to points
        if space_before is not None:
            para.SpaceBefore = space_before
        if space_after is not None:
            para.SpaceAfter = space_after
        if first_line_indent is not None:
            para.FirstLineIndent = first_line_indent
        if left_indent is not None:
            para.LeftIndent = left_indent
        if right_indent is not None:
            para.RightIndent = right_indent

        return jsonify(get_success_response('Paragraph formatting updated'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set paragraph', str(e)))


@app.route('/word/add_hyperlink', methods=['POST'])
def word_add_hyperlink():
    """Add a hyperlink to selected text or insert new hyperlink"""
    try:
        data = request.json or {}
        url = data.get('url')
        display_text = data.get('display_text')
        tooltip = data.get('tooltip', '')

        if not url:
            return jsonify(get_error_response('URL is required'))

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        doc = word.ActiveDocument
        selection = word.Selection

        if display_text:
            # Insert text first
            selection.TypeText(display_text)
            # Select the inserted text
            selection.MoveLeft(1, len(display_text), 1)  # wdCharacter, count, extend

        # Add hyperlink
        doc.Hyperlinks.Add(
            Anchor=selection.Range,
            Address=url,
            SubAddress="",
            ScreenTip=tooltip,
            TextToDisplay=display_text or url
        )

        return jsonify(get_success_response('Hyperlink added', {'url': url}))
    except Exception as e:
        return jsonify(get_error_response('Failed to add hyperlink', str(e)))


@app.route('/word/add_table', methods=['POST'])
def word_add_table():
    """Add a table to the document"""
    try:
        data = request.json or {}
        rows = data.get('rows', 3)
        cols = data.get('cols', 3)
        values = data.get('values')  # Optional 2D array of cell values
        style = data.get('style')  # Optional table style name

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        doc = word.ActiveDocument
        selection = word.Selection

        # Create table
        table = doc.Tables.Add(selection.Range, rows, cols)

        # Apply style if specified
        if style:
            try:
                table.Style = style
            except:
                pass  # Style not found, use default

        # Fill in values if provided
        if values:
            for i, row_data in enumerate(values):
                if i >= rows:
                    break
                for j, cell_value in enumerate(row_data):
                    if j >= cols:
                        break
                    table.Cell(i + 1, j + 1).Range.Text = normalize_text(str(cell_value))

        return jsonify(get_success_response('Table added', {
            'rows': rows,
            'cols': cols
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to add table', str(e)))


@app.route('/word/add_image', methods=['POST'])
def word_add_image():
    """Add an image to the document"""
    try:
        data = request.json or {}
        image_path = data.get('path')
        width = data.get('width')  # Optional, in points
        height = data.get('height')  # Optional, in points
        inline = data.get('inline', True)  # Inline with text or floating

        if not image_path:
            return jsonify(get_error_response('Image path is required'))

        if not os.path.exists(image_path):
            return jsonify(get_error_response(f'Image not found: {image_path}'))

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        selection = word.Selection

        if inline:
            shape = selection.InlineShapes.AddPicture(image_path)
            if width:
                shape.Width = width
            if height:
                shape.Height = height
        else:
            shape = selection.Range.InlineShapes.AddPicture(image_path)
            if width:
                shape.Width = width
            if height:
                shape.Height = height

        return jsonify(get_success_response('Image added', {
            'width': shape.Width,
            'height': shape.Height
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to add image', str(e)))


@app.route('/word/delete_text', methods=['POST'])
def word_delete_text():
    """Delete selected text or specified number of characters"""
    try:
        data = request.json or {}
        count = data.get('count', 1)  # Number of characters to delete
        direction = data.get('direction', 'right')  # 'left' or 'right'

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        selection = word.Selection

        if selection.Type == 2:  # wdSelectionNormal (text selected)
            selection.Delete()
        else:
            if direction == 'left':
                selection.Delete(1, count)  # wdCharacter
            else:
                selection.Delete(1, count)

        return jsonify(get_success_response('Text deleted'))
    except Exception as e:
        return jsonify(get_error_response('Failed to delete text', str(e)))


@app.route('/word/find_replace', methods=['POST'])
def word_find_replace():
    """Find and replace text in the document"""
    try:
        data = request.json or {}
        find_text = data.get('find')
        replace_text = data.get('replace', '')
        replace_all = data.get('replace_all', True)
        match_case = data.get('match_case', False)
        match_whole_word = data.get('match_whole_word', False)

        if not find_text:
            return jsonify(get_error_response('Find text is required'))

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        doc = word.ActiveDocument
        find_obj = doc.Content.Find

        find_obj.ClearFormatting()
        find_obj.Replacement.ClearFormatting()

        replace_type = 2 if replace_all else 1  # wdReplaceAll or wdReplaceOne

        result = find_obj.Execute(
            FindText=find_text,
            MatchCase=match_case,
            MatchWholeWord=match_whole_word,
            ReplaceWith=replace_text,
            Replace=replace_type
        )

        return jsonify(get_success_response('Find/replace completed', {
            'found': result
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to find/replace', str(e)))


@app.route('/word/set_style', methods=['POST'])
def word_set_style():
    """Apply a style to selected text"""
    try:
        data = request.json or {}
        style_name = data.get('style')  # 'Heading 1', 'Normal', 'Title', etc.

        if not style_name:
            return jsonify(get_error_response('Style name is required'))

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        selection = word.Selection
        selection.Style = style_name

        return jsonify(get_success_response(f'Style "{style_name}" applied'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set style', str(e)))


@app.route('/word/insert_break', methods=['POST'])
def word_insert_break():
    """Insert a break (page, section, line)"""
    try:
        data = request.json or {}
        break_type = data.get('type', 'page')  # 'page', 'section', 'line', 'column'

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        selection = word.Selection

        break_map = {
            'page': 7,       # wdPageBreak
            'section': 2,    # wdSectionBreakNextPage
            'line': 6,       # wdLineBreak
            'column': 8      # wdColumnBreak
        }

        break_id = break_map.get(break_type.lower(), 7)
        selection.InsertBreak(break_id)

        return jsonify(get_success_response(f'{break_type.title()} break inserted'))
    except Exception as e:
        return jsonify(get_error_response('Failed to insert break', str(e)))


@app.route('/word/get_selection', methods=['GET'])
def word_get_selection():
    """Get currently selected text"""
    try:
        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        selection = word.Selection
        return jsonify(get_success_response('Selection retrieved', {
            'text': selection.Text,
            'start': selection.Start,
            'end': selection.End
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to get selection', str(e)))


@app.route('/word/select_all', methods=['POST'])
def word_select_all():
    """Select all content in the document"""
    try:
        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        doc = word.ActiveDocument
        doc.Content.Select()

        return jsonify(get_success_response('All content selected'))
    except Exception as e:
        return jsonify(get_error_response('Failed to select all', str(e)))


@app.route('/word/goto', methods=['POST'])
def word_goto():
    """Go to a specific location in the document"""
    try:
        data = request.json or {}
        what = data.get('what', 'page')  # 'page', 'line', 'bookmark', 'section'
        which = data.get('which', 1)  # 1=first/next, 2=last/previous
        count = data.get('count', 1)
        name = data.get('name', '')  # For bookmarks

        word = get_or_create_word()
        if word.Documents.Count == 0:
            return jsonify(get_error_response('No active Word document'))

        selection = word.Selection

        what_map = {
            'page': 1,       # wdGoToPage
            'line': 3,       # wdGoToLine
            'bookmark': 1,   # wdGoToBookmark (but uses name)
            'section': 0     # wdGoToSection
        }

        what_id = what_map.get(what.lower(), 1)

        if what.lower() == 'bookmark' and name:
            selection.GoTo(what_id, 0, 0, name)
        else:
            selection.GoTo(what_id, which, count)

        return jsonify(get_success_response(f'Moved to {what}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to go to location', str(e)))


@app.route('/word/close', methods=['POST'])
def word_close():
    """Close Microsoft Word"""
    try:
        if office_apps['word']:
            data = request.json or {}
            save = data.get('save', False)

            if save:
                for doc in office_apps['word'].Documents:
                    doc.Save()

            office_apps['word'].Quit()
            office_apps['word'] = None

        return jsonify(get_success_response('Word closed'))
    except Exception as e:
        return jsonify(get_error_response('Failed to close Word', str(e)))


# =============================================================================
# Microsoft Excel Endpoints
# =============================================================================

@app.route('/excel/launch', methods=['POST'])
def excel_launch():
    """Launch Microsoft Excel"""
    try:
        excel = get_or_create_excel()
        excel.Visible = True

        if excel.Workbooks.Count == 0:
            excel.Workbooks.Add()

        return jsonify(get_success_response('Excel launched successfully'))
    except Exception as e:
        return jsonify(get_error_response('Failed to launch Excel', str(e)))


@app.route('/excel/create', methods=['POST'])
def excel_create():
    """Create a new Excel workbook"""
    try:
        excel = get_or_create_excel()
        excel.Visible = True
        wb = excel.Workbooks.Add()
        return jsonify(get_success_response('New workbook created', {
            'workbook_name': wb.Name
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to create workbook', str(e)))


@app.route('/excel/write_cell', methods=['POST'])
def excel_write_cell():
    """Write value to a cell with optional font settings"""
    try:
        data = request.json or {}
        cell = data.get('cell', 'A1')
        value = data.get('value', '')
        sheet = data.get('sheet', None)
        font_name = data.get('font_name')
        font_size = data.get('font_size')
        bold = data.get('bold')
        italic = data.get('italic')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        cell_range = ws.Range(cell)
        cell_range.Value = value

        # Apply font settings if provided
        if font_name or font_size or bold is not None or italic is not None:
            font = cell_range.Font
            if font_name:
                font.Name = font_name
            if font_size:
                font.Size = int(font_size)
            if bold is not None:
                font.Bold = -1 if bold else 0
            if italic is not None:
                font.Italic = -1 if italic else 0

        return jsonify(get_success_response(f'Value written to {cell}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to write cell', str(e)))


@app.route('/excel/read_cell', methods=['POST'])
def excel_read_cell():
    """Read value from a cell"""
    try:
        data = request.json or {}
        cell = data.get('cell', 'A1')
        sheet = data.get('sheet', None)

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        value = ws.Range(cell).Value

        return jsonify(get_success_response('Cell read successfully', {
            'cell': cell,
            'value': value
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to read cell', str(e)))


@app.route('/excel/read_range', methods=['POST'])
def excel_read_range():
    """Read values from a range of cells"""
    try:
        data = request.json or {}
        range_addr = data.get('range', 'A1:A10')
        sheet = data.get('sheet', None)

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        values = ws.Range(range_addr).Value

        if values:
            if isinstance(values, tuple):
                values = [list(row) if isinstance(row, tuple) else [row] for row in values]
            else:
                values = [[values]]

        return jsonify(get_success_response('Range read successfully', {
            'range': range_addr,
            'values': values
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to read range', str(e)))


@app.route('/excel/write_range', methods=['POST'])
def excel_write_range():
    """Write values to a range of cells"""
    try:
        data = request.json or {}
        start_cell = data.get('start_cell', 'A1')
        values = data.get('values', [[]])
        sheet = data.get('sheet', None)

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet

        rows = len(values)
        cols = len(values[0]) if values else 0

        if rows > 0 and cols > 0:
            # Write cell by cell for reliability
            start_range = ws.Range(start_cell)
            start_row = start_range.Row
            start_col = start_range.Column

            for i, row_data in enumerate(values):
                for j, value in enumerate(row_data):
                    ws.Cells(start_row + i, start_col + j).Value = value

        return jsonify(get_success_response(f'Values written starting at {start_cell}', {
            'rows': rows,
            'cols': cols
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to write range', str(e)))


@app.route('/excel/save', methods=['POST'])
def excel_save():
    """Save the active Excel workbook"""
    try:
        data = request.json or {}
        file_path = data.get('path')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        if file_path:
            wb.SaveAs(file_path)
        else:
            wb.Save()

        return jsonify(get_success_response('Workbook saved', {
            'path': wb.FullName
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to save workbook', str(e)))


@app.route('/excel/screenshot', methods=['GET'])
def excel_screenshot():
    """Take screenshot of Excel using Range.CopyPicture"""
    try:
        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.ActiveSheet

        # Get used range or default range
        used_range = ws.UsedRange
        if used_range.Rows.Count <= 1 and used_range.Columns.Count <= 1:
            # If no data, capture A1:J20 as default view
            used_range = ws.Range("A1:J20")

        # Copy picture to clipboard
        # xlScreen = 1, xlBitmap = 2
        try:
            from PIL import ImageGrab

            used_range.CopyPicture(Appearance=1, Format=2)  # xlScreen, xlBitmap
            win32api.Sleep(200)

            # Grab from clipboard
            img = ImageGrab.grabclipboard()
            if img:
                buffer = io.BytesIO()
                img.save(buffer, format='PNG')
                return jsonify(get_success_response('Screenshot captured', {
                    'image': base64.b64encode(buffer.getvalue()).decode('utf-8'),
                    'format': 'png',
                    'encoding': 'base64',
                    'range': used_range.Address
                }))
        except Exception as e:
            print(f"CopyPicture method failed: {e}")

        return jsonify(get_error_response('Failed to capture screenshot'))
    except Exception as e:
        return jsonify(get_error_response('Screenshot failed', str(e)))


@app.route('/excel/set_formula', methods=['POST'])
def excel_set_formula():
    """Set a formula in a cell"""
    try:
        data = request.json or {}
        cell = data.get('cell', 'A1')
        formula = data.get('formula')  # e.g., '=SUM(A1:A10)'
        sheet = data.get('sheet')

        if not formula:
            return jsonify(get_error_response('Formula is required'))

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        ws.Range(cell).Formula = formula

        return jsonify(get_success_response(f'Formula set in {cell}', {
            'cell': cell,
            'formula': formula
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to set formula', str(e)))


@app.route('/excel/set_font', methods=['POST'])
def excel_set_font():
    """Set font properties for a cell or range"""
    try:
        data = request.json or {}
        range_addr = data.get('range', 'A1')
        font_name = data.get('font_name')
        font_size = data.get('font_size')
        bold = data.get('bold')
        italic = data.get('italic')
        underline = data.get('underline')
        color = data.get('color')  # RGB hex string
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        cell_range = ws.Range(range_addr)
        font = cell_range.Font

        if font_name:
            font.Name = font_name
        if font_size:
            font.Size = int(font_size)
        if bold is not None:
            font.Bold = -1 if bold else 0
        if italic is not None:
            font.Italic = -1 if italic else 0
        if underline is not None:
            font.Underline = 2 if underline else 0  # xlUnderlineStyleSingle
        if color:
            if isinstance(color, str) and color.startswith('#'):
                hex_color = color.lstrip('#')
                rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                color_int = rgb[0] + (rgb[1] << 8) + (rgb[2] << 16)
            else:
                color_int = int(color)
            font.Color = color_int

        return jsonify(get_success_response('Font properties updated'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set font', str(e)))


@app.route('/excel/set_alignment', methods=['POST'])
def excel_set_alignment():
    """Set cell alignment"""
    try:
        data = request.json or {}
        range_addr = data.get('range', 'A1')
        horizontal = data.get('horizontal')  # 'left', 'center', 'right'
        vertical = data.get('vertical')  # 'top', 'center', 'bottom'
        wrap_text = data.get('wrap_text')
        orientation = data.get('orientation')  # angle in degrees
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        cell_range = ws.Range(range_addr)

        h_align_map = {
            'left': -4131,    # xlLeft
            'center': -4108,  # xlCenter
            'right': -4152    # xlRight
        }
        v_align_map = {
            'top': -4160,     # xlTop
            'center': -4108,  # xlCenter
            'bottom': -4107   # xlBottom
        }

        if horizontal and horizontal.lower() in h_align_map:
            cell_range.HorizontalAlignment = h_align_map[horizontal.lower()]
        if vertical and vertical.lower() in v_align_map:
            cell_range.VerticalAlignment = v_align_map[vertical.lower()]
        if wrap_text is not None:
            cell_range.WrapText = wrap_text
        if orientation is not None:
            cell_range.Orientation = orientation

        return jsonify(get_success_response('Alignment updated'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set alignment', str(e)))


@app.route('/excel/set_column_width', methods=['POST'])
def excel_set_column_width():
    """Set column width"""
    try:
        data = request.json or {}
        column = data.get('column', 'A')  # Column letter or range like 'A:C'
        width = data.get('width')  # Width in characters
        auto_fit = data.get('auto_fit', False)
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet

        if ':' not in column:
            column = f'{column}:{column}'

        col_range = ws.Columns(column)

        if auto_fit:
            col_range.AutoFit()
        elif width:
            col_range.ColumnWidth = width

        return jsonify(get_success_response('Column width set'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set column width', str(e)))


@app.route('/excel/set_row_height', methods=['POST'])
def excel_set_row_height():
    """Set row height"""
    try:
        data = request.json or {}
        row = data.get('row', 1)  # Row number or range like '1:5'
        height = data.get('height')  # Height in points
        auto_fit = data.get('auto_fit', False)
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet

        row_range = ws.Rows(f'{row}:{row}' if isinstance(row, int) else row)

        if auto_fit:
            row_range.AutoFit()
        elif height:
            row_range.RowHeight = height

        return jsonify(get_success_response('Row height set'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set row height', str(e)))


@app.route('/excel/merge_cells', methods=['POST'])
def excel_merge_cells():
    """Merge or unmerge cells"""
    try:
        data = request.json or {}
        range_addr = data.get('range')  # e.g., 'A1:C1'
        unmerge = data.get('unmerge', False)
        sheet = data.get('sheet')

        if not range_addr:
            return jsonify(get_error_response('Range is required'))

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        cell_range = ws.Range(range_addr)

        if unmerge:
            cell_range.UnMerge()
        else:
            cell_range.Merge()

        return jsonify(get_success_response('Cells merged' if not unmerge else 'Cells unmerged'))
    except Exception as e:
        return jsonify(get_error_response('Failed to merge/unmerge cells', str(e)))


@app.route('/excel/set_border', methods=['POST'])
def excel_set_border():
    """Set cell borders"""
    try:
        data = request.json or {}
        range_addr = data.get('range', 'A1')
        style = data.get('style', 'thin')  # 'thin', 'medium', 'thick', 'double', 'none'
        color = data.get('color')  # RGB hex string
        edges = data.get('edges', 'all')  # 'all', 'outline', 'left', 'right', 'top', 'bottom'
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        cell_range = ws.Range(range_addr)

        style_map = {
            'none': 0,        # xlLineStyleNone
            'thin': 1,        # xlContinuous (thin)
            'medium': -4138,  # xlMedium
            'thick': 4,       # xlThick
            'double': -4119,  # xlDouble
            'dotted': 4,      # xlDot
            'dashed': 1       # xlDash
        }

        # Border index constants
        border_indices = {
            'left': 7,        # xlEdgeLeft
            'right': 10,      # xlEdgeRight
            'top': 8,         # xlEdgeTop
            'bottom': 9,      # xlEdgeBottom
            'inside_h': 12,   # xlInsideHorizontal
            'inside_v': 11    # xlInsideVertical
        }

        line_style = style_map.get(style.lower(), 1)

        if color:
            if isinstance(color, str) and color.startswith('#'):
                hex_color = color.lstrip('#')
                rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                color_int = rgb[0] + (rgb[1] << 8) + (rgb[2] << 16)
            else:
                color_int = int(color)
        else:
            color_int = None

        def apply_border(border_index):
            border = cell_range.Borders(border_index)
            if style.lower() == 'none':
                border.LineStyle = 0
            else:
                border.LineStyle = 1  # xlContinuous
                border.Weight = style_map.get(style.lower(), 2)
            if color_int is not None:
                border.Color = color_int

        if edges == 'all':
            for idx in border_indices.values():
                try:
                    apply_border(idx)
                except:
                    pass
        elif edges == 'outline':
            for edge in ['left', 'right', 'top', 'bottom']:
                apply_border(border_indices[edge])
        elif edges in border_indices:
            apply_border(border_indices[edges])

        return jsonify(get_success_response('Border set'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set border', str(e)))


@app.route('/excel/set_fill', methods=['POST'])
def excel_set_fill():
    """Set cell background color"""
    try:
        data = request.json or {}
        range_addr = data.get('range', 'A1')
        color = data.get('color')  # RGB hex string like '#FFFF00'
        pattern = data.get('pattern', 'solid')
        sheet = data.get('sheet')

        if not color:
            return jsonify(get_error_response('Color is required'))

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        cell_range = ws.Range(range_addr)

        if isinstance(color, str) and color.startswith('#'):
            hex_color = color.lstrip('#')
            rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            color_int = rgb[0] + (rgb[1] << 8) + (rgb[2] << 16)
        else:
            color_int = int(color)

        cell_range.Interior.Color = color_int

        return jsonify(get_success_response('Fill color set'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set fill', str(e)))


@app.route('/excel/set_number_format', methods=['POST'])
def excel_set_number_format():
    """Set number format for cells"""
    try:
        data = request.json or {}
        range_addr = data.get('range', 'A1')
        format_str = data.get('format')  # e.g., '#,##0.00', '0%', 'yyyy-mm-dd'
        sheet = data.get('sheet')

        if not format_str:
            return jsonify(get_error_response('Format string is required'))

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        ws.Range(range_addr).NumberFormat = format_str

        return jsonify(get_success_response('Number format set'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set number format', str(e)))


@app.route('/excel/add_sheet', methods=['POST'])
def excel_add_sheet():
    """Add a new worksheet"""
    try:
        data = request.json or {}
        name = data.get('name')
        position = data.get('position', 'end')  # 'start', 'end', or sheet name to insert after

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook

        if position == 'start':
            new_sheet = wb.Sheets.Add(Before=wb.Sheets(1))
        elif position == 'end':
            new_sheet = wb.Sheets.Add(After=wb.Sheets(wb.Sheets.Count))
        else:
            new_sheet = wb.Sheets.Add(After=wb.Sheets(position))

        if name:
            new_sheet.Name = name

        return jsonify(get_success_response('Sheet added', {
            'name': new_sheet.Name
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to add sheet', str(e)))


@app.route('/excel/delete_sheet', methods=['POST'])
def excel_delete_sheet():
    """Delete a worksheet"""
    try:
        data = request.json or {}
        name = data.get('name')

        if not name:
            return jsonify(get_error_response('Sheet name is required'))

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook

        # Disable alert for sheet deletion
        excel.DisplayAlerts = False
        wb.Sheets(name).Delete()
        excel.DisplayAlerts = True

        return jsonify(get_success_response(f'Sheet "{name}" deleted'))
    except Exception as e:
        return jsonify(get_error_response('Failed to delete sheet', str(e)))


@app.route('/excel/rename_sheet', methods=['POST'])
def excel_rename_sheet():
    """Rename a worksheet"""
    try:
        data = request.json or {}
        old_name = data.get('old_name')
        new_name = data.get('new_name')

        if not old_name or not new_name:
            return jsonify(get_error_response('Both old_name and new_name are required'))

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        wb.Sheets(old_name).Name = new_name

        return jsonify(get_success_response(f'Sheet renamed to "{new_name}"'))
    except Exception as e:
        return jsonify(get_error_response('Failed to rename sheet', str(e)))


@app.route('/excel/get_sheets', methods=['GET'])
def excel_get_sheets():
    """Get list of all worksheets"""
    try:
        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        sheets = [wb.Sheets(i).Name for i in range(1, wb.Sheets.Count + 1)]

        return jsonify(get_success_response('Sheets retrieved', {
            'sheets': sheets,
            'count': len(sheets),
            'active': wb.ActiveSheet.Name
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to get sheets', str(e)))


@app.route('/excel/sort_range', methods=['POST'])
def excel_sort_range():
    """Sort a range of cells"""
    try:
        data = request.json or {}
        range_addr = data.get('range')
        sort_column = data.get('sort_column', 1)  # Column index (1-based)
        ascending = data.get('ascending', True)
        has_header = data.get('has_header', True)
        sheet = data.get('sheet')

        if not range_addr:
            return jsonify(get_error_response('Range is required'))

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet
        cell_range = ws.Range(range_addr)

        # Clear any existing sort
        ws.Sort.SortFields.Clear()

        # Get key column
        key_range = cell_range.Columns(sort_column)

        # Add sort field
        order = 1 if ascending else 2  # xlAscending or xlDescending
        ws.Sort.SortFields.Add(Key=key_range, Order=order)

        # Apply sort
        header = 1 if has_header else 2  # xlYes or xlNo
        ws.Sort.SetRange(cell_range)
        ws.Sort.Header = header
        ws.Sort.Apply()

        return jsonify(get_success_response('Range sorted'))
    except Exception as e:
        return jsonify(get_error_response('Failed to sort range', str(e)))


@app.route('/excel/insert_row', methods=['POST'])
def excel_insert_row():
    """Insert rows"""
    try:
        data = request.json or {}
        row = data.get('row', 1)
        count = data.get('count', 1)
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet

        for _ in range(count):
            ws.Rows(row).Insert()

        return jsonify(get_success_response(f'{count} row(s) inserted at row {row}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to insert row', str(e)))


@app.route('/excel/delete_row', methods=['POST'])
def excel_delete_row():
    """Delete rows"""
    try:
        data = request.json or {}
        row = data.get('row', 1)
        count = data.get('count', 1)
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet

        ws.Rows(f'{row}:{row + count - 1}').Delete()

        return jsonify(get_success_response(f'{count} row(s) deleted starting at row {row}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to delete row', str(e)))


@app.route('/excel/insert_column', methods=['POST'])
def excel_insert_column():
    """Insert columns"""
    try:
        data = request.json or {}
        column = data.get('column', 'A')
        count = data.get('count', 1)
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet

        for _ in range(count):
            ws.Columns(column).Insert()

        return jsonify(get_success_response(f'{count} column(s) inserted at column {column}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to insert column', str(e)))


@app.route('/excel/delete_column', methods=['POST'])
def excel_delete_column():
    """Delete columns"""
    try:
        data = request.json or {}
        column = data.get('column', 'A')
        count = data.get('count', 1)
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet

        # Convert column letter to end column
        col_num = 0
        for char in column.upper():
            col_num = col_num * 26 + (ord(char) - ord('A') + 1)
        end_col_num = col_num + count - 1
        end_col = ''
        while end_col_num > 0:
            end_col_num, remainder = divmod(end_col_num - 1, 26)
            end_col = chr(65 + remainder) + end_col

        ws.Columns(f'{column}:{end_col}').Delete()

        return jsonify(get_success_response(f'{count} column(s) deleted starting at column {column}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to delete column', str(e)))


@app.route('/excel/freeze_panes', methods=['POST'])
def excel_freeze_panes():
    """Freeze or unfreeze panes"""
    try:
        data = request.json or {}
        cell = data.get('cell', 'A2')  # Cell below and right of which to freeze
        unfreeze = data.get('unfreeze', False)
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet

        # Activate the sheet
        ws.Activate()

        if unfreeze:
            excel.ActiveWindow.FreezePanes = False
        else:
            ws.Range(cell).Select()
            excel.ActiveWindow.FreezePanes = True

        return jsonify(get_success_response('Panes frozen' if not unfreeze else 'Panes unfrozen'))
    except Exception as e:
        return jsonify(get_error_response('Failed to freeze/unfreeze panes', str(e)))


@app.route('/excel/auto_filter', methods=['POST'])
def excel_auto_filter():
    """Apply or remove auto filter"""
    try:
        data = request.json or {}
        range_addr = data.get('range')
        remove = data.get('remove', False)
        sheet = data.get('sheet')

        excel = get_or_create_excel()
        if excel.Workbooks.Count == 0:
            return jsonify(get_error_response('No active Excel workbook'))

        wb = excel.ActiveWorkbook
        ws = wb.Sheets(sheet) if sheet else wb.ActiveSheet

        if remove:
            if ws.AutoFilterMode:
                ws.AutoFilterMode = False
        else:
            if range_addr:
                ws.Range(range_addr).AutoFilter()
            else:
                ws.UsedRange.AutoFilter()

        return jsonify(get_success_response('Auto filter applied' if not remove else 'Auto filter removed'))
    except Exception as e:
        return jsonify(get_error_response('Failed to apply auto filter', str(e)))


@app.route('/excel/close', methods=['POST'])
def excel_close():
    """Close Microsoft Excel"""
    try:
        if office_apps['excel']:
            data = request.json or {}
            save = data.get('save', False)

            if save:
                for wb in office_apps['excel'].Workbooks:
                    wb.Save()

            office_apps['excel'].Quit()
            office_apps['excel'] = None

        return jsonify(get_success_response('Excel closed'))
    except Exception as e:
        return jsonify(get_error_response('Failed to close Excel', str(e)))


# =============================================================================
# Microsoft PowerPoint Endpoints
# =============================================================================

@app.route('/powerpoint/launch', methods=['POST'])
def powerpoint_launch():
    """Launch Microsoft PowerPoint"""
    try:
        ppt = get_or_create_powerpoint()
        ppt.Visible = True

        if ppt.Presentations.Count == 0:
            ppt.Presentations.Add()

        return jsonify(get_success_response('PowerPoint launched successfully'))
    except Exception as e:
        return jsonify(get_error_response('Failed to launch PowerPoint', str(e)))


@app.route('/powerpoint/create', methods=['POST'])
def powerpoint_create():
    """Create a new PowerPoint presentation"""
    try:
        ppt = get_or_create_powerpoint()
        ppt.Visible = True
        pres = ppt.Presentations.Add()
        return jsonify(get_success_response('New presentation created', {
            'presentation_name': pres.Name
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to create presentation', str(e)))


@app.route('/powerpoint/add_slide', methods=['POST'])
def powerpoint_add_slide():
    """Add a new slide to the presentation"""
    try:
        data = request.json or {}
        layout = data.get('layout', 1)

        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        slide_count = pres.Slides.Count
        slide = pres.Slides.Add(slide_count + 1, layout)

        return jsonify(get_success_response('Slide added', {
            'slide_number': slide.SlideNumber
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to add slide', str(e)))


@app.route('/powerpoint/write_text', methods=['POST'])
def powerpoint_write_text():
    """Write text to a slide with optional font settings"""
    try:
        data = request.json or {}
        slide_number = data.get('slide', 1)
        shape_index = data.get('shape', 1)
        text = normalize_text(data.get('text', ''))
        font_name = data.get('font_name')
        font_size = data.get('font_size')
        bold = data.get('bold')
        italic = data.get('italic')

        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        if slide_number > pres.Slides.Count:
            return jsonify(get_error_response(f'Slide {slide_number} does not exist'))

        slide = pres.Slides(slide_number)
        if shape_index > slide.Shapes.Count:
            return jsonify(get_error_response(f'Shape {shape_index} does not exist on slide {slide_number}'))

        shape = slide.Shapes(shape_index)
        if shape.HasTextFrame:
            text_range = shape.TextFrame.TextRange
            text_range.Text = text

            # Apply font settings if provided
            if font_name or font_size or bold is not None or italic is not None:
                font = text_range.Font
                if font_name:
                    font.Name = font_name
                if font_size:
                    font.Size = int(font_size)
                if bold is not None:
                    font.Bold = -1 if bold else 0
                if italic is not None:
                    font.Italic = -1 if italic else 0

        return jsonify(get_success_response('Text written to slide'))
    except Exception as e:
        return jsonify(get_error_response('Failed to write text', str(e)))


@app.route('/powerpoint/read_slide', methods=['POST'])
def powerpoint_read_slide():
    """Read content from a slide"""
    try:
        data = request.json or {}
        slide_number = data.get('slide', 1)

        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        if slide_number > pres.Slides.Count:
            return jsonify(get_error_response(f'Slide {slide_number} does not exist'))

        slide = pres.Slides(slide_number)
        shapes_info = []
        for i in range(1, slide.Shapes.Count + 1):
            shape = slide.Shapes(i)
            shape_data = {
                'shape_index': i,
                'name': shape.Name,
                'type': shape.Type,
                'left': shape.Left,
                'top': shape.Top,
                'width': shape.Width,
                'height': shape.Height
            }
            if shape.HasTextFrame:
                shape_data['text'] = shape.TextFrame.TextRange.Text
                # Get font info from first character
                try:
                    font = shape.TextFrame.TextRange.Font
                    shape_data['font'] = {
                        'name': font.Name,
                        'size': font.Size,
                        'bold': font.Bold,
                        'italic': font.Italic
                    }
                except:
                    pass
            shapes_info.append(shape_data)

        return jsonify(get_success_response('Slide content read', {
            'slide_number': slide_number,
            'total_shapes': slide.Shapes.Count,
            'shapes': shapes_info
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to read slide', str(e)))


@app.route('/powerpoint/add_textbox', methods=['POST'])
def powerpoint_add_textbox():
    """Add a textbox to a slide with optional font settings"""
    try:
        data = request.json or {}
        slide_number = data.get('slide', 1)
        left = data.get('left', 100)
        top = data.get('top', 100)
        width = data.get('width', 300)
        height = data.get('height', 50)
        text = normalize_text(data.get('text', ''))
        font_name = data.get('font_name')
        font_size = data.get('font_size')
        bold = data.get('bold')
        italic = data.get('italic')

        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        if slide_number > pres.Slides.Count:
            return jsonify(get_error_response(f'Slide {slide_number} does not exist'))

        slide = pres.Slides(slide_number)
        # msoTextBox = 17
        textbox = slide.Shapes.AddTextbox(1, left, top, width, height)
        text_range = textbox.TextFrame.TextRange
        text_range.Text = text

        # Apply font settings if provided
        if font_name or font_size or bold is not None or italic is not None:
            font = text_range.Font
            if font_name:
                font.Name = font_name
            if font_size:
                font.Size = int(font_size)
            if bold is not None:
                font.Bold = -1 if bold else 0
            if italic is not None:
                font.Italic = -1 if italic else 0

        return jsonify(get_success_response('Textbox added', {
            'slide_number': slide_number,
            'shape_index': textbox.ZOrderPosition
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to add textbox', str(e)))


@app.route('/powerpoint/set_font', methods=['POST'])
def powerpoint_set_font():
    """Set font properties for a shape's text"""
    try:
        data = request.json or {}
        slide_number = data.get('slide', 1)
        shape_index = data.get('shape', 1)
        font_name = data.get('font_name')
        font_size = data.get('font_size')
        bold = data.get('bold')
        italic = data.get('italic')
        color = data.get('color')  # RGB as integer or hex string

        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        if slide_number > pres.Slides.Count:
            return jsonify(get_error_response(f'Slide {slide_number} does not exist'))

        slide = pres.Slides(slide_number)
        if shape_index > slide.Shapes.Count:
            return jsonify(get_error_response(f'Shape {shape_index} does not exist'))

        shape = slide.Shapes(shape_index)
        if not shape.HasTextFrame:
            return jsonify(get_error_response('Shape does not have text frame'))

        font = shape.TextFrame.TextRange.Font

        if font_name:
            font.Name = font_name
        if font_size:
            font.Size = int(font_size)
        if bold is not None:
            font.Bold = -1 if bold else 0
        if italic is not None:
            font.Italic = -1 if italic else 0
        if color is not None:
            if isinstance(color, str) and color.startswith('#'):
                # Convert hex to RGB integer
                hex_color = color.lstrip('#')
                rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                # Convert to BGR for Office
                color_int = rgb[2] + (rgb[1] << 8) + (rgb[0] << 16)
            else:
                color_int = int(color)
            font.Color.RGB = color_int

        return jsonify(get_success_response('Font properties updated'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set font', str(e)))


@app.route('/powerpoint/add_image', methods=['POST'])
def powerpoint_add_image():
    """Add an image to a slide"""
    try:
        data = request.json or {}
        slide_number = data.get('slide', 1)
        image_path = data.get('path')  # Windows path to image
        left = data.get('left', 100)
        top = data.get('top', 100)
        width = data.get('width')  # Optional, maintain aspect ratio if not specified
        height = data.get('height')

        if not image_path:
            return jsonify(get_error_response('Image path is required'))

        if not os.path.exists(image_path):
            return jsonify(get_error_response(f'Image not found: {image_path}'))

        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        if slide_number > pres.Slides.Count:
            return jsonify(get_error_response(f'Slide {slide_number} does not exist'))

        slide = pres.Slides(slide_number)

        # Add picture
        if width and height:
            picture = slide.Shapes.AddPicture(image_path, False, True, left, top, width, height)
        else:
            picture = slide.Shapes.AddPicture(image_path, False, True, left, top)

        return jsonify(get_success_response('Image added', {
            'slide_number': slide_number,
            'shape_index': picture.ZOrderPosition,
            'width': picture.Width,
            'height': picture.Height
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to add image', str(e)))


@app.route('/powerpoint/add_animation', methods=['POST'])
def powerpoint_add_animation():
    """Add animation effect to a shape"""
    try:
        data = request.json or {}
        slide_number = data.get('slide', 1)
        shape_index = data.get('shape', 1)
        effect_type = data.get('effect', 'fade')  # fade, fly, zoom, wipe, etc.
        trigger = data.get('trigger', 'on_click')  # on_click, with_previous, after_previous

        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        if slide_number > pres.Slides.Count:
            return jsonify(get_error_response(f'Slide {slide_number} does not exist'))

        slide = pres.Slides(slide_number)
        if shape_index > slide.Shapes.Count:
            return jsonify(get_error_response(f'Shape {shape_index} does not exist'))

        shape = slide.Shapes(shape_index)

        # Animation effect constants (msoAnimEffect)
        effect_map = {
            'appear': 1,        # msoAnimEffectAppear
            'fade': 10,         # msoAnimEffectFade
            'fly': 2,           # msoAnimEffectFly
            'zoom': 53,         # msoAnimEffectZoom
            'wipe': 22,         # msoAnimEffectWipe
            'split': 21,        # msoAnimEffectSplit
            'wheel': 21,        # msoAnimEffectWheel (same as split for simplicity)
            'bounce': 26,       # msoAnimEffectBounce
            'float': 42,        # msoAnimEffectFloat
            'grow': 49,         # msoAnimEffectGrowAndTurn
        }

        # Trigger constants
        trigger_map = {
            'on_click': 1,      # msoAnimTriggerOnPageClick
            'with_previous': 2, # msoAnimTriggerWithPrevious
            'after_previous': 3 # msoAnimTriggerAfterPrevious
        }

        effect_id = effect_map.get(effect_type.lower(), 10)  # Default to fade
        trigger_id = trigger_map.get(trigger.lower(), 1)

        # Add animation to timeline
        timeline = slide.TimeLine
        effect = timeline.MainSequence.AddEffect(shape, effect_id)
        effect.Timing.TriggerType = trigger_id

        return jsonify(get_success_response('Animation added', {
            'slide_number': slide_number,
            'shape_index': shape_index,
            'effect': effect_type,
            'trigger': trigger
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to add animation', str(e)))


@app.route('/powerpoint/set_background', methods=['POST'])
def powerpoint_set_background():
    """Set slide background color or image"""
    try:
        data = request.json or {}
        slide_number = data.get('slide', 1)
        color = data.get('color')  # RGB hex string like '#FF0000'
        image_path = data.get('image')  # Windows path to image

        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        if slide_number > pres.Slides.Count:
            return jsonify(get_error_response(f'Slide {slide_number} does not exist'))

        slide = pres.Slides(slide_number)

        if image_path:
            if not os.path.exists(image_path):
                return jsonify(get_error_response(f'Image not found: {image_path}'))
            slide.FollowMasterBackground = False
            slide.Background.Fill.UserPicture(image_path)
        elif color:
            slide.FollowMasterBackground = False
            if isinstance(color, str) and color.startswith('#'):
                hex_color = color.lstrip('#')
                rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                color_int = rgb[2] + (rgb[1] << 8) + (rgb[0] << 16)
            else:
                color_int = int(color)
            slide.Background.Fill.Solid()
            slide.Background.Fill.ForeColor.RGB = color_int

        return jsonify(get_success_response('Background set'))
    except Exception as e:
        return jsonify(get_error_response('Failed to set background', str(e)))


@app.route('/powerpoint/get_slide_count', methods=['GET'])
def powerpoint_get_slide_count():
    """Get the number of slides in the presentation"""
    try:
        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        return jsonify(get_success_response('Slide count retrieved', {
            'count': pres.Slides.Count
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to get slide count', str(e)))


@app.route('/powerpoint/save', methods=['POST'])
def powerpoint_save():
    """Save the active PowerPoint presentation"""
    try:
        data = request.json or {}
        file_path = data.get('path')

        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        if file_path:
            pres.SaveAs(file_path)
        else:
            pres.Save()

        return jsonify(get_success_response('Presentation saved', {
            'path': pres.FullName
        }))
    except Exception as e:
        return jsonify(get_error_response('Failed to save presentation', str(e)))


@app.route('/powerpoint/screenshot', methods=['GET'])
def powerpoint_screenshot():
    """Take screenshot of PowerPoint slide using Slide.Export

    Query params:
        slide: slide number (default: current slide)
    """
    try:
        ppt = get_or_create_powerpoint()
        if ppt.Presentations.Count == 0:
            return jsonify(get_error_response('No active PowerPoint presentation'))

        pres = ppt.ActivePresentation
        if pres.Slides.Count == 0:
            return jsonify(get_error_response('Presentation has no slides'))

        # Get slide number from query param or use current slide
        slide_number = request.args.get('slide', type=int)
        if slide_number is None:
            try:
                slide_number = ppt.ActiveWindow.View.Slide.SlideIndex
            except:
                slide_number = 1

        if slide_number < 1 or slide_number > pres.Slides.Count:
            return jsonify(get_error_response(f'Invalid slide number. Valid range: 1-{pres.Slides.Count}'))

        slide = pres.Slides(slide_number)

        # Export slide as PNG
        import tempfile
        import os

        temp_file = os.path.join(tempfile.gettempdir(), f'ppt_slide_{slide_number}.png')
        slide.Export(temp_file, 'PNG', 1920, 1080)  # Full HD resolution

        if os.path.exists(temp_file):
            with open(temp_file, 'rb') as f:
                image_data = f.read()
            os.remove(temp_file)  # Cleanup

            return jsonify(get_success_response('Screenshot captured', {
                'image': base64.b64encode(image_data).decode('utf-8'),
                'format': 'png',
                'encoding': 'base64',
                'slide_number': slide_number,
                'total_slides': pres.Slides.Count
            }))
        else:
            return jsonify(get_error_response('Failed to export slide'))
    except Exception as e:
        return jsonify(get_error_response('Screenshot failed', str(e)))


@app.route('/powerpoint/close', methods=['POST'])
def powerpoint_close():
    """Close Microsoft PowerPoint"""
    try:
        if office_apps['powerpoint']:
            data = request.json or {}
            save = data.get('save', False)

            if save:
                for pres in office_apps['powerpoint'].Presentations:
                    pres.Save()

            office_apps['powerpoint'].Quit()
            office_apps['powerpoint'] = None

        return jsonify(get_success_response('PowerPoint closed'))
    except Exception as e:
        return jsonify(get_error_response('Failed to close PowerPoint', str(e)))


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='Office Automation Server')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8765, help='Port to listen on')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')

    args = parser.parse_args()

    print(f"Office Automation Server starting on http://{args.host}:{args.port}")
    print("Endpoints:")
    print("  GET  /health              - Health check")
    print("  POST /shutdown            - Shutdown server")
    print("")
    print("  Word:")
    print("  POST /word/launch         - Launch Word")
    print("  POST /word/create         - Create new document")
    print("  POST /word/write          - Write text")
    print("  GET  /word/read           - Read content")
    print("  POST /word/save           - Save document")
    print("  GET  /word/screenshot     - Take screenshot")
    print("  POST /word/close          - Close Word")
    print("")
    print("  Excel:")
    print("  POST /excel/launch        - Launch Excel")
    print("  POST /excel/create        - Create new workbook")
    print("  POST /excel/write_cell    - Write to cell")
    print("  POST /excel/read_cell     - Read from cell")
    print("  POST /excel/write_range   - Write to range")
    print("  POST /excel/read_range    - Read from range")
    print("  POST /excel/save          - Save workbook")
    print("  GET  /excel/screenshot    - Take screenshot")
    print("  POST /excel/close         - Close Excel")
    print("")
    print("  PowerPoint:")
    print("  POST /powerpoint/launch       - Launch PowerPoint")
    print("  POST /powerpoint/create       - Create new presentation")
    print("  POST /powerpoint/add_slide    - Add slide")
    print("  POST /powerpoint/write_text   - Write text to slide")
    print("  POST /powerpoint/add_textbox  - Add textbox to slide")
    print("  POST /powerpoint/set_font     - Set font properties")
    print("  POST /powerpoint/add_image    - Add image to slide")
    print("  POST /powerpoint/add_animation- Add animation effect")
    print("  POST /powerpoint/set_background- Set slide background")
    print("  POST /powerpoint/read_slide   - Read slide content")
    print("  GET  /powerpoint/get_slide_count- Get slide count")
    print("  POST /powerpoint/save         - Save presentation")
    print("  GET  /powerpoint/screenshot   - Take screenshot")
    print("  POST /powerpoint/close        - Close PowerPoint")
    print("")
    print("Press Ctrl+C to stop the server")

    # Use threaded=False for COM compatibility (COM objects are apartment-threaded)
    app.run(host=args.host, port=args.port, debug=args.debug, threaded=False)


if __name__ == '__main__':
    main()
