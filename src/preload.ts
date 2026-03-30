import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  // Window Controls
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  unmaximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  // Config
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<boolean>;

  // Gateway connection
  connectGateway: (config: any) => Promise<{ success: boolean; error?: string }>;
  disconnectGateway: () => Promise<{ success: boolean; error?: string }>;
  isConnected: () => Promise<boolean>;

  // Chat
  sendMessage: (sessionKey: string, message: string, attachments?: any[]) => Promise<{ success: boolean; runId?: string; error?: string }>;
  getChatHistory: (sessionKey: string, limit?: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  abortChat: (sessionKey: string, runId?: string) => Promise<{ success: boolean; error?: string }>;

  // Sessions
  listSessions: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  resolveSession: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteSession: (key: string, deleteTranscript?: boolean) => Promise<{ success: boolean; error?: string }>;
  patchSession: (key: string, patch: any) => Promise<{ success: boolean; error?: string }>;

  // Agents
  listAgents: () => Promise<{ success: boolean; data?: any; error?: string }>;

  // Cron Jobs
  listCronJobs: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  addCronJob: (job: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateCronJob: (id: string, patch: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  removeCronJob: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  runCronJob: (id: string, mode?: string) => Promise<{ success: boolean; data?: any; error?: string }>;

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
  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  unmaximizeWindow: () => ipcRenderer.invoke('window-unmaximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Gateway connection
  connectGateway: (config) => ipcRenderer.invoke('connect-gateway', config),
  disconnectGateway: () => ipcRenderer.invoke('disconnect-gateway'),
  isConnected: () => ipcRenderer.invoke('is-connected'),

  sendMessage: (sessionKey, message, attachments) =>
    ipcRenderer.invoke('send-message', sessionKey, message, attachments),
  getChatHistory: (sessionKey, limit) =>
    ipcRenderer.invoke('get-chat-history', sessionKey, limit),
  abortChat: (sessionKey, runId) =>
    ipcRenderer.invoke('abort-chat', sessionKey, runId),

  listSessions: (params) => ipcRenderer.invoke('list-sessions', params),
  resolveSession: (params) => ipcRenderer.invoke('resolve-session', params),
  deleteSession: (key, deleteTranscript) => ipcRenderer.invoke('delete-session', key, deleteTranscript),
  patchSession: (key, patch) => ipcRenderer.invoke('patch-session', key, patch),

  listAgents: () => ipcRenderer.invoke('agents-list'),

  listCronJobs: (params) => ipcRenderer.invoke('cron-list', params),
  addCronJob: (job) => ipcRenderer.invoke('cron-add', job),
  updateCronJob: (id, patch) => ipcRenderer.invoke('cron-update', { id, patch }),
  removeCronJob: (id) => ipcRenderer.invoke('cron-remove', { id }),
  runCronJob: (id, mode) => ipcRenderer.invoke('cron-run', { id, mode }),

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
