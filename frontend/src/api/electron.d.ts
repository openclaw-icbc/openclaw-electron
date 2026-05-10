/**
 * Electron API 类型声明
 * 这个文件声明了从 preload.ts 暴露的 API
 */

import type { GatewayConfig, ConnectResult, GatewayHello, GatewayEvent } from '@/types/gateway'
import type { AppConfig } from '@/types/config'
import type { Message, Session, SendMessageParams } from '@/types/chat'
import type { LogEntry, LogOptions } from '@/types/logs'

export interface ElectronAPI {
  // 配置相关
  getConfig(): Promise<AppConfig>
  saveConfig(config: Partial<AppConfig>): Promise<boolean>

  // Gateway 连接相关
  connectGateway(config: GatewayConfig): Promise<ConnectResult>
  disconnectGateway(): Promise<{ success: boolean; error?: string }>
  isConnected(): Promise<boolean>

  // 聊天相关
  sendMessage(sessionKey: string, message: string, attachments?: any[]): Promise<{ success: boolean; runId?: string; error?: string }>
  getChatHistory(sessionKey: string, limit?: number): Promise<{ success: boolean; data?: any; error?: string }>
  abortChat(sessionKey: string, runId?: string): Promise<{ success: boolean; error?: string }>

  // 会话相关
  listSessions(params?: any): Promise<{ success: boolean; data?: any; error?: string }>
  resolveSession(params?: any): Promise<{ success: boolean; data?: any; error?: string }>
  createSession(params: any): Promise<{ success: boolean; data?: any; error?: string }>
  deleteSession(key: string, deleteTranscript?: boolean): Promise<{ success: boolean; error?: string }>
  patchSession(key: string, patch: any): Promise<{ success: boolean; error?: string }>

  // Agent 相关
  listAgents(): Promise<{ success: boolean; data?: any; error?: string }>

  // 定时任务相关
  listCronJobs(params?: any): Promise<{ success: boolean; data?: any; error?: string }>
  addCronJob(job: any): Promise<{ success: boolean; data?: any; error?: string }>
  updateCronJob(id: string, patch: any): Promise<{ success: boolean; data?: any; error?: string }>
  removeCronJob(id: string): Promise<{ success: boolean; data?: any; error?: string }>
  runCronJob(id: string, mode?: string): Promise<{ success: boolean; data?: any; error?: string }>

  // 日志相关
  getLogs(options?: LogOptions): Promise<LogEntry[]>
  clearLogs(): Promise<boolean>

  // 事件监听
  onGatewayConnected(callback: (hello: GatewayHello) => void): void
  onGatewayDisconnected(callback: (reason?: string) => void): void
  onGatewayEvent(callback: (event: GatewayEvent) => void): void
  removeAllListeners(channel?: string): void

  // 窗口控制
  minimizeWindow(): void
  maximizeWindow(): void
  unmaximizeWindow(): void
  isMaximized(): Promise<boolean>
  closeWindow(): void
  onWindowMaximizeChanged(callback: (maximized: boolean) => void): void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
