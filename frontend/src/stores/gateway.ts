/**
 * Gateway 状态管理
 */

import { defineStore } from 'pinia'
import type { GatewayState, GatewayHello } from '@/types/gateway'
import { connectGateway, disconnectGateway, isConnected, onConnected, onDisconnected, onEvent } from '@/api/gateway'

export const useGatewayStore = defineStore('gateway', {
  state: (): GatewayState => ({
    connected: false,
    connecting: false,
    error: null,
    hello: null
  }),

  getters: {
    isConnected: (state) => state.connected && !state.connecting,
    hasError: (state) => !!state.error,
    errorMessage: (state) => state.error || '',
    serverTime: (state) => state.hello?.serverTime || 0,
    version: (state) => state.hello?.version || ''
  },

  actions: {
    /**
     * 连接到 Gateway
     */
    async connect(url: string, token?: string, password?: string) {
      this.connecting = true
      this.error = null

      try {
        await connectGateway({ url, token, password })

        // 检查连接状态
        const connected = await isConnected()
        this.connected = connected

        if (!connected) {
          throw new Error('连接超时')
        }

        return true
      } catch (error: any) {
        this.error = error.message || '连接失败'
        this.connected = false
        return false
      } finally {
        this.connecting = false
      }
    },

    /**
     * 断开连接
     */
    async disconnect() {
      try {
        await disconnectGateway()
        this.connected = false
        this.hello = null
        this.error = null
      } catch (error: any) {
        console.error('Failed to disconnect:', error)
        this.error = error.message || '断开连接失败'
      }
    },

    /**
     * 处理连接成功事件
     */
    handleConnected(hello: GatewayHello) {
      this.connected = true
      this.connecting = false
      this.hello = hello
      this.error = null
    },

    /**
     * 处理断开连接事件
     */
    handleDisconnected(reason?: string) {
      this.connected = false
      this.connecting = false
      if (reason) {
        this.error = reason
      }
    },

    /**
     * 设置错误状态
     */
    setError(error: string | null) {
      this.error = error
    },

    /**
     * 清除错误状态
     */
    clearError() {
      this.error = null
    },

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
      onConnected((hello) => {
        this.handleConnected(hello)
      })

      onDisconnected((reason) => {
        this.handleDisconnected(reason)
      })

      onEvent((event) => {
        console.log('Gateway event:', event)
        this.handleGatewayEvent(event)
      })
    },

    async handleGatewayEvent(event: any) {
      // Dynamic import to avoid circular dependency
      const { useChatStore } = await import('./chat')
      const chatStore = useChatStore()

      console.log('🔍🔍🔍 Gateway event received:', event.event)
      console.log(`  - event.event: ${event.event}`)
      console.log(`  - event.payload keys:`, event.payload ? Object.keys(event.payload) : 'null')

      // 处理 chat 事件（OpenClaw Gateway 的流式消息）
      if (event.event === 'chat' && event.payload) {
        const payload = event.payload
        console.log('✅✅✅ Processing chat event')
        console.log(`   - runId: ${payload.runId}`)
        console.log(`   - state: ${payload.state}`)
        console.log(`   - seq: ${payload.seq}`)

        // Handle chat messages from gateway
        chatStore.handleChatMessage(payload)
        return
      }

      // 处理 agent 事件（包含 runId、seq、stream 等字段的事件）
      if (event.event === 'agent' && event.payload) {
        const payload = event.payload
        console.log('✅✅✅ Processing agent event')
        console.log(`   - runId: ${payload.runId}`)
        console.log(`   - stream: ${payload.stream}`)
        console.log(`   - seq: ${payload.seq}`)

        // 将 agent 事件传递给 chatStore 处理
        chatStore.handleAgentEvent(payload)
        return
      }

      // 处理 session.tool 事件（工具事件）
      if (event.event === 'session.tool' && event.payload) {
        const payload = event.payload
        console.log('✅✅✅ Processing session.tool event')
        console.log(`   - runId: ${payload.runId}`)
        console.log(`   - stream: ${payload.stream}`)

        // session.tool 事件实际上也是 agent 事件，使用相同的处理方式
        chatStore.handleAgentEvent(payload)
        return
      }

      // 如果事件类型未知，记录警告
      console.warn(`⚠️ Unknown or unhandled event type: ${event.event}`)
      console.warn(`   Payload:`, event.payload)

      // 尝试检查是否是工具相关事件
      if (event.payload && typeof event.payload === 'object') {
        console.warn(`   Payload keys:`, Object.keys(event.payload))
        console.warn(`   Payload details:`, JSON.stringify(event.payload, null, 2).substring(0, 500))
      }
    }
  }
})
