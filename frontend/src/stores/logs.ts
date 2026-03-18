/**
 * 日志状态管理
 */

import { defineStore } from 'pinia'
import type { LogsState, LogEntry, LogLevel } from '@/types/logs'
import { getLogs, clearLogs as clearLogsApi } from '@/api/logs'

export const useLogsStore = defineStore('logs', {
  state: (): LogsState => ({
    logs: [],
    filter: '',
    limit: 500,
    loading: false
  }),

  getters: {
    filteredLogs: (state) => {
      let filtered = state.logs

      if (state.filter) {
        filtered = filtered.filter(log => log.level === state.filter)
      }

      return filtered.slice(0, state.limit)
    },

    hasLogs: (state) => state.logs.length > 0,

    logCount: (state) => state.logs.length,

    filteredLogCount: (state) => {
      let count = state.logs.length
      if (state.filter) {
        count = state.logs.filter(log => log.level === state.filter).length
      }
      return Math.min(count, state.limit)
    }
  },

  actions: {
    /**
     * 加载日志
     */
    async loadLogs() {
      try {
        this.loading = true
        const logs = await getLogs({
          level: this.filter || undefined,
          limit: this.limit
        })
        this.logs = logs
      } catch (error: any) {
        console.error('Failed to load logs:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 刷新日志
     */
    async refresh() {
      await this.loadLogs()
    },

    /**
     * 清除日志
     */
    async clearLogs() {
      try {
        const success = await clearLogsApi()
        if (success) {
          this.logs = []
        }
        return success
      } catch (error: any) {
        console.error('Failed to clear logs:', error)
        return false
      }
    },

    /**
     * 设置过滤器
     */
    setFilter(level: LogLevel | '') {
      this.filter = level
    },

    /**
     * 设置限制
     */
    setLimit(limit: number) {
      this.limit = Math.max(10, Math.min(5000, limit))
    }
  }
})
