"""
Build script for Office Automation Server

This script builds the office-server.exe using PyInstaller.
Must be run on Windows with Python and all dependencies installed.

Usage:
    python build.py

Output:
    dist/office-server.exe
"""

import os
import sys
import subprocess
import shutil

def main():
    print("=" * 60)
    print("Office Server Build Script")
    print("=" * 60)

    # Check if running on Windows
    if sys.platform != 'win32':
        print("ERROR: This script must be run on Windows")
        sys.exit(1)

    # Check Python version
    print(f"Python version: {sys.version}")

    # Install dependencies
    print("\n[1/4] Installing dependencies...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], check=True)

    # Verify pywin32 is installed
    print("\n[2/4] Verifying pywin32...")
    try:
        import win32com.client
        import pythoncom
        print("  pywin32 OK")
    except ImportError as e:
        print(f"ERROR: pywin32 not properly installed: {e}")
        print("Try running: python -m pip install pywin32")
        print("Then run: python Scripts/pywin32_postinstall.py -install")
        sys.exit(1)

    # Clean previous builds
    print("\n[3/4] Cleaning previous builds...")
    for folder in ['build', 'dist']:
        if os.path.exists(folder):
            shutil.rmtree(folder)
            print(f"  Removed {folder}/")

    # Build with PyInstaller
    print("\n[4/4] Building with PyInstaller...")
    result = subprocess.run([
        sys.executable, '-m', 'PyInstaller',
        '--onefile',
        '--console',
        '--name', 'office-server',
        '--hidden-import', 'win32com',
        '--hidden-import', 'win32com.client',
        '--hidden-import', 'win32gui',
        '--hidden-import', 'win32ui',
        '--hidden-import', 'win32con',
        '--hidden-import', 'win32api',
        '--hidden-import', 'pythoncom',
        '--hidden-import', 'pywintypes',
        '--hidden-import', 'flask',
        '--hidden-import', 'flask_cors',
        '--hidden-import', 'PIL',
        '--hidden-import', 'PIL.Image',
        'server.py'
    ], check=False)

    if result.returncode != 0:
        print("\nERROR: PyInstaller build failed")
        sys.exit(1)

    # Check output
    exe_path = os.path.join('dist', 'office-server.exe')
    if os.path.exists(exe_path):
        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
        print("\n" + "=" * 60)
        print("BUILD SUCCESSFUL!")
        print("=" * 60)
        print(f"Output: {exe_path}")
        print(f"Size: {size_mb:.1f} MB")
        print("\nTo test:")
        print(f"  {exe_path} --port 8765")
        print("\nTo copy to bin folder:")
        print(f"  copy {exe_path} ..\\bin\\")
    else:
        print("\nERROR: Output file not found")
        sys.exit(1)


if __name__ == '__main__':
    main()
