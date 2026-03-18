/**
 * Gateway 相关 API 封装
 */

import type { GatewayConfig, GatewayHello, GatewayEvent } from '@/types/gateway'

/**
 * 连接到 Gateway
 */
export async function connectGateway(config: GatewayConfig): Promise<void> {
  const result = await window.electronAPI.connectGateway(config)
  if (!result.success) {
    throw new Error(result.error || '连接失败')
  }
}

/**
 * 断开 Gateway 连接
 */
export async function disconnectGateway(): Promise<void> {
  const result = await window.electronAPI.disconnectGateway()
  if (!result.success) {
    throw new Error(result.error || '断开连接失败')
  }
}

/**
 * 检查连接状态
 */
export async function isConnected(): Promise<boolean> {
  return await window.electronAPI.isConnected()
}

/**
 * 监听连接成功事件
 */
export function onConnected(callback: (hello: GatewayHello) => void): void {
  window.electronAPI.onGatewayConnected(callback)
}

/**
 * 监听断开连接事件
 */
export function onDisconnected(callback: (reason?: string) => void): void {
  window.electronAPI.onGatewayDisconnected(callback)
}

/**
 * 监听 Gateway 事件
 */
export function onEvent(callback: (event: GatewayEvent) => void): void {
  window.electronAPI.onGatewayEvent(callback)
}

/**
 * 移除所有事件监听器
 */
export function removeAllListeners(): void {
  window.electronAPI.removeAllListeners()
}
