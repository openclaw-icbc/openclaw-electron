/**
 * UI 状态管理
 */

import { defineStore } from 'pinia'
import type { UiState, Toast } from '@/types/ui'

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    sidebarWidth: 280,
    settingsDialogOpen: false,
    settingsActiveTab: 'sessions',
    loading: false,
    loadingMessage: '加载中...',
    toasts: []
  }),

  getters: {
    hasToasts: (state) => state.toasts.length > 0,
    toastCount: (state) => state.toasts.length
  },

  actions: {
    /**
     * 显示加载状态
     */
    showLoading(message = '加载中...') {
      this.loading = true
      this.loadingMessage = message
    },

    /**
     * 隐藏加载状态
     */
    hideLoading() {
      this.loading = false
      this.loadingMessage = '加载中...'
    },

    /**
     * 显示 Toast 通知
     */
    showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration = 3000) {
      const toast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        message,
        type,
        duration
      }

      this.toasts.push(toast)

      // 自动移除 Toast
      setTimeout(() => {
        this.removeToast(toast.id)
      }, duration)
    },

    /**
     * 移除 Toast
     */
    removeToast(id: string) {
      const index = this.toasts.findIndex(t => t.id === id)
      if (index !== -1) {
        this.toasts.splice(index, 1)
      }
    },

    /**
     * 清除所有 Toast
     */
    clearToasts() {
      this.toasts = []
    },

    /**
     * 打开设置对话框
     */
    openSettings(tab = 'sessions') {
      this.settingsDialogOpen = true
      this.settingsActiveTab = tab
    },

    /**
     * 关闭设置对话框
     */
    closeSettings() {
      this.settingsDialogOpen = false
    },

    /**
     * 切换设置标签
     */
    switchSettingsTab(tab: string) {
      this.settingsActiveTab = tab
    },

    /**
     * 设置侧边栏宽度
     */
    setSidebarWidth(width: number) {
      this.sidebarWidth = Math.max(200, Math.min(800, width))
    }
  }
})
