/**
 * 日志相关类型定义
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  timestamp: number
  source: string
  message: string
  level: LogLevel
}

export interface LogOptions {
  level?: LogLevel
  limit?: number
  source?: string
}

export interface LogsState {
  logs: LogEntry[]
  filter: LogLevel | ''
  limit: number
  loading: boolean
}
