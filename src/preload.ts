import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  // Config
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<boolean>;

  // Gateway connection
  connectGateway: (config: any) => Promise<{ success: boolean; error?: string }>;
  disconnectGateway: () => Promise<{ success: boolean; error?: string }>;

  // Chat
  sendMessage: (sessionKey: string, message: string, attachments?: any[]) => Promise<{ success: boolean; runId?: string; error?: string }>;
  getChatHistory: (sessionKey: string, limit?: number) => Promise<{ success: boolean; data?: any; error?: string }>;

  // Sessions
  listSessions: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  resolveSession: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;

  // Logs
  getLogs: (options?: any) => Promise<any[]>;
  clearLogs: () => Promise<boolean>;

  // Events
  onGatewayConnected: (callback: (hello: any) => void) => void;
  onGatewayDisconnected: (callback: (reason: any) => void) => void;
  onGatewayEvent: (callback: (event: any) => void) => void;

  removeAllListeners: () => void;
}

const electronAPI: ElectronAPI = {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  connectGateway: (config) => ipcRenderer.invoke('connect-gateway', config),
  disconnectGateway: () => ipcRenderer.invoke('disconnect-gateway'),

  sendMessage: (sessionKey, message, attachments) =>
    ipcRenderer.invoke('send-message', sessionKey, message, attachments),
  getChatHistory: (sessionKey, limit) =>
    ipcRenderer.invoke('get-chat-history', sessionKey, limit),

  listSessions: (params) => ipcRenderer.invoke('list-sessions', params),
  resolveSession: (params) => ipcRenderer.invoke('resolve-session', params),

  getLogs: (options) => ipcRenderer.invoke('get-logs', options),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),

  onGatewayConnected: (callback) => {
    ipcRenderer.on('gateway-connected', (_event, hello) => callback(hello));
  },

  onGatewayDisconnected: (callback) => {
    ipcRenderer.on('gateway-disconnected', (_event, reason) => callback(reason));
  },

  onGatewayEvent: (callback) => {
    ipcRenderer.on('gateway-event', (_event, evt) => callback(evt));
  },

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('gateway-connected');
    ipcRenderer.removeAllListeners('gateway-disconnected');
    ipcRenderer.removeAllListeners('gateway-event');
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

type WindowWithElectronAPI = Window & {
  electronAPI: ElectronAPI;
};

declare const window: WindowWithElectronAPI;
export type { WindowWithElectronAPI };
