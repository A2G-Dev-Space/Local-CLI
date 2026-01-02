"""
Browser Automation Server

Flask-based HTTP server that provides Selenium automation for Chrome/Edge browsers.
Designed to run on Windows and be called from WSL.

Usage:
    python server.py [--port 8766] [--host 0.0.0.0]

Or as compiled .exe:
    browser-server.exe [--port 8766]
"""

import os
import sys

import argparse
import base64
import json
import time
from typing import Optional, Dict, Any

# Flask for HTTP server
from flask import Flask, request, jsonify
from flask_cors import CORS

# Selenium for browser automation
from selenium import webdriver
# Note: Service classes not needed with Selenium 4.6+ built-in driver manager
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
# Note: Selenium 4.6+ has built-in driver manager, no need for webdriver_manager

# Windows API for window management
try:
    import win32gui
    import win32con
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from WSL

# Global browser instance
browser: Optional[webdriver.Chrome | webdriver.Edge] = None
browser_type: str = 'chrome'  # 'chrome' or 'edge'


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


def find_chrome_path() -> Optional[str]:
    """Find Chrome executable on Windows"""
    paths = [
        os.path.expandvars(r'%ProgramFiles%\Google\Chrome\Application\chrome.exe'),
        os.path.expandvars(r'%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe'),
        os.path.expandvars(r'%LocalAppData%\Google\Chrome\Application\chrome.exe'),
    ]
    for path in paths:
        if os.path.exists(path):
            return path
    return None


def find_edge_path() -> Optional[str]:
    """Find Edge executable on Windows"""
    paths = [
        os.path.expandvars(r'%ProgramFiles%\Microsoft\Edge\Application\msedge.exe'),
        os.path.expandvars(r'%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe'),
    ]
    for path in paths:
        if os.path.exists(path):
            return path
    return None


def bring_window_to_front(window_title_contains: str) -> bool:
    """Bring a window to the foreground by partial title match"""
    if not HAS_WIN32:
        return False

    def callback(hwnd, results):
        if win32gui.IsWindowVisible(hwnd):
            title = win32gui.GetWindowText(hwnd)
            if window_title_contains.lower() in title.lower():
                results.append(hwnd)
        return True

    results = []
    win32gui.EnumWindows(callback, results)

    if results:
        hwnd = results[0]
        try:
            # Restore if minimized
            if win32gui.IsIconic(hwnd):
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

            # Multiple methods to ensure window comes to front
            # Method 1: Show and activate
            win32gui.ShowWindow(hwnd, win32con.SW_SHOW)

            # Method 2: Bring to top
            win32gui.BringWindowToTop(hwnd)

            # Method 3: SetForegroundWindow with thread attach trick
            try:
                import win32process
                import win32api

                foreground_hwnd = win32gui.GetForegroundWindow()
                foreground_thread = win32process.GetWindowThreadProcessId(foreground_hwnd)[0]
                target_thread = win32process.GetWindowThreadProcessId(hwnd)[0]

                if foreground_thread != target_thread:
                    win32process.AttachThreadInput(foreground_thread, target_thread, True)
                    win32gui.SetForegroundWindow(hwnd)
                    win32process.AttachThreadInput(foreground_thread, target_thread, False)
                else:
                    win32gui.SetForegroundWindow(hwnd)
            except Exception:
                # Fallback: just try SetForegroundWindow
                win32gui.SetForegroundWindow(hwnd)

            return True
        except Exception as e:
            print(f"[bring_window_to_front] Error: {e}", flush=True)
            pass
    return False


# =============================================================================
# Health Check Endpoints
# =============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    global browser
    return jsonify({
        'success': True,
        'status': 'running',
        'version': '1.0.0',
        'browser': {
            'active': browser is not None,
            'type': browser_type if browser else None,
            'chrome_available': find_chrome_path() is not None,
            'edge_available': find_edge_path() is not None,
        }
    })


@app.route('/shutdown', methods=['POST'])
def shutdown():
    """Shutdown the server"""
    global browser
    try:
        if browser:
            browser.quit()
            browser = None
    except Exception:
        pass

    # Shutdown Flask
    func = request.environ.get('werkzeug.server.shutdown')
    if func:
        func()
    return jsonify({'success': True, 'message': 'Server shutting down'})


