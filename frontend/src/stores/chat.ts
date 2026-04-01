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
     * 处理 Gateway 发来的 chat 事件（实现流式消息）
     * Reference: old code renderer/app.js handleChatMessage
     */
    handleChatMessage(payload: any) {
      console.log('=== Handling chat message ===', payload)
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

      // Check if sessionKey matches current session (handle potential format differences)
      const isCurrentSession = sessionKey === this.currentSessionKey
      console.log('Is current session:', isCurrentSession)

      // Ensure message array exists - create new object for reactivity
      if (!this.messages[sessionKey]) {
        console.log('Creating new message array for session:', sessionKey)
        // Create new object to trigger reactivity
        this.messages = { ...this.messages, [sessionKey]: [] }
      }

      messages.forEach((msg: any) => {
        // Normalize role
        let role = msg.role || msg.sender || msg.type || msg.author || 'unknown'
        if (role === 'bot' || role === 'ai' || role === 'model') {
          role = 'assistant'
        } else if (role === 'human') {
          role = 'user'
        }

        // Handle content
        let content = msg.content || msg.text || msg.body || msg.message || ''
        if (Array.isArray(content)) {
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

        // If we're currently streaming an assistant message, use the existing ID
        const messageId = (role === 'assistant' && this.streamingMessageId) 
          ? this.streamingMessageId 
          : (msg.id || `msg-${Date.now()}-${Math.random()}`)

        // Check if we're currently streaming an assistant message
        if (role === 'assistant' && this.streamingMessageId) {
          const existingIndex = this.messages[sessionKey].findIndex(m => m.id === this.streamingMessageId)
          console.log('Looking for streaming message:', this.streamingMessageId, 'found at index:', existingIndex)
          if (existingIndex !== -1) {
            // Update existing streaming message - use splice for reactivity
            console.log('Updating streaming message:', this.streamingMessageId, 'with content:', content.substring(0, 50))
            const updatedMessage = {
              ...this.messages[sessionKey][existingIndex],
              content,
              timestamp: msg.timestamp || msg.createdAt || Date.now()
            }
            this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
            this.resetStreamingTimeout()
            return
          } else {
            // Streaming message not found, reset state
            console.log('Streaming message not found, resetting')
            this.streamingMessageId = null
          }
        }

        // Check if this is the start of a new streaming response
        if (role === 'assistant' && !this.streamingMessageId) {
          const thinkingVisible = this.thinkingMessageId !== null
          const lastMsg = this.messages[sessionKey][this.messages[sessionKey].length - 1]
          const lastRole = lastMsg?.role
          const lastWasUser = lastRole === 'user'

          console.log('Assistant message, thinkingVisible:', thinkingVisible, 'lastWasUser:', lastWasUser)

          if (thinkingVisible || lastWasUser) {
            // This is the start of streaming - hide thinking and set up streaming state
            console.log('Starting new streaming message with id:', messageId)
            this.thinkingMessageId = null
            this.streamingMessageId = messageId

            const newMessage: Message = {
              id: messageId,
              role: 'assistant',
              content,
              timestamp: msg.timestamp || msg.createdAt || Date.now(),
              status: 'streaming'
            }

            // Use push for new messages
            this.messages[sessionKey].push(newMessage)
            this.resetStreamingTimeout()
            console.log('Added new streaming message, total messages:', this.messages[sessionKey].length)
            return
          }
        }

        // Check for existing message by ID
        const existingIndex = this.messages[sessionKey].findIndex(m => m.id === messageId)
        if (existingIndex !== -1) {
          // Update existing message - use splice for reactivity
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
            timestamp: msg.timestamp || msg.createdAt || Date.now(),
            status: 'sent'
          }
          this.messages[sessionKey].push(newMessage)

          // Clear streaming state if not assistant
          if (role !== 'assistant') {
            this.streamingMessageId = null
          }
        }
      })

      // Force reactivity update by creating new reference
      this.messages = { ...this.messages }
      console.log('Messages updated, total for session:', this.messages[sessionKey]?.length)
    }
  }
})
