/**
 * 配置相关类型定义
 */

export interface AppConfig {
  gateway: {
    url: string
    token?: string
    password?: string
  }
  lastSessionKey?: string
  windowBounds?: {
    width: number
    height: number
    x?: number
    y?: number
  }
  sessionsExpanded?: boolean
}

export interface ConfigState {
  gateway: {
    url: string
    token?: string
    password?: string
  }
  sessionsExpanded: boolean
  lastSessionKey?: string
  sidebarWidth: number
}
