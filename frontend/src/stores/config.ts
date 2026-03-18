/**
 * 配置状态管理
 */

import { defineStore } from 'pinia'
import type { ConfigState } from '@/types/config'
import { getConfig, saveConfig } from '@/api/config'

export const useConfigStore = defineStore('config', {
  state: (): ConfigState => ({
    gateway: {
      url: 'ws://localhost:18789',
      token: '',
      password: ''
    },
    sessionsExpanded: true,
    lastSessionKey: undefined,
    sidebarWidth: 280
  }),

  getters: {
    hasConfig: (state) => !!state.gateway.url,
    isConnectedConfig: (state) => state.gateway.url !== 'ws://localhost:18789' ||
      !!state.gateway.token ||
      !!state.gateway.password
  },

  actions: {
    /**
     * 加载配置
     */
    async loadConfig() {
      try {
        const config = await getConfig()
        this.gateway = config.gateway
        this.sessionsExpanded = config.sessionsExpanded ?? true
        this.lastSessionKey = config.lastSessionKey
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    },

    /**
     * 保存配置
     */
    async save() {
      try {
        const success = await saveConfig({
          gateway: this.gateway,
          sessionsExpanded: this.sessionsExpanded,
          lastSessionKey: this.lastSessionKey
        })
        return success
      } catch (error) {
        console.error('Failed to save config:', error)
        return false
      }
    },

    /**
     * 更新 Gateway 配置
     */
    async updateGateway(config: { url: string; token?: string; password?: string }) {
      this.gateway = config
      return await this.save()
    },

    /**
     * 更新最后使用的会话
     */
    async updateLastSession(sessionKey: string) {
      this.lastSessionKey = sessionKey
      await this.save()
    },

    /**
     * 切换会话列表展开状态
     */
    async toggleSessionsExpanded() {
      this.sessionsExpanded = !this.sessionsExpanded
      await this.save()
    },

    /**
     * 设置会话列表展开状态
     */
    async setSessionsExpanded(expanded: boolean) {
      this.sessionsExpanded = expanded
      await this.save()
    },

    /**
     * 设置侧边栏宽度
     */
    setSidebarWidth(width: number) {
      this.sidebarWidth = Math.max(200, Math.min(800, width))
    }
  }
})
