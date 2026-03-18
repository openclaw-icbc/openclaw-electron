/**
 * 日志相关 API 封装
 */

import type { LogEntry, LogOptions } from '@/types/logs'

/**
 * 获取日志
 */
export async function getLogs(options?: LogOptions): Promise<LogEntry[]> {
  return await window.electronAPI.getLogs(options)
}

/**
 * 清除日志
 */
export async function clearLogs(): Promise<boolean> {
  return await window.electronAPI.clearLogs()
}
