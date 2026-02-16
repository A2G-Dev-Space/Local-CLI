/**
 * Electron shim for worker threads.
 * Worker threads cannot access Electron APIs.
 * This provides no-op stubs so modules that import 'electron' don't crash at load time.
 */

import os from 'os';
import path from 'path';

// Worker uses the same userData path as main process (AppData/Roaming/LOCAL-CLI-UI)
const workerUserData = path.join(os.homedir(), 'AppData', 'Roaming', 'LOCAL-CLI-UI');
const workerHome = path.join(os.homedir(), '.local-cli-ui');

export const app = {
  getPath: (name: string) => {
    switch (name) {
      case 'userData': return workerUserData;
      case 'home': return os.homedir();
      case 'temp': return os.tmpdir();
      case 'appData': return path.join(os.homedir(), 'AppData', 'Roaming');
      default: return workerHome;
    }
  },
  getVersion: () => '0.0.0',
  getName: () => 'worker',
  isPackaged: false,
};

export const shell = {
  showItemInFolder: () => {},
  openPath: async () => ({ error: 'Not available in worker' }),
  openExternal: async () => {},
};

export const dialog = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  showSaveDialog: async () => ({ canceled: true }),
  showMessageBox: async () => ({ response: 0 }),
};

export const BrowserWindow = null;
export const ipcMain = null;
export const ipcRenderer = null;
export const nativeTheme = { shouldUseDarkColors: false, themeSource: 'system' };

export default {
  app,
  shell,
  dialog,
  BrowserWindow,
  ipcMain,
  ipcRenderer,
  nativeTheme,
};
