/**
 * Gateway 相关类型定义
 */

export interface GatewayConfig {
  url: string
  token?: string
  password?: string
}

export interface GatewayHello {
  version: string
  clientId: string
  serverTime: number
  capabilities?: string[]
}

export interface GatewayState {
  connected: boolean
  connecting: boolean
  error: string | null
  hello: GatewayHello | null
}

export interface GatewayEvent {
  type: string
  data?: any
  timestamp: number
}

export interface ConnectResult {
  success: boolean
  error?: string
}
