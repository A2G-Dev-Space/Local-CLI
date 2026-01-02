"""
Build script for browser-server.exe
"""

import subprocess
import sys
import os

def main():
    print("Building browser-server.exe...")

    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # PyInstaller command
    cmd = [
        sys.executable, '-m', 'PyInstaller',
        '--onefile',
        '--name', 'browser-server',
        '--distpath', 'dist',
        '--workpath', 'build',
        '--specpath', 'build',
        '--hidden-import', 'selenium',
        '--hidden-import', 'webdriver_manager',
        '--hidden-import', 'flask',
        '--hidden-import', 'flask_cors',
        '--hidden-import', 'win32gui',
        '--hidden-import', 'win32con',
        '--clean',
        'server.py'
    ]

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=False)

    if result.returncode == 0:
        print("\nBuild successful!")
        print("Output: dist/browser-server.exe")
    else:
        print("\nBuild failed!")
        sys.exit(1)


if __name__ == '__main__':
    main()
