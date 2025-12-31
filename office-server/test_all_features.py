"""
Comprehensive Test for Office Automation Server
Tests all Word, Excel, and PowerPoint features
"""

import requests
import time
import json

BASE_URL = "http://127.0.0.1:8765"


def test_endpoint(method, endpoint, data=None, expected_success=True):
    """Test an endpoint and return result"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        else:
            response = requests.post(url, json=data, timeout=10)

        result = response.json()
        status = "OK" if result.get("success") == expected_success else "FAIL"
        print(f"  [{status}] {method} {endpoint}")
        if not result.get("success") and expected_success:
            print(f"       Error: {result.get('error', result.get('message', 'Unknown'))}")
        return result
    except Exception as e:
        print(f"  [ERROR] {method} {endpoint}: {e}")
        return {"success": False, "error": str(e)}


def test_health():
    """Test health endpoint"""
    print("\n=== Health Check ===")
    return test_endpoint("GET", "/health")


def test_word_features():
    """Test all Word features"""
    print("\n" + "=" * 50)
    print("=== Microsoft Word Tests ===")
    print("=" * 50)

    # Basic operations
    print("\n--- Basic Operations ---")
    test_endpoint("POST", "/word/launch")
    time.sleep(1)
    test_endpoint("POST", "/word/create")

    # Write and read
    print("\n--- Write and Read ---")
    test_endpoint("POST", "/word/write", {"text": "Hello World! This is a test document.\n\n"})
    test_endpoint("GET", "/word/read")

    # Font settings
    print("\n--- Font Settings ---")
    test_endpoint("POST", "/word/write", {"text": "Bold and Red Text\n"})
    test_endpoint("POST", "/word/set_font", {
        "font_name": "Arial",
        "font_size": 16,
        "bold": True,
        "color": "#FF0000"
    })

    # Paragraph formatting
    print("\n--- Paragraph Formatting ---")
    test_endpoint("POST", "/word/write", {"text": "\nCentered paragraph with double spacing.\n"})
    test_endpoint("POST", "/word/set_paragraph", {
        "alignment": "center",
        "line_spacing": 2.0
    })

    # Hyperlink
    print("\n--- Hyperlink ---")
    test_endpoint("POST", "/word/add_hyperlink", {
        "url": "https://www.google.com",
        "display_text": "Visit Google",
        "tooltip": "Click to visit Google"
    })

    # Insert break
    print("\n--- Insert Break ---")
    test_endpoint("POST", "/word/insert_break", {"type": "line"})
    test_endpoint("POST", "/word/write", {"text": "\nAfter line break.\n"})

    # Table
    print("\n--- Table ---")
    test_endpoint("POST", "/word/add_table", {
        "rows": 3,
        "cols": 3,
        "values": [
            ["Name", "Age", "City"],
            ["Alice", "25", "Seoul"],
            ["Bob", "30", "Busan"]
        ]
    })

    # Find and replace
    print("\n--- Find and Replace ---")
    test_endpoint("POST", "/word/find_replace", {
        "find": "Hello",
        "replace": "Hi",
        "replace_all": True
    })

    # Style
    print("\n--- Style ---")
    test_endpoint("POST", "/word/write", {"text": "\n\nThis should be a heading\n"})
    test_endpoint("POST", "/word/set_style", {"style": "Heading 1"})

    # Selection
    print("\n--- Selection ---")
    test_endpoint("POST", "/word/select_all")
    test_endpoint("GET", "/word/get_selection")

    # Screenshot
    print("\n--- Screenshot ---")
    result = test_endpoint("GET", "/word/screenshot")
    if result.get("success") and result.get("image"):
        print(f"       Screenshot captured: {len(result['image'])} bytes (base64)")

    # Close without saving
    print("\n--- Close ---")
    test_endpoint("POST", "/word/close", {"save": False})

    print("\n[Word Tests Complete]")


def test_excel_features():
    """Test all Excel features"""
    print("\n" + "=" * 50)
    print("=== Microsoft Excel Tests ===")
    print("=" * 50)

    # Basic operations
    print("\n--- Basic Operations ---")
    test_endpoint("POST", "/excel/launch")
    time.sleep(1)
    test_endpoint("POST", "/excel/create")

    # Write cell
    print("\n--- Write/Read Cell ---")
    test_endpoint("POST", "/excel/write_cell", {"cell": "A1", "value": "Product"})
    test_endpoint("POST", "/excel/write_cell", {"cell": "B1", "value": "Price"})
    test_endpoint("POST", "/excel/write_cell", {"cell": "C1", "value": "Quantity"})
    test_endpoint("POST", "/excel/read_cell", {"cell": "A1"})

    # Write range (the fix we made)
    print("\n--- Write/Read Range ---")
    test_endpoint("POST", "/excel/write_range", {
        "start_cell": "A2",
        "values": [
            ["Apple", 100, 10],
            ["Banana", 50, 20],
            ["Orange", 75, 15]
        ]
    })
    result = test_endpoint("POST", "/excel/read_range", {"range": "A1:C4"})
    if result.get("success"):
        print(f"       Values: {result.get('values')}")

    # Formula
    print("\n--- Formula ---")
    test_endpoint("POST", "/excel/write_cell", {"cell": "D1", "value": "Total"})
    test_endpoint("POST", "/excel/set_formula", {"cell": "D2", "formula": "=B2*C2"})
    test_endpoint("POST", "/excel/set_formula", {"cell": "D3", "formula": "=B3*C3"})
    test_endpoint("POST", "/excel/set_formula", {"cell": "D4", "formula": "=B4*C4"})
    test_endpoint("POST", "/excel/set_formula", {"cell": "D5", "formula": "=SUM(D2:D4)"})
    test_endpoint("POST", "/excel/read_cell", {"cell": "D5"})

    # Font settings
    print("\n--- Font Settings ---")
    test_endpoint("POST", "/excel/set_font", {
        "range": "A1:D1",
        "font_name": "Arial",
        "font_size": 14,
        "bold": True,
        "color": "#0000FF"
    })

    # Alignment
    print("\n--- Alignment ---")
    test_endpoint("POST", "/excel/set_alignment", {
        "range": "A1:D1",
        "horizontal": "center",
        "vertical": "center"
    })

    # Column width
    print("\n--- Column Width ---")
    test_endpoint("POST", "/excel/set_column_width", {"column": "A", "auto_fit": True})
    test_endpoint("POST", "/excel/set_column_width", {"column": "B", "width": 15})

    # Row height
    print("\n--- Row Height ---")
    test_endpoint("POST", "/excel/set_row_height", {"row": 1, "height": 25})

    # Fill color
    print("\n--- Fill Color ---")
    test_endpoint("POST", "/excel/set_fill", {"range": "A1:D1", "color": "#FFFF00"})

    # Border
    print("\n--- Border ---")
    test_endpoint("POST", "/excel/set_border", {
        "range": "A1:D5",
        "style": "thin",
        "edges": "all"
    })

    # Number format
    print("\n--- Number Format ---")
    test_endpoint("POST", "/excel/set_number_format", {"range": "B2:B4", "format": "#,##0"})
    test_endpoint("POST", "/excel/set_number_format", {"range": "D2:D5", "format": "#,##0"})

    # Merge cells
    print("\n--- Merge Cells ---")
    test_endpoint("POST", "/excel/write_cell", {"cell": "A7", "value": "Merged Header"})
    test_endpoint("POST", "/excel/merge_cells", {"range": "A7:D7"})

    # Sheet operations
    print("\n--- Sheet Operations ---")
    test_endpoint("GET", "/excel/get_sheets")
    test_endpoint("POST", "/excel/add_sheet", {"name": "TestSheet"})
    test_endpoint("POST", "/excel/rename_sheet", {"old_name": "TestSheet", "new_name": "RenamedSheet"})
    test_endpoint("GET", "/excel/get_sheets")
    test_endpoint("POST", "/excel/delete_sheet", {"name": "RenamedSheet"})

    # Insert/Delete row/column
    print("\n--- Insert/Delete Row/Column ---")
    test_endpoint("POST", "/excel/insert_row", {"row": 2, "count": 1})
    test_endpoint("POST", "/excel/insert_column", {"column": "A", "count": 1})
    test_endpoint("POST", "/excel/delete_row", {"row": 2, "count": 1})
    test_endpoint("POST", "/excel/delete_column", {"column": "A", "count": 1})

    # Auto filter
    print("\n--- Auto Filter ---")
    test_endpoint("POST", "/excel/auto_filter", {"range": "A1:D5"})
    test_endpoint("POST", "/excel/auto_filter", {"remove": True})

    # Freeze panes
    print("\n--- Freeze Panes ---")
    test_endpoint("POST", "/excel/freeze_panes", {"cell": "A2"})
    test_endpoint("POST", "/excel/freeze_panes", {"unfreeze": True})

    # Screenshot
    print("\n--- Screenshot ---")
    result = test_endpoint("GET", "/excel/screenshot")
    if result.get("success") and result.get("image"):
        print(f"       Screenshot captured: {len(result['image'])} bytes (base64)")

    # Close without saving
    print("\n--- Close ---")
    test_endpoint("POST", "/excel/close", {"save": False})

    print("\n[Excel Tests Complete]")


def test_powerpoint_features():
    """Test all PowerPoint features"""
    print("\n" + "=" * 50)
    print("=== Microsoft PowerPoint Tests ===")
    print("=" * 50)

    # Basic operations
    print("\n--- Basic Operations ---")
    test_endpoint("POST", "/powerpoint/launch")
    time.sleep(1)
    test_endpoint("POST", "/powerpoint/create")

    # Add slides
    print("\n--- Add Slides ---")
    test_endpoint("POST", "/powerpoint/add_slide", {"layout": 1})  # Title slide
    test_endpoint("POST", "/powerpoint/add_slide", {"layout": 2})  # Title and content
    test_endpoint("GET", "/powerpoint/get_slide_count")

    # Write text to slide
    print("\n--- Write Text ---")
    test_endpoint("POST", "/powerpoint/write_text", {
        "slide": 1,
        "shape": 1,
        "text": "Presentation Title"
    })
    test_endpoint("POST", "/powerpoint/write_text", {
        "slide": 1,
        "shape": 2,
        "text": "Subtitle goes here"
    })

    # Add textbox
    print("\n--- Add Textbox ---")
    test_endpoint("POST", "/powerpoint/add_textbox", {
        "slide": 2,
        "text": "Custom textbox content",
        "left": 100,
        "top": 300,
        "width": 400,
        "height": 50
    })

    # Set font
    print("\n--- Set Font ---")
    test_endpoint("POST", "/powerpoint/set_font", {
        "slide": 1,
        "shape": 1,
        "font_name": "Arial",
        "font_size": 44,
        "bold": True,
        "color": "#0066CC"
    })

    # Read slide content
    print("\n--- Read Slide ---")
    result = test_endpoint("POST", "/powerpoint/read_slide", {"slide": 1})
    if result.get("success"):
        print(f"       Shapes: {len(result.get('shapes', []))}")

    # Set background
    print("\n--- Set Background ---")
    test_endpoint("POST", "/powerpoint/set_background", {
        "slide": 2,
        "color": "#E0E0E0"
    })

    # Add animation
    print("\n--- Add Animation ---")
    test_endpoint("POST", "/powerpoint/add_animation", {
        "slide": 1,
        "shape": 1,
        "effect": "fade",
        "trigger": "on_click"
    })

    # Screenshot
    print("\n--- Screenshot ---")
    result = test_endpoint("GET", "/powerpoint/screenshot")
    if result.get("success") and result.get("image"):
        print(f"       Screenshot captured: {len(result['image'])} bytes (base64)")

    # Close without saving
    print("\n--- Close ---")
    test_endpoint("POST", "/powerpoint/close", {"save": False})

    print("\n[PowerPoint Tests Complete]")


def main():
    """Run all tests"""
    print("=" * 60)
    print("Office Automation Server - Comprehensive Feature Test")
    print("=" * 60)

    # Health check
    health = test_health()
    if not health.get("success"):
        print("\n[ERROR] Server not running! Please start the server first.")
        return

    print(f"\nServer Status: {health.get('status')}")
    print(f"Version: {health.get('version')}")

    try:
        # Test Word
        test_word_features()
        time.sleep(1)

        # Test Excel
        test_excel_features()
        time.sleep(1)

        # Test PowerPoint
        test_powerpoint_features()

    except KeyboardInterrupt:
        print("\n\n[Interrupted by user]")

    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
