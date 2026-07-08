import type { TeamConfig } from './team'

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
  expertsExpanded?: boolean
  teams?: TeamConfig[]
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
  expertsExpanded: boolean
}
