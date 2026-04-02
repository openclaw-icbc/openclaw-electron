/**
 * 聊天状态管理
 */

import { defineStore } from 'pinia'
import type { ChatState, Message, Session } from '@/types/chat'
import { sendMessage, getChatHistory, listSessions, deleteSession as deleteSessionApi, patchSession, abortChat } from '@/api/chat'

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    sessions: [],
    currentSessionKey: null,
    messages: {},
    thinkingMessageId: null,
    streamingMessageId: null,
    streamingTimeout: null as number | null,
    loading: false,
    currentRunId: null,
    isSending: false
  }),

  getters: {
    currentMessages: (state) => {
      if (!state.currentSessionKey) return []
      return state.messages[state.currentSessionKey] || []
    },
    currentSession: (state) => {
      if (!state.currentSessionKey) return null
      return state.sessions.find(s => s.key === state.currentSessionKey) || null
    },
    hasCurrentSession: (state) => !!state.currentSessionKey,
    sessionCount: (state) => state.sessions.length
  },

  actions: {
    /**
     * 加载会话列表
     */
    async loadSessions() {
      try {
        this.loading = true
        const response = await listSessions()

        // Gateway might return different data structures
        // Handle both array and object with sessions property
        let sessionsData = response
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          const resp = response as { sessions?: any; data?: any; items?: any }
          sessionsData = resp.sessions || resp.data || []
        }

        // Map Gateway session data to our Session interface
        this.sessions = Array.isArray(sessionsData)
          ? sessionsData.map((s: any) => ({
              key: s.key || s.sessionKey || s.id || '',
              label: s.label || s.title || s.name || s.key || 'Untitled',
              agentId: s.agentId || s.agent_id || s.agent || undefined,
              createdAt: s.createdAt || s.created_at || s.created || undefined,
              updatedAt: s.updatedAt || s.updated_at || s.updated || undefined,
              messageCount: s.messageCount || s.message_count || s.msgCount || s.messages || undefined,
              lastMessageAt: s.lastMessageAt || s.last_message_at || s.lastActivity || undefined,
              lastMessage: s.lastMessage || s.last_message || s.preview || undefined,
              metadata: s.metadata || s.meta || {},
              status: s.status || 'active'
            }))
          : []
      } catch (error: any) {
        console.error('Failed to load sessions:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 加载会话消息
     */
    async loadMessages(sessionKey: string) {
      if (!this.messages[sessionKey]) {
        this.messages[sessionKey] = []
      }

      try {
        this.loading = true
        const response = await getChatHistory(sessionKey)
        console.log('Raw chat history response from Gateway:', response)

        // Gateway might return different data structures
        let messagesData = response
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          const resp = response as { messages?: any; data?: any; items?: any }
          messagesData = resp.messages || resp.data || resp.items || []
        }

        // Map Gateway message data to our Message interface
        const messages = Array.isArray(messagesData)
          ? messagesData.map((msg: any) => {
              // Handle content that might be an array (OpenAI format) or string
              let content = msg.content || msg.text || msg.body || msg.message || ''
              if (Array.isArray(content)) {
                // Convert array content to string (extract text parts)
                content = content.map((part: any) => {
                  if (typeof part === 'string') return part
                  if (part && typeof part === 'object') {
                    // Handle OpenAI format content parts
                    if (part.type === 'text' && part.text) return part.text
                    if (part.type === 'image_url') return '[图片]'
                    if (part.type === 'tool_use' || part.type === 'tool_use_call') return `[工具调用: ${part.name || part.id || 'unknown'}]`
                    if (part.type === 'tool_result') return `[工具结果]`
                    if (part.content) return part.content
                    if (part.text) return part.text
                    // For unknown object types, try to extract useful info
                    if (part.type) return `[${part.type}]`
                    // Skip unknown objects
                    return ''
                  }
                  return String(part)
                }).filter(Boolean).join('')
              }

              return {
                id: msg.id || msg.messageId || msg.msgId || `msg-${Date.now()}-${Math.random()}`,
                role: msg.role || msg.sender || msg.type || 'user',
                content: content,
                timestamp: msg.timestamp || msg.createdAt || msg.created_at || msg.time || Date.now(),
                createdAt: msg.createdAt || msg.created_at || msg.timestamp || Date.now(),
                status: msg.status || 'sent',
                attachments: msg.attachments || [],
                metadata: msg.metadata || msg.meta || {}
              }
            })
          : []

        this.messages[sessionKey] = messages
        console.log(`Loaded ${messages.length} messages for session ${sessionKey}`)
      } catch (error: any) {
        console.error('Failed to load messages:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 发送消息
     */
    async sendMessage(sessionKey: string, content: string, attachments?: any[]) {
      console.log('Sending message to session:', sessionKey)
      console.log('Current session key:', this.currentSessionKey)
      try {
        // 添加用户消息到本地
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: Date.now(),
          status: 'sent',
          attachments
        }

        if (!this.messages[sessionKey]) {
          this.messages = { ...this.messages, [sessionKey]: [] }
        }
        this.messages[sessionKey].push(userMessage)
        // Force reactivity
        this.messages = { ...this.messages }

        // 清除之前的流式状态，设置思考状态
        this.streamingMessageId = null
        this.thinkingMessageId = `thinking-${Date.now()}`

        // 设置发送状态
        this.isSending = true

        // 发送到 Gateway
        const runId = await sendMessage({ sessionKey, message: content, attachments })
        console.log('Message sent, runId:', runId)

        // 保存当前 runId
        this.currentRunId = runId

        return runId
      } catch (error: any) {
        console.error('Failed to send message:', error)
        // 发送失败时清除思考状态
        this.thinkingMessageId = null
        this.isSending = false
        this.currentRunId = null
        throw error
      }
    },

    /**
     * 取消当前聊天
     */
    async abortCurrentChat() {
      if (!this.currentSessionKey) {
        console.warn('No current session to abort')
        return false
      }

      try {
        await abortChat(this.currentSessionKey, this.currentRunId || undefined)
        console.log('Chat aborted successfully')
        
        // 清除流式状态
        this.clearStreamingState()
        this.thinkingMessageId = null
        this.isSending = false
        this.currentRunId = null
        
        return true
      } catch (error: any) {
        console.error('Failed to abort chat:', error)
        throw error
      }
    },

    /**
     * 设置当前会话
     */
    setCurrentSession(sessionKey: string | null) {
      this.currentSessionKey = sessionKey
    },

    /**
     * 添加消息
     */
    addMessage(sessionKey: string, message: Message) {
      if (!this.messages[sessionKey]) {
        this.messages[sessionKey] = []
      }
      this.messages[sessionKey].push(message)
    },

    /**
     * 更新消息
     */
    updateMessage(sessionKey: string, messageId: string, updates: Partial<Message>) {
      if (!this.messages[sessionKey]) return

      const index = this.messages[sessionKey].findIndex(m => m.id === messageId)
      if (index !== -1) {
        this.messages[sessionKey][index] = {
          ...this.messages[sessionKey][index],
          ...updates
        }
      }
    },

    /**
     * 删除会话
     */
    async deleteSession(sessionKey: string, deleteTranscript = false) {
      try {
        await deleteSessionApi(sessionKey, deleteTranscript)

        // 从会话列表中移除
        this.sessions = this.sessions.filter(s => s.key !== sessionKey)

        // 如果删除的是当前会话，清除当前会话
        if (this.currentSessionKey === sessionKey) {
          this.currentSessionKey = null
        }

        // 删除消息缓存
        delete this.messages[sessionKey]
      } catch (error: any) {
        console.error('Failed to delete session:', error)
        throw error
      }
    },

    /**
     * 更新会话
     */
    async updateSession(sessionKey: string, patch: any) {
      try {
        await patchSession(sessionKey, patch)

        // 更新会话列表中的会话
        const index = this.sessions.findIndex(s => s.key === sessionKey)
        if (index !== -1) {
          this.sessions[index] = {
            ...this.sessions[index],
            ...patch
          }
        }
      } catch (error: any) {
        console.error('Failed to update session:', error)
        throw error
      }
    },

    /**
     * 添加本地会话（不调用 API）
     */
    addSession(session: any) {
      this.sessions.unshift(session)
    },

    /**
     * 设置思考消息ID
     */
    setThinkingMessage(messageId: string | null) {
      this.thinkingMessageId = messageId
    },

    /**
     * 设置流式消息ID
     */
    setStreamingMessage(messageId: string | null) {
      this.streamingMessageId = messageId
    },

    /**
     * 清除流式状态
     */
    clearStreamingState() {
      if (this.streamingMessageId) {
        console.log('💬 Streaming completed, clearing streamingMessageId')
        this.streamingMessageId = null
      }
      if (this.streamingTimeout) {
        clearTimeout(this.streamingTimeout)
        this.streamingTimeout = null
      }
      this.isSending = false
      this.currentRunId = null
    },

    /**
     * 重置流式超时
     */
    resetStreamingTimeout() {
      if (this.streamingTimeout) {
        clearTimeout(this.streamingTimeout)
      }
      // Auto-clear streaming state after 500ms of no updates
      this.streamingTimeout = setTimeout(() => {
        console.log('⏰ Streaming timeout, clearing streaming state')
        this.clearStreamingState()
      }, 500) as unknown as number
    },

    /**
     * 处理流式消息内容
     */
    appendStreamContent(sessionKey: string, messageId: string, content: string) {
      if (!this.messages[sessionKey]) return

      const message = this.messages[sessionKey].find(m => m.id === messageId)
      if (message) {
        message.content += content
      }
    },

    /**
     * 处理 Gateway 发来的 agent 事件（包含 tool 和 assistant 事件）
     *
     * Agent 事件格式：
     * - runId: 用于关联同一响应的所有片段
     * - seq: 序列号，递增
     * - stream: "assistant" | "tool" | "lifecycle" | "error"
     * - ts: 时间戳
     * - data: 事件数据
     * - sessionKey: 会话键
     */
    handleAgentEvent(payload: any) {
      console.log('=== Handling agent event ===', payload)
      const { runId, seq, stream, ts, data, sessionKey } = payload

      const targetSessionKey = sessionKey || this.currentSessionKey
      if (!targetSessionKey) {
        console.warn('No session key for agent event')
        return
      }

      // 确保消息数组存在
      if (!this.messages[targetSessionKey]) {
        this.messages = { ...this.messages, [targetSessionKey]: [] }
      }

      // 处理不同的流类型
      if (stream === 'assistant') {
        this.handleAssistantStreamEvent({ runId, seq, ts, data, sessionKey: targetSessionKey })
      } else if (stream === 'tool') {
        this.handleToolStreamEvent({ runId, seq, ts, data, sessionKey: targetSessionKey })
      } else if (stream === 'lifecycle') {
        this.handleLifecycleEvent({ runId, seq, ts, data, sessionKey: targetSessionKey })
      } else if (stream === 'error') {
        console.error('Agent error event:', data)
      }
    },

    /**
     * 处理 assistant 流式事件
     */
    handleAssistantStreamEvent(params: { runId: string; seq: number; ts: number; data: any; sessionKey: string }) {
      const { runId, data, sessionKey } = params
      const text = data?.text || ''
      const delta = data?.delta || ''

      console.log(`📝 Assistant stream: runId=${runId}, text="${text.substring(0, 50)}..."`)

      // 使用 runId 作为消息ID，所有同一 runId 的 assistant 事件更新同一条消息
      const messageId = runId
      const existingIndex = this.messages[sessionKey].findIndex(m => m.id === messageId)

      if (existingIndex !== -1) {
        // 更新现有消息
        const currentContent = this.messages[sessionKey][existingIndex].content
        const newContent = delta ? currentContent + delta : (text || currentContent)

        const updatedMessage = {
          ...this.messages[sessionKey][existingIndex],
          content: newContent,
          timestamp: Date.now(),
          status: 'streaming' as const
        }
        this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
        this.streamingMessageId = messageId
        this.resetStreamingTimeout()
      } else {
        // 创建新的 assistant 消息
        console.log(`✨ Creating new assistant message ${messageId}`)
        this.thinkingMessageId = null
        this.streamingMessageId = messageId

        const newMessage: Message = {
          id: messageId,
          role: 'assistant',
          content: delta || text,
          timestamp: Date.now(),
          status: 'streaming'
        }

        this.messages[sessionKey].push(newMessage)
        this.resetStreamingTimeout()
      }

      // 触发响应式更新
      this.messages = { ...this.messages }
    },

    /**
     * 处理 tool 流式事件
     */
    handleToolStreamEvent(params: { runId: string; seq: number; ts: number; data: any; sessionKey: string }) {
      const { runId, data, sessionKey } = params
      const phase = data?.phase // 'start' | 'update' | 'result'
      const name = data?.name || 'unknown_tool'
      const toolCallId = data?.toolCallId

      console.log(`🔧 Tool stream: runId=${runId}, phase=${phase}, name=${name}`)

      // 使用 runId-tool-toolCallId 作为消息ID，每个工具调用都有独立的消息气泡
      const messageId = `${runId}-tool-${toolCallId}`
      const existingIndex = this.messages[sessionKey].findIndex(m => m.id === messageId)

      if (phase === 'start') {
        // 工具开始执行
        if (existingIndex === -1) {
          const args = data?.args
          const argsPreview = this.formatToolArgs(args)

          const newMessage: Message = {
            id: messageId,
            role: 'system', // 使用 system 角色表示工具调用
            content: `🔧 调用工具: ${name}\n${argsPreview}`,
            timestamp: Date.now(),
            status: 'streaming',
            metadata: {
              type: 'tool_call',
              toolName: name,
              toolCallId,
              phase: 'start',
              args
            }
          }

          this.messages[sessionKey].push(newMessage)
        }
      } else if (phase === 'update') {
        // 工具执行过程中的增量更新
        if (existingIndex !== -1) {
          const partialResult = data?.partialResult
          const resultPreview = this.formatToolResult(partialResult)

          const updatedMessage = {
            ...this.messages[sessionKey][existingIndex],
            content: `${this.messages[sessionKey][existingIndex].content}\n${resultPreview}`,
            timestamp: Date.now(),
            status: 'streaming' as const,
            metadata: {
              ...this.messages[sessionKey][existingIndex].metadata,
              phase: 'update',
              partialResult
            }
          }
          this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
        }
      } else if (phase === 'result') {
        // 工具执行完成
        const isError = data?.isError || false
        const result = data?.result
        const resultPreview = this.formatToolResult(result)

        if (existingIndex !== -1) {
          const updatedMessage = {
            ...this.messages[sessionKey][existingIndex],
            content: `🔧 工具: ${name}${isError ? ' ❌' : ' ✅'}\n${resultPreview}`,
            timestamp: Date.now(),
            status: isError ? 'error' : 'sent',
            metadata: {
              ...this.messages[sessionKey][existingIndex].metadata,
              phase: 'result',
              result,
              isError
            }
          }
          this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
        } else {
          // 如果没有 start 事件，直接创建结果消息
          const newMessage: Message = {
            id: messageId,
            role: 'system',
            content: `🔧 工具: ${name}${isError ? ' ❌' : ' ✅'}\n${resultPreview}`,
            timestamp: Date.now(),
            status: isError ? 'error' : 'sent',
            metadata: {
              type: 'tool_result',
              toolName: name,
              toolCallId,
              result,
              isError
            }
          }
          this.messages[sessionKey].push(newMessage)
        }
      }

      // 触发响应式更新
      this.messages = { ...this.messages }
    },

    /**
     * 处理 lifecycle 事件
     */
    handleLifecycleEvent(params: { runId: string; seq: number; ts: number; data: any; sessionKey: string }) {
      const { runId, data, sessionKey } = params
      const phase = data?.phase // 'start' | 'end' | 'error'

      console.log(`🔄 Lifecycle event: runId=${runId}, phase=${phase}`)

      if (phase === 'start') {
        // 响应开始
        console.log('📌 Agent run started:', runId)
      } else if (phase === 'end' || phase === 'error') {
        // 响应结束，完成流式状态
        const messageId = runId
        const existingIndex = this.messages[sessionKey].findIndex(m => m.id === messageId)

        if (existingIndex !== -1) {
          const updatedMessage = {
            ...this.messages[sessionKey][existingIndex],
            status: phase === 'error' ? 'error' : 'sent',
            timestamp: Date.now()
          }
          this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
        }

        // 清除流式状态
        this.clearStreamingState()
        console.log('🏁 Agent run ended:', runId)
      }
    },

    /**
     * 格式化工具参数
     */
    formatToolArgs(args: any): string {
      if (!args) return ''
      try {
        const argsStr = typeof args === 'string' ? args : JSON.stringify(args, null, 2)
        return argsStr.length > 200 ? argsStr.substring(0, 200) + '...' : argsStr
      } catch {
        return String(args)
      }
    },

    /**
     * 格式化工具结果
     */
    formatToolResult(result: any): string {
      if (!result) return ''
      try {
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        return resultStr.length > 500 ? resultStr.substring(0, 500) + '...' : resultStr
      } catch {
        return String(result)
      }
    },

    /**
     * 处理 Gateway 发来的 chat 事件（实现流式消息）
     * Reference: old code renderer/app.js handleChatMessage
     *
     * OpenClaw Gateway 事件格式：
     * - runId: 用于关联同一响应的所有片段
     * - seq: 序列号，递增
     * - state: "delta"（增量）| "final"（完成）| "error"（错误）| "aborted"（中止）
     * - message: 包含 role, content, timestamp
     */
    handleChatMessage(payload: any) {
      console.log('=== Handling chat message ===', payload)

      // 处理新的流式事件格式（来自 OpenClaw Gateway）
      if (payload.runId && payload.state) {
        this.handleStreamingChatEvent(payload)
        return
      }

      // 兼容旧的消息格式
      console.log('Handling legacy message format')
      this.handleLegacyChatMessage(payload)
    },

    /**
     * 处理 OpenClaw Gateway 的流式聊天事件
     */
    handleStreamingChatEvent(payload: any) {
      const { runId, sessionKey, seq, state, message, stopReason } = payload

      console.log(`📨 Chat event: runId=${runId}, seq=${seq}, state=${state}`)

      const targetSessionKey = sessionKey || this.currentSessionKey
      if (!targetSessionKey) {
        console.warn('No session key for message')
        return
      }

      // 确保消息数组存在
      if (!this.messages[targetSessionKey]) {
        this.messages = { ...this.messages, [targetSessionKey]: [] }
      }

      // 使用 runId 作为消息ID，确保同一响应的所有片段更新到同一条消息
      const messageId = runId
      const existingIndex = this.messages[targetSessionKey].findIndex(m => m.id === messageId)

      if (state === 'delta' || state === 'aborted') {
        // 增量更新：创建新消息或更新现有消息
        if (existingIndex !== -1) {
          // 更新现有消息
          console.log(`📝 Updating message ${messageId} with delta`)
          const updatedMessage = {
            ...this.messages[targetSessionKey][existingIndex],
            content: this.extractMessageContent(message),
            timestamp: message?.timestamp || Date.now(),
            status: 'streaming' as const
          }
          this.messages[targetSessionKey].splice(existingIndex, 1, updatedMessage)

          // 更新流式状态
          if (state === 'delta') {
            this.streamingMessageId = messageId
            this.resetStreamingTimeout()
          }
        } else {
          // 创建新的流式消息
          console.log(`✨ Creating new streaming message ${messageId}`)
          this.thinkingMessageId = null
          this.streamingMessageId = messageId

          const newMessage: Message = {
            id: messageId,
            role: message?.role || 'assistant',
            content: this.extractMessageContent(message),
            timestamp: message?.timestamp || Date.now(),
            status: 'streaming'
          }

          this.messages[targetSessionKey].push(newMessage)
          this.resetStreamingTimeout()
        }
      } else if (state === 'final') {
        // 最终消息：完成流式状态
        console.log(`✅ Finalizing message ${messageId}`)
        if (existingIndex !== -1) {
          // 更新现有消息为完成状态
          const content = this.extractMessageContent(message)
          const updatedMessage = {
            ...this.messages[targetSessionKey][existingIndex],
            // 如果有新内容则更新，否则保持原内容
            content: content || this.messages[targetSessionKey][existingIndex].content,
            timestamp: message?.timestamp || Date.now(),
            status: 'sent' as const
          }
          this.messages[targetSessionKey].splice(existingIndex, 1, updatedMessage)
        } else {
          // 如果消息不存在且有效内容，创建最终消息
          const content = this.extractMessageContent(message)
          if (content && content.trim()) {
            const newMessage: Message = {
              id: messageId,
              role: message?.role || 'assistant',
              content,
              timestamp: message?.timestamp || Date.now(),
              status: 'sent'
            }
            this.messages[targetSessionKey].push(newMessage)
          }
        }

        // 清除流式状态
        this.clearStreamingState()
      } else if (state === 'error') {
        console.error(`❌ Error in message ${messageId}:`, payload.errorMessage)
        // 错误状态：如果有消息，将其标记为错误状态；否则清除流式状态
        if (existingIndex !== -1) {
          const updatedMessage = {
            ...this.messages[targetSessionKey][existingIndex],
            status: 'error' as const,
            metadata: {
              ...this.messages[targetSessionKey][existingIndex].metadata,
              errorMessage: payload.errorMessage
            }
          }
          this.messages[targetSessionKey].splice(existingIndex, 1, updatedMessage)
        }
        this.clearStreamingState()
      }

      // 触发响应式更新
      this.messages = { ...this.messages }
      console.log(`📊 Total messages for session: ${this.messages[targetSessionKey]?.length}`)
    },

    /**
     * 从消息对象中提取文本内容
     */
    extractMessageContent(message: any): string {
      if (!message) return ''

      let content = message.content || message.text || ''

      // 处理 OpenAI 格式的内容数组
      if (Array.isArray(content)) {
        content = content.map((part: any) => {
          if (typeof part === 'string') return part
          if (part && typeof part === 'object') {
            if (part.type === 'text' && part.text) return part.text
            if (part.type === 'image_url') return '[图片]'
            if (part.type === 'tool_use' || part.type === 'tool_use_call') return `[工具调用: ${part.name || part.id || 'unknown'}]`
            if (part.type === 'tool_result') return `[工具结果]`
            if (part.content) return part.content
            if (part.text) return part.text
            if (part.type) return `[${part.type}]`
            return ''
          }
          return String(part)
        }).filter(Boolean).join('')
      }

      return content
    },

    /**
     * 处理旧格式的聊天消息（向后兼容）
     */
    handleLegacyChatMessage(payload: any) {
      console.log('=== Handling legacy chat message ===', payload)
      console.log('Current session key:', this.currentSessionKey)
      console.log('Current thinkingMessageId:', this.thinkingMessageId)
      console.log('Current streamingMessageId:', this.streamingMessageId)

      // Handle different payload structures
      let messages: any[] = []

      if (payload.messages && Array.isArray(payload.messages)) {
        messages = payload.messages
      } else if (payload.message) {
        messages = [payload.message]
      } else if (payload.content || payload.text) {
        messages = [payload]
      } else {
        console.warn('Unknown payload structure:', payload)
        return
      }

      let sessionKey = payload.sessionKey || this.currentSessionKey
      console.log('Target session key from payload:', payload.sessionKey)
      console.log('Current session key:', this.currentSessionKey)
      console.log('Using session key:', sessionKey)

      if (!sessionKey) {
        console.warn('No session key for message')
        return
      }

      // Ensure message array exists
      if (!this.messages[sessionKey]) {
        this.messages = { ...this.messages, [sessionKey]: [] }
      }

      messages.forEach((msg: any) => {
        const role = this.normalizeRole(msg)
        const content = this.extractMessageContent(msg)
        const messageId = msg.id || `msg-${Date.now()}-${Math.random()}`
        const timestamp = msg.timestamp || msg.createdAt || Date.now()

        // Check if we're currently streaming an assistant message
        if (role === 'assistant' && this.streamingMessageId) {
          const existingIndex = this.messages[sessionKey].findIndex(m => m.id === this.streamingMessageId)
          if (existingIndex !== -1) {
            // Update existing streaming message
            const updatedMessage = {
              ...this.messages[sessionKey][existingIndex],
              content,
              timestamp
            }
            this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
            this.resetStreamingTimeout()
            return
          } else {
            // Streaming message not found, reset state
            this.streamingMessageId = null
          }
        }

        // Check if this is the start of a new streaming response
        if (role === 'assistant' && !this.streamingMessageId) {
          const thinkingVisible = this.thinkingMessageId !== null
          const lastMsg = this.messages[sessionKey][this.messages[sessionKey].length - 1]
          const lastRole = lastMsg?.role
          const lastWasUser = lastRole === 'user'

          if (thinkingVisible || lastWasUser) {
            // This is the start of streaming
            this.thinkingMessageId = null
            this.streamingMessageId = messageId

            const newMessage: Message = {
              id: messageId,
              role: 'assistant',
              content,
              timestamp,
              status: 'streaming'
            }

            this.messages[sessionKey].push(newMessage)
            this.resetStreamingTimeout()
            return
          }
        }

        // Check for existing message by ID
        const existingIndex = this.messages[sessionKey].findIndex(m => m.id === messageId)
        if (existingIndex !== -1) {
          // Update existing message
          const updatedMessage = {
            ...this.messages[sessionKey][existingIndex],
            content
          }
          this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
        } else {
          // Add new message
          const newMessage: Message = {
            id: messageId,
            role,
            content,
            timestamp,
            status: 'sent'
          }
          this.messages[sessionKey].push(newMessage)

          // Clear streaming state if not assistant
          if (role !== 'assistant') {
            this.streamingMessageId = null
          }
        }
      })

      // Force reactivity update
      this.messages = { ...this.messages }
      console.log('Messages updated, total for session:', this.messages[sessionKey]?.length)
    },

    /**
     * 标准化消息角色
     */
    normalizeRole(msg: any): string {
      let role = msg.role || msg.sender || msg.type || msg.author || 'unknown'
      if (role === 'bot' || role === 'ai' || role === 'model') {
        role = 'assistant'
      } else if (role === 'human') {
        role = 'user'
      }
      return role
    }
  }
})