# =============================================================================
# Browser Control Endpoints
# =============================================================================

@app.route('/browser/launch', methods=['POST'])
def browser_launch():
    """Launch browser (Chrome or Edge)"""
    global browser, browser_type

    try:
        data = request.json or {}
        headless = data.get('headless', False)
        preferred_browser = data.get('browser', 'chrome')  # 'chrome' or 'edge'

        print(f"[launch] Starting browser launch: preferred={preferred_browser}, headless={headless}", flush=True)

        # Close existing browser if any
        if browser:
            try:
                browser.quit()
            except Exception:
                pass
            browser = None

        # Try Chrome first, then Edge
        if preferred_browser == 'chrome' and find_chrome_path():
            print("[launch] Chrome found, setting up options...", flush=True)
            options = ChromeOptions()
            if headless:
                options.add_argument('--headless=new')
            options.add_argument('--no-first-run')
            options.add_argument('--no-default-browser-check')
            options.add_argument('--disable-popup-blocking')
            options.add_argument('--disable-extensions')
            options.add_argument('--start-maximized')
            options.add_argument('--disable-gpu')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--no-sandbox')

            # Enable performance logging for network requests
            options.set_capability('goog:loggingPrefs', {
                'performance': 'ALL',
                'browser': 'ALL'
            })

            print("[launch] Starting Chrome browser (Selenium built-in driver manager)...", flush=True)
            # Selenium 4.6+ automatically manages chromedriver
            browser = webdriver.Chrome(options=options)
            browser_type = 'chrome'
            print("[launch] Chrome started successfully!", flush=True)

        elif find_edge_path():
            options = EdgeOptions()
            if headless:
                options.add_argument('--headless=new')
            options.add_argument('--no-first-run')
            options.add_argument('--no-default-browser-check')
            options.add_argument('--disable-popup-blocking')
            options.add_argument('--start-maximized')
            options.add_argument('--disable-gpu')

            # Enable performance logging for network requests
            options.set_capability('ms:loggingPrefs', {
                'performance': 'ALL',
                'browser': 'ALL'
            })

            # Selenium 4.6+ automatically manages edgedriver
            browser = webdriver.Edge(options=options)
            browser_type = 'edge'

        else:
            return jsonify(get_error_response('No browser found', 'Neither Chrome nor Edge is installed'))

        # Bring browser window to front
        if not headless:
            time.sleep(0.5)  # Wait for window to appear
            bring_window_to_front('Chrome' if browser_type == 'chrome' else 'Edge')

        return jsonify(get_success_response(f'{browser_type.title()} launched successfully', {
            'browser': browser_type,
            'headless': headless
        }))

    except Exception as e:
        return jsonify(get_error_response('Failed to launch browser', str(e)))


@app.route('/browser/close', methods=['POST'])
def browser_close():
    """Close the browser"""
    global browser

    try:
        if browser:
            browser.quit()
            browser = None
        return jsonify(get_success_response('Browser closed'))
    except Exception as e:
        return jsonify(get_error_response('Failed to close browser', str(e)))


@app.route('/browser/navigate', methods=['POST'])
def browser_navigate():
    """Navigate to a URL"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        data = request.json or {}
        url = data.get('url')

        if not url:
            return jsonify(get_error_response('URL is required'))

        browser.get(url)

        # Wait for page to load (up to 10 seconds)
        try:
            WebDriverWait(browser, 10).until(
                lambda d: d.execute_script('return document.readyState') == 'complete'
            )
        except TimeoutException:
            pass  # Continue anyway

        return jsonify(get_success_response('Navigated successfully', {
            'url': browser.current_url,
            'title': browser.title
        }))

    except Exception as e:
        return jsonify(get_error_response('Failed to navigate', str(e)))


@app.route('/browser/screenshot', methods=['GET'])
def browser_screenshot():
    """Take screenshot of the current page"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        full_page = request.args.get('full_page', 'false').lower() == 'true'

        if full_page:
            # Get full page dimensions
            total_height = browser.execute_script("return document.body.scrollHeight")
            total_width = browser.execute_script("return document.body.scrollWidth")

            # Set window size to capture full page
            browser.set_window_size(max(total_width, 1920), max(total_height, 1080))
            time.sleep(0.5)  # Wait for resize

        # Take screenshot
        screenshot_base64 = browser.get_screenshot_as_base64()

        return jsonify(get_success_response('Screenshot captured', {
            'image': screenshot_base64,
            'format': 'png',
            'encoding': 'base64',
            'url': browser.current_url,
            'title': browser.title
        }))

    except Exception as e:
        return jsonify(get_error_response('Failed to take screenshot', str(e)))


