/**
 * 配置相关 API 封装
 */

import type { AppConfig } from '@/types/config'

/**
 * 获取配置
 */
export async function getConfig(): Promise<AppConfig> {
  return await window.electronAPI.getConfig()
}

/**
 * 保存配置
 */
export async function saveConfig(config: Partial<AppConfig>): Promise<boolean> {
  return await window.electronAPI.saveConfig(config)
}

/**
 * 更新 Gateway 配置
 */
export async function updateGatewayConfig(config: {
  url: string
  token?: string
  password?: string
}): Promise<boolean> {
  return await saveConfig({ gateway: config })
}
