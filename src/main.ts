import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { GatewayClient } from './gateway-client';
import { ConfigManager } from './config-manager';
import { LogManager } from './log-manager';

// ============================================================================
// 关键：必须在任何app方法调用之前设置所有命令行参数
// ============================================================================

console.log('=== OpenClaw Electron 启动 ===');
console.log('平台:', process.platform);
console.log('架构:', process.arch);
console.log('Electron版本:', process.versions.electron);

// Windows 高DPI 支持 - 最强配置
if (process.platform === 'win32') {
  console.log('\n🔧 应用Windows高DPI设置...');

  const switches = [
    ['high-dpi-support', 'true'],
    ['force-device-scale-factor', '2'],
    ['enable-direct-write', 'true'],
    ['disable-gpu-vsync', 'true'],
    ['enable-zero-copy', 'true'],
  ];

  switches.forEach(([key, value]) => {
    app.commandLine.appendSwitch(key, value);
    console.log(`  ✓ ${key}=${value}`);
  });

  console.log('✅ 高DPI设置已应用\n');
}

let mainWindow: BrowserWindow | null = null;
let gatewayClient: GatewayClient | null = null;
let configManager: ConfigManager;
let logManager: LogManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      // 启用更好的字体渲染
      zoomFactor: 1.0,
    },
    title: 'OpenClaw Desktop Client',
    // 确保更好的渲染质量
    show: false,
    // 禁用透明度（透明窗口可能导致模糊）
    transparent: false,
    // 启用帧
    frame: true,
  });

  // 设置额外的渲染选项
  mainWindow.webContents.on('did-finish-load', () => {
    // 设置页面的缩放因子，确保在高DPI屏幕上清晰
    const scaleFactor = 1.0; // 可以根据需要调整
    mainWindow?.webContents.setZoomFactor(scaleFactor);
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 等待窗口加载完成后显示，避免视觉闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize managers
configManager = new ConfigManager();
logManager = new LogManager();

// IPC handlers
ipcMain.handle('get-config', async () => {
  return configManager.getConfig();
});

ipcMain.handle('save-config', async (event, config) => {
  return configManager.saveConfig(config);
});

ipcMain.handle('connect-gateway', async (event, config) => {
  try {
    if (gatewayClient) {
      gatewayClient.disconnect();
    }

    gatewayClient = new GatewayClient(config, logManager);

    gatewayClient.on('connected', (hello) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gateway-connected', hello);
      }
    });

    gatewayClient.on('disconnected', (reason) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gateway-disconnected', reason);
      }
    });

    gatewayClient.on('event', (evt) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gateway-event', evt);
      }
    });

    await gatewayClient.connect();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-gateway', async () => {
  try {
    if (gatewayClient) {
      await gatewayClient.disconnect();
      gatewayClient = null;
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-message', async (event, sessionKey, message, attachments) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.sendMessage(sessionKey, message, attachments);
    return { success: true, runId: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-chat-history', async (event, sessionKey, limit) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.getChatHistory(sessionKey, limit);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-sessions', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.listSessions(params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('resolve-session', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.resolveSession(params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agents-list', async () => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.listAgents();
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-logs', async (event, options) => {
  return logManager.getLogs(options);
});

ipcMain.handle('clear-logs', async () => {
  return logManager.clearLogs();
});

// Cron Jobs
ipcMain.handle('cron-list', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.listCronJobs(params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cron-add', async (event, job) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.addCronJob(job);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cron-update', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.updateCronJob(params.id, params.patch);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cron-remove', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.removeCronJob(params.id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cron-run', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.runCronJob(params.id, params.mode);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  // Notify gateway before closing
  if (gatewayClient) {
    gatewayClient.disconnect();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  // Ensure gateway disconnect is notified before quit
  if (gatewayClient) {
    gatewayClient.disconnect();
  }
});