@app.route('/browser/click', methods=['POST'])
def browser_click():
    """Click an element by CSS selector"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        data = request.json or {}
        selector = data.get('selector')

        if not selector:
            return jsonify(get_error_response('Selector is required'))

        # Wait for element and click
        wait = WebDriverWait(browser, 10)
        element = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
        element.click()

        time.sleep(0.5)  # Wait for any page changes

        return jsonify(get_success_response('Element clicked', {
            'selector': selector,
            'current_url': browser.current_url
        }))

    except TimeoutException:
        return jsonify(get_error_response('Element not found or not clickable', f'Selector: {selector}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to click element', str(e)))


@app.route('/browser/fill', methods=['POST'])
def browser_fill():
    """Fill an input field"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        data = request.json or {}
        selector = data.get('selector')
        value = data.get('value', '')

        if not selector:
            return jsonify(get_error_response('Selector is required'))

        # Wait for element
        wait = WebDriverWait(browser, 10)
        element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))

        # Clear and fill
        element.clear()
        element.send_keys(value)

        return jsonify(get_success_response('Field filled', {
            'selector': selector,
            'length': len(value)
        }))

    except TimeoutException:
        return jsonify(get_error_response('Element not found', f'Selector: {selector}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to fill field', str(e)))


@app.route('/browser/get_text', methods=['POST'])
def browser_get_text():
    """Get text content of an element"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        data = request.json or {}
        selector = data.get('selector')

        if not selector:
            return jsonify(get_error_response('Selector is required'))

        # Wait for element
        wait = WebDriverWait(browser, 10)
        element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))

        return jsonify(get_success_response('Text retrieved', {
            'selector': selector,
            'text': element.text
        }))

    except TimeoutException:
        return jsonify(get_error_response('Element not found', f'Selector: {selector}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to get text', str(e)))


@app.route('/browser/get_info', methods=['GET'])
def browser_get_info():
    """Get current page information"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        return jsonify(get_success_response('Page info retrieved', {
            'url': browser.current_url,
            'title': browser.title
        }))

    except Exception as e:
        return jsonify(get_error_response('Failed to get page info', str(e)))


@app.route('/browser/get_html', methods=['GET'])
def browser_get_html():
    """Get page HTML source"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        html = browser.page_source

        return jsonify(get_success_response('HTML retrieved', {
            'url': browser.current_url,
            'title': browser.title,
            'html': html
        }))

    except Exception as e:
        return jsonify(get_error_response('Failed to get HTML', str(e)))


@app.route('/browser/execute_script', methods=['POST'])
def browser_execute_script():
    """Execute JavaScript on the page"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        data = request.json or {}
        script = data.get('script')

        if not script:
            return jsonify(get_error_response('Script is required'))

        result = browser.execute_script(script)

        # Convert result to JSON-serializable format
        if result is not None:
            try:
                json.dumps(result)  # Test if serializable
            except (TypeError, ValueError):
                result = str(result)

        return jsonify(get_success_response('Script executed', {
            'result': result
        }))

    except Exception as e:
        return jsonify(get_error_response('Failed to execute script', str(e)))


@app.route('/browser/get_console', methods=['GET'])
def browser_get_console():
    """Get browser console logs"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        # Get console logs (only works with Chrome)
        logs = []
        try:
            for entry in browser.get_log('browser'):
                logs.append({
                    'level': entry.get('level', 'INFO'),
                    'message': entry.get('message', ''),
                    'timestamp': entry.get('timestamp', 0)
                })
        except Exception:
            # Edge or other browsers may not support get_log
            pass

        return jsonify(get_success_response('Console logs retrieved', {
            'logs': logs,
            'count': len(logs)
        }))

    except Exception as e:
        return jsonify(get_error_response('Failed to get console logs', str(e)))


@app.route('/browser/wait_for', methods=['POST'])
def browser_wait_for():
    """Wait for an element to appear"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        data = request.json or {}
        selector = data.get('selector')
        timeout = data.get('timeout', 10)

        if not selector:
            return jsonify(get_error_response('Selector is required'))

        wait = WebDriverWait(browser, timeout)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))

        return jsonify(get_success_response('Element found', {
            'selector': selector
        }))

    except TimeoutException:
        return jsonify(get_error_response('Timeout waiting for element', f'Selector: {selector}'))
    except Exception as e:
        return jsonify(get_error_response('Failed to wait for element', str(e)))


@app.route('/browser/get_network', methods=['GET'])
def browser_get_network():
    """Get network request logs (requires performance logging enabled)"""
    global browser

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        # Get performance logs
        network_logs = []
        try:
            perf_logs = browser.get_log('performance')
            for entry in perf_logs:
                try:
                    message = json.loads(entry.get('message', '{}'))
                    msg = message.get('message', {})
                    method = msg.get('method', '')

                    # Filter for network events
                    if method.startswith('Network.'):
                        params = msg.get('params', {})

                        if method == 'Network.requestWillBeSent':
                            req = params.get('request', {})
                            network_logs.append({
                                'type': 'request',
                                'url': req.get('url', ''),
                                'method': req.get('method', ''),
                                'timestamp': entry.get('timestamp', 0),
                                'requestId': params.get('requestId', '')
                            })
                        elif method == 'Network.responseReceived':
                            resp = params.get('response', {})
                            network_logs.append({
                                'type': 'response',
                                'url': resp.get('url', ''),
                                'status': resp.get('status', 0),
                                'statusText': resp.get('statusText', ''),
                                'mimeType': resp.get('mimeType', ''),
                                'timestamp': entry.get('timestamp', 0),
                                'requestId': params.get('requestId', '')
                            })
                except (json.JSONDecodeError, KeyError):
                    continue
        except Exception as e:
            return jsonify(get_error_response('Failed to get performance logs', str(e)))

        return jsonify(get_success_response('Network logs retrieved', {
            'logs': network_logs,
            'count': len(network_logs)
        }))

    except Exception as e:
        return jsonify(get_error_response('Failed to get network logs', str(e)))


@app.route('/browser/focus', methods=['POST'])
def browser_focus():
    """Bring the browser window to the foreground"""
    global browser, browser_type

    try:
        if not browser:
            return jsonify(get_error_response('Browser not running', 'Use /browser/launch first'))

        # Try to bring window to front
        window_name = 'Chrome' if browser_type == 'chrome' else 'Edge'
        success = bring_window_to_front(window_name)

        if success:
            return jsonify(get_success_response('Browser window focused'))
        else:
            return jsonify(get_error_response('Failed to focus window', 'Window not found or win32gui not available'))

    except Exception as e:
        return jsonify(get_error_response('Failed to focus browser', str(e)))


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='Browser Automation Server')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8766, help='Port to listen on')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')

    args = parser.parse_args()

    print(f"Browser Automation Server starting on http://{args.host}:{args.port}")
    print("Endpoints:")
    print("  GET  /health                - Health check")
    print("  POST /shutdown              - Shutdown server")
    print("")
    print("  Browser:")
    print("  POST /browser/launch        - Launch browser")
    print("  POST /browser/close         - Close browser")
    print("  POST /browser/navigate      - Navigate to URL")
    print("  GET  /browser/screenshot    - Take screenshot")
    print("  POST /browser/click         - Click element")
    print("  POST /browser/fill          - Fill input field")
    print("  POST /browser/get_text      - Get element text")
    print("  GET  /browser/get_info      - Get page info (URL, title)")
    print("  GET  /browser/get_html      - Get page HTML source")
    print("  POST /browser/execute_script- Execute JavaScript")
    print("  GET  /browser/get_console   - Get console logs")
    print("  GET  /browser/get_network   - Get network request logs")
    print("  POST /browser/wait_for      - Wait for element")
    print("  POST /browser/focus         - Bring window to foreground")
    print("")
    print(f"Chrome: {'Found' if find_chrome_path() else 'Not found'}")
    print(f"Edge: {'Found' if find_edge_path() else 'Not found'}")
    print("")
    print("Press Ctrl+C to stop the server")

    app.run(host=args.host, port=args.port, debug=args.debug, threaded=True)


if __name__ == '__main__':
    main()
