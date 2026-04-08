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
    isSending: false,
    // 事件去重：跟踪已处理的事件 { "runId-seq": true }
    processedEvents: {} as Record<string, boolean>
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
     * 检查事件是否已处理（去重机制）
     * @param eventType 事件类型 ('chat' | 'agent')
     * @returns true表示事件已处理，应该跳过；false表示事件未处理，应该处理
     *
     * 重要：所有相关事件（chat、agent-assistant等）都应该使用统一的去重key
     * 以避免相同内容被多次处理
     */
    isEventProcessed(eventType: string, runId: string, seq: number): boolean {
      // 统一使用 runId-seq 作为去重key，忽略eventType
      // 因为chat事件和agent事件（stream='assistant'）可能包含相同内容
      const key = `${runId}-${seq}`

      if (this.processedEvents[key]) {
        console.log(`⚠️ Event already processed, skipping: ${key} (type: ${eventType})`)
        return true
      }

      // 标记为已处理
      this.processedEvents[key] = true

      // 清理旧的事件记录（只保留最近1000个）
      const keys = Object.keys(this.processedEvents)
      if (keys.length > 1000) {
        const toDelete = keys.slice(0, keys.length - 1000)
        toDelete.forEach(k => delete this.processedEvents[k])
      }

      console.log(`✅ Event marked as processed: ${key} (type: ${eventType})`)
      return false
    },

    /**
     * 清理已完成run的所有事件记录
     */
    clearProcessedEventsForRun(runId: string) {
      Object.keys(this.processedEvents).forEach(key => {
        if (key.startsWith(`${runId}-`)) {
          delete this.processedEvents[key]
        }
      })
    },

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
          this.messages[sessionKey] = []
        }
        this.messages[sessionKey].push(userMessage)
        // Push操作已经触发了响应式更新，不需要额外的force reactivity

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
     *
     * 注意：这个方法应该只在收到 lifecycle 事件的 phase=end/error 时调用
     * 不要在其他地方调用，也不要依赖超时机制
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
     * 启动流式超时（仅作为备份机制，防止服务器异常中断）
     *
     * 重要：
     * - 这个方法只在 lifecycle start 时调用一次
     * - 之后不会重置超时
     * - 只有在 lifecycle end/error 时才会清除超时
     * - 如果超时触发（60秒后），说明服务器可能崩溃了，强制清除状态
     *
     * 正常情况下，应该依赖 lifecycle 事件的 phase=end/error 来判断任务结束
     */
    startStreamingTimeout() {
      // 清除旧的超时（如果存在）
      if (this.streamingTimeout) {
        clearTimeout(this.streamingTimeout)
      }
      // 启动 60 秒超时，作为备份机制
      this.streamingTimeout = setTimeout(() => {
        console.warn('⚠️ Streaming timeout after 60s - server may have crashed')
        console.warn('   Force clearing streaming state as fallback')
        console.warn('   Current runId:', this.currentRunId)
        this.clearStreamingState()
      }, 60000) as unknown as number
      console.log('⏱️ Started 60s streaming timeout as safety fallback')
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
     * 处理 Gateway 发来的 agent 事件（包含 tool 和 lifecycle 事件）
     *
     * Agent 事件格式（根据 OpenClaw Gateway 协议）：
     * - runId: 用于关联同一响应的所有片段
     * - seq: 序列号，递增
     * - stream: "tool" | "lifecycle" | "error" | "reasoning" | "attachment"
     * - ts: 时间戳
     * - data: 事件数据
     * - sessionKey: 会话键
     *
     * 参考：websocket-integration-guide.md 第 400-526 行
     */
    handleAgentEvent(payload: any) {
      console.log('=== Handling agent event ===', payload)
      const { runId, seq, stream, ts, data, sessionKey: payloadSessionKey } = payload

      console.log(`📋 Agent event details:`)
      console.log(`  - runId: ${runId}`)
      console.log(`  - stream: ${stream}`)
      console.log(`  - seq: ${seq}`)
      console.log(`  - payload.sessionKey: ${payloadSessionKey}`)
      console.log(`  - this.currentSessionKey: ${this.currentSessionKey}`)

      // 重要：agent事件的assistant流与chat事件重复，直接跳过
      // chat事件已经处理了文本内容，agent的assistant流会导致重复
      if (stream === 'assistant') {
        console.log(`   - ⚠️ Ignoring agent assistant stream (duplicate of chat event)`)
        console.log(`   - Chat events should handle text content, not agent assistant stream`)
        return
      }

      // 事件去重检查（对其他流类型）
      if (this.isEventProcessed(`agent-${stream}`, runId, seq)) {
        console.log(`   - Skipping duplicate ${stream} event ${runId}-${seq}`)
        return
      }

      // 打印完整的 payload 结构以便调试
      if (!stream) {
        console.warn(`⚠️ No stream type found in payload!`)
        console.warn(`   Payload keys:`, Object.keys(payload))
        console.warn(`   Full payload:`, JSON.stringify(payload, null, 2).substring(0, 1000))
      }

      // 优先使用 payload 中的 sessionKey，如果没有则使用当前 sessionKey
      let targetSessionKey = payloadSessionKey || this.currentSessionKey

      if (!targetSessionKey) {
        console.warn('No session key for agent event')
        return
      }

      console.log(`  - targetSessionKey: ${targetSessionKey}`)

      // 确保消息数组存在（不触发响应式更新）
      if (!this.messages[targetSessionKey]) {
        console.log(`Creating new message array for session: ${targetSessionKey}`)
        this.messages[targetSessionKey] = []
      }

      console.log(`📊 Current messages count for session: ${this.messages[targetSessionKey]?.length || 0}`)

      // 处理不同的流类型
      if (stream === 'tool') {
        console.log('🎯 Found tool stream event!')
        this.handleToolStreamEvent({ runId, seq, ts, data, sessionKey: targetSessionKey })
      } else if (stream === 'lifecycle') {
        this.handleLifecycleEvent({ runId, seq, ts, data, sessionKey: targetSessionKey })
      } else if (stream === 'assistant') {
        // 处理 assistant stream - 包含增量文本内容
        console.log('📝 Found assistant stream event!')
        this.handleAssistantStreamEvent({ runId, seq, ts, data, sessionKey: targetSessionKey })
      } else if (stream === 'error') {
        console.error('Agent error event:', data)
        // 可以在这里创建一个错误消息气泡
        this.createAgentErrorMessage(targetSessionKey, runId, data)
      } else if (stream === 'reasoning') {
        console.log('💭 Reasoning event:', data)
        // 可以选择是否显示推理过程
      } else if (stream === 'attachment') {
        console.log('📎 Attachment event:', data)
      } else {
        console.warn(`Unknown stream type: ${stream}`)
        // 尝试打印更多信息以便调试
        if (data) {
          console.warn(`  - data.type: ${data.type}`)
          console.warn(`  - data keys:`, Object.keys(data))
        }
      }

      // 只在真正修改了messages后才触发响应式更新
      // 这里不做批量更新，让各个处理方法自己决定何时更新
    },

    /**
     * 处理 assistant 流式事件
     *
     * Assistant stream 包含增量文本内容，需要显示为消息
     * 根据 OpenClaw Gateway 的实际行为，assistant 事件包含文本增量
     *
     * 注意：此方法需要与handleStreamingChatEvent配合，避免创建重复消息
     * 统一使用${runId}-text作为消息ID，与chat事件保持一致
     */
    handleAssistantStreamEvent(params: { runId: string; seq: number; ts: number; data: any; sessionKey: string }) {
      const { runId, data, sessionKey, seq } = params
      const text = data?.text || ''
      const delta = data?.delta || ''

      console.log(`📝 Assistant stream: runId=${runId}, seq=${seq}`)
      console.log(`   - text: "${text.substring(0, 50)}..."`)
      console.log(`   - delta: "${delta.substring(0, 50)}..."`)

      // 确保消息数组存在
      if (!this.messages[sessionKey]) {
        this.messages[sessionKey] = []
      }

      // 使用 delta 或 text 作为内容
      const content = delta || text

      if (!content) {
        console.log(`   - No content to display`)
        return
      }

      // 统一使用 ${runId}-text 作为消息ID（与handleStreamingChatEvent保持一致）
      const messageId = `${runId}-text`
      const existingIndex = this.messages[sessionKey].findIndex(m => m.id === messageId)

      console.log(`   - Message ID: ${messageId}`)
      console.log(`   - Existing index: ${existingIndex}`)

      // 清除思考状态，设置流式状态（仅当当前运行仍在进行时）
      this.thinkingMessageId = null
      if (this.currentRunId === runId) {
        this.streamingMessageId = messageId
      }

      if (existingIndex !== -1) {
        // 追加内容到现有消息
        const currentContent = this.messages[sessionKey][existingIndex].content
        const appendedContent = this.appendTextContent(currentContent, content)

        console.log(`   - Appending: "${currentContent.substring(0, 30)}..." + "${content.substring(0, 30)}..."`)

        const updatedMessage = {
          ...this.messages[sessionKey][existingIndex],
          content: appendedContent,
          timestamp: Date.now(),
          status: 'streaming' as const
        }
        this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
      } else {
        // 创建新消息
        console.log(`✨✨✨ Creating new message from assistant stream: ${messageId}`)
        console.log(`   - Content: "${content.substring(0, 50)}..."`)

        const newMessage: Message = {
          id: messageId,
          role: 'assistant',
          content: content,
          timestamp: Date.now(),
          status: 'streaming',
          metadata: {
            contentType: 'text',
            seq,
            source: 'assistant_stream'
          }
        }

        this.messages[sessionKey].push(newMessage)
        console.log(`   - Total messages: ${this.messages[sessionKey].length}`)
      }

      // 使用splice触发响应式更新，但不需要创建新的messages对象
    },

    /**
     * 处理 tool 流式事件
     *
     * 根据 OpenClaw Gateway 协议，工具调用事件的 phases：
     * - start: 工具调用开始
     * - update: 工具执行中（增量更新）
     * - result: 工具执行完成（包含最终结果或错误）
     *
     * 工具执行错误通过 result 阶段的 data.isError 字段标识
     *
     * 参考：websocket-integration-guide.md 第 438-506 行
     */
    handleToolStreamEvent(params: { runId: string; seq: number; ts: number; data: any; sessionKey: string }) {
      const { runId, data, sessionKey, seq } = params
      const phase = data?.phase // 'start' | 'update' | 'result'
      const tool = data?.tool || data?.name || 'unknown_tool'
      const toolTitle = data?.toolTitle || tool
      const kind = data?.kind
      const toolCallId = data?.toolCallId || String(seq)

      console.log(`🔧🔧🔧 Tool stream: runId=${runId}, seq=${seq}, phase=${phase}, tool=${tool}, toolCallId=${toolCallId}`)
      console.log(`📊 Current messages count: ${this.messages[sessionKey]?.length || 0}`)

      // 确保消息数组存在
      if (!this.messages[sessionKey]) {
        this.messages[sessionKey] = []
      }

      // 使用 runId-tool-seq 作为消息ID，每个工具调用都有独立的消息气泡
      const messageId = `${runId}-tool-${seq}`
      const existingIndex = this.messages[sessionKey].findIndex(m => m.id === messageId)

      console.log(`🔍 Looking for message ${messageId}, found at index: ${existingIndex}`)

      if (phase === 'start') {
        // 工具开始执行
        if (existingIndex === -1) {
          const args = data?.args

          console.log(`✨✨✨ Creating new tool message: ${messageId}`)

          const newMessage: Message = {
            id: messageId,
            role: 'system',
            content: '', // ToolCallItem组件负责所有展示
            timestamp: Date.now(),
            status: 'streaming' as const,
            metadata: {
              type: 'tool_call' as const,
              toolName: tool,
              toolCallId,
              phase: 'start' as const,
              args,
              toolTitle,
              kind
            }
          }

          this.messages[sessionKey].push(newMessage)
          console.log(`✅ Tool message added, total messages: ${this.messages[sessionKey].length}`)
        }
      } else if (phase === 'update') {
        // 工具执行过程中的增量更新
        if (existingIndex !== -1) {
          const partialResult = data?.partialResult

          console.log(`📝 Updating tool message: ${messageId}`)

          const updatedMessage = {
            ...this.messages[sessionKey][existingIndex],
            content: '', // ToolCallItem组件负责所有展示
            timestamp: Date.now(),
            status: 'streaming' as const,
            metadata: {
              ...this.messages[sessionKey][existingIndex].metadata,
              phase: 'update' as const,
              partialResult
            }
          }
          this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
          console.log(`✅ Tool message updated`)
        }
      } else if (phase === 'result') {
        // 工具执行完成（包含成功或错误）
        const isError = data?.isError === true
        const result = data?.result
        const error = data?.error || data?.errorMessage

        console.log(`🏁🏁🏁 Tool ${tool} completed`)
        console.log(`   isError: ${isError}`)

        if (existingIndex !== -1) {
          const updatedMessage = {
            ...this.messages[sessionKey][existingIndex],
            content: '', // ToolCallItem组件负责所有展示
            timestamp: Date.now(),
            status: isError ? ('error' as const) : ('sent' as const),
            metadata: {
              ...this.messages[sessionKey][existingIndex].metadata,
              phase: 'result' as const,
              result,
              error,
              isError
            }
          }
          this.messages[sessionKey].splice(existingIndex, 1, updatedMessage)
          console.log(`✅ Tool message finalized`)
        } else {
          // 如果没有 start 事件，直接创建结果消息
          console.log(`✨ Creating tool result message (no start): ${messageId}`)
          const newMessage: Message = {
            id: messageId,
            role: 'system',
            content: '', // ToolCallItem组件负责所有展示
            timestamp: Date.now(),
            status: isError ? ('error' as const) : ('sent' as const),
            metadata: {
              type: isError ? ('tool_error' as const) : ('tool_result' as const),
              toolName: tool,
              toolCallId,
              toolTitle,
              result,
              error,
              phase: 'result' as const,
              isError
            }
          }
          this.messages[sessionKey].push(newMessage)
          console.log(`✅ Tool result message added, total messages: ${this.messages[sessionKey].length}`)
        }
      }

      console.log(`🔄 Tool stream event processed`)
    },

    /**
     * 处理 lifecycle 事件
     */
    handleLifecycleEvent(params: { runId: string; seq: number; ts: number; data: any; sessionKey: string }) {
      const { runId, data, sessionKey } = params
      const phase = data?.phase // 'start' | 'end' | 'error'

      console.log(`🔄 Lifecycle event: runId=${runId}, phase=${phase}`)

      if (phase === 'start') {
        // 响应开始 - 启动超时作为备份
        console.log('📌 Agent run started:', runId)
        this.startStreamingTimeout()
      } else if (phase === 'end' || phase === 'error') {
        // 响应结束，立即清除流式状态
        this.streamingMessageId = null
        this.thinkingMessageId = null

        // 响应结束，完成所有相关的流式消息
        console.log(`🏁 Agent run ${phase}: ${runId}`)

        // 完成所有与此 runId 相关的 streaming 消息
        const messagesToUpdate: Array<{ index: number; message: Message }> = []

        this.messages[sessionKey].forEach((msg, index) => {
          if (msg.id.startsWith(runId) && msg.status === 'streaming') {
            messagesToUpdate.push({
              index,
              message: {
                ...msg,
                status: (phase === 'error' ? 'error' : 'sent') as 'error' | 'sent',
                timestamp: Date.now()
              }
            })
            console.log(`   - Will finalize message: ${msg.id}`)
          }
        })

        // 从后往前更新，避免索引问题
        messagesToUpdate.reverse().forEach(({ index, message }) => {
          this.messages[sessionKey].splice(index, 1, message)
          console.log(`   - Finalized message at index ${index}`)
        })

        // 清理已处理的事件记录
        this.clearProcessedEventsForRun(runId)

        // 清除流式状态（包括超时）
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
     * 检测消息内容的类型
     *
     * 返回值：
     * - 'tool_call': 包含工具调用标记
     * - 'tool_result': 包含工具结果标记
     * - 'thinking': 包含思考标记
     * - 'text': 纯文本
     */
    detectContentType(content: string): 'tool_call' | 'tool_result' | 'thinking' | 'text' {
      if (!content) return 'text'

      if (content.includes('[工具调用:') || content.includes('[toolCall]')) {
        return 'tool_call'
      }
      if (content.includes('[工具结果]') || content.includes('[toolResult]')) {
        return 'tool_result'
      }
      if (content.includes('[thinking]')) {
        return 'thinking'
      }
      return 'text'
    },

    /**
     * 处理 OpenClaw Gateway 的流式聊天事件
     *
     * 根据 OpenClaw Gateway 协议：
     * - state: "delta" 表示增量更新，需要追加内容
     * - state: "final" 表示最终状态，消息完成
     * - state: "error" 表示错误
     * - state: "aborted" 表示被中止
     *
     * 参考：websocket-integration-guide.md 第 698-773 行
     *
     * 消息创建策略（关键修复）：
     * 1. 检测内容类型的变化
     * 2. 当内容类型变化时，创建新消息（使用 ${runId}-${contentType} 作为ID）
     * 3. 当内容类型相同时，追加到现有消息
     *
     * 这样可以确保工具调用、工具结果、最终回复分别显示在不同的消息气泡中
     */
    handleStreamingChatEvent(payload: any) {
      const { runId, sessionKey, seq, state, message, stopReason } = payload

      console.log(`📨📨📨 Chat event: runId=${runId}, seq=${seq}, state=${state}`)

      // 事件去重检查（使用统一的runId-seq key）
      if (this.isEventProcessed('chat', runId, seq)) {
        console.log(`   - Skipping duplicate chat event ${runId}-${seq}`)
        return
      }

      console.log(`   - ✅ Processing chat event ${runId}-${seq}`)

      const targetSessionKey = sessionKey || this.currentSessionKey
      if (!targetSessionKey) {
        console.warn('No session key for message')
        return
      }

      // 确保消息数组存在（不触发响应式更新）
      if (!this.messages[targetSessionKey]) {
        this.messages[targetSessionKey] = []
      }

      const newContent = this.extractMessageContent(message)
      const contentType = this.detectContentType(newContent)

      console.log(`   - Raw message:`, JSON.stringify(message).substring(0, 200))
      console.log(`   - Extracted content: "${newContent.substring(0, 100)}..."`)
      console.log(`   - Content type: ${contentType}`)
      console.log(`   - Will use message ID: ${runId}-${contentType}`)

      // 使用 runId-contentType 作为消息ID，这样不同类型的消息分开显示
      const messageId = `${runId}-${contentType}`

      // 查找现有消息
      const existingIndex = this.messages[targetSessionKey].findIndex(m => m.id === messageId)

      console.log(`   - Message ID: ${messageId}`)
      console.log(`   - Existing index: ${existingIndex} (${existingIndex === -1 ? 'will create new' : 'will update'})`)
      console.log(`   - Current messages:`, this.messages[targetSessionKey].map(m => ({ id: m.id, content: m.content.substring(0, 30) })))

      if (state === 'delta') {
        // 增量更新
        this.thinkingMessageId = null

        // 只有文本消息才设置 streamingMessageId（工具调用不应该显示游标）
        // 并且确保当前没有完成这个 runId
        if (contentType === 'text' && this.currentRunId === runId) {
          this.streamingMessageId = messageId
        }

        if (existingIndex !== -1) {
          // 追加内容到现有消息（相同类型）
          const currentContent = this.messages[targetSessionKey][existingIndex].content
          const appendedContent = this.appendTextContent(currentContent, newContent)

          console.log(`📝 Appending to message ${messageId}:`)
          console.log(`   - Current: "${currentContent.substring(0, 30)}..."`)
          console.log(`   - New: "${newContent.substring(0, 30)}..."`)
          console.log(`   - Result: "${appendedContent.substring(0, 30)}..."`)

          const updatedMessage = {
            ...this.messages[targetSessionKey][existingIndex],
            content: appendedContent,
            timestamp: message?.timestamp || Date.now(),
            status: 'streaming' as const
          }
          this.messages[targetSessionKey].splice(existingIndex, 1, updatedMessage)
        } else {
          // 创建新的流式消息（新类型）
          console.log(`✨✨✨ Creating new streaming message ${messageId} (type: ${contentType})`)
          console.log(`   - Content: "${newContent.substring(0, 50)}..."`)

          const newMessage: Message = {
            id: messageId,
            role: message?.role || 'assistant',
            content: newContent,
            timestamp: message?.timestamp || Date.now(),
            status: 'streaming',
            metadata: {
              contentType,
              seq
            }
          }

          this.messages[targetSessionKey].push(newMessage)
          console.log(`   - Total messages after push: ${this.messages[targetSessionKey].length}`)
          console.log(`   - All message IDs:`, this.messages[targetSessionKey].map(m => m.id))
        }
      } else if (state === 'final') {
        // 最终消息：完成所有相关的流式消息
        console.log(`✅ Finalizing all messages for run ${runId}`)

        // 立即清除所有流式状态（优先执行，确保UI立即更新）
        this.streamingMessageId = null
        this.thinkingMessageId = null
        this.isSending = false
        this.currentRunId = null

        // 完成所有与此 runId 相关的 streaming 消息
        const messagesToUpdate: Array<{ index: number; message: Message }> = []

        this.messages[targetSessionKey].forEach((msg, index) => {
          if (msg.id.startsWith(runId) && msg.status === 'streaming') {
            messagesToUpdate.push({
              index,
              message: {
                ...msg,
                status: 'sent' as const,
                timestamp: message?.timestamp || Date.now()
              }
            })
            console.log(`   - Will finalize message: ${msg.id}`)
          }
        })

        // 从后往前更新，避免索引问题
        messagesToUpdate.reverse().forEach(({ index, message }) => {
          this.messages[targetSessionKey].splice(index, 1, message)
          console.log(`   - Finalized message at index ${index}`)
        })

        // 清理已处理的事件记录
        this.clearProcessedEventsForRun(runId)
      } else if (state === 'error') {
        console.error(`❌ Error in run ${runId}:`, payload.errorMessage)
        // 立即清除所有流式状态
        this.streamingMessageId = null
        this.thinkingMessageId = null
        this.isSending = false
        this.currentRunId = null

        // 错误状态：标记所有相关消息为错误
        this.messages[targetSessionKey].forEach((msg, index) => {
          if (msg.id.startsWith(runId)) {
            const updatedMessage = {
              ...msg,
              status: 'error' as const,
              metadata: {
                ...msg.metadata,
                errorMessage: payload.errorMessage
              }
            }
            this.messages[targetSessionKey].splice(index, 1, updatedMessage)
          }
        })
        this.clearProcessedEventsForRun(runId)
      } else if (state === 'aborted') {
        console.log(`⏹️ Run ${runId} aborted`)
        // 立即清除所有流式状态
        this.streamingMessageId = null
        this.thinkingMessageId = null
        this.isSending = false
        this.currentRunId = null

        // 被中止：标记所有相关消息
        this.messages[targetSessionKey].forEach((msg, index) => {
          if (msg.id.startsWith(runId) && msg.status === 'streaming') {
            const updatedMessage = {
              ...msg,
              status: 'sent' as const,
              metadata: {
                ...msg.metadata,
                aborted: true
              }
            }
            this.messages[targetSessionKey].splice(index, 1, updatedMessage)
          }
        })
        this.clearProcessedEventsForRun(runId)
      }

      // 只在真正修改了messages后才触发响应式更新
      // 使用Vue的响应式系统来确保UI更新
      if (state === 'delta' || state === 'final' || state === 'error' || state === 'aborted') {
        // 使用splice或其他响应式方法来触发更新
        // 这里不需要做任何额外操作，因为我们已经修改了数组
      }
      console.log(`📊 Total messages for session: ${this.messages[targetSessionKey]?.length}`)
      console.log(`📊 Message IDs:`, this.messages[targetSessionKey].map(m => m.id))
    },

    /**
     * 从消息对象中提取文本内容
     *
     * 保留所有内容，包括工具调用标记
     * 工具调用会通过 agent 事件独立处理，但 chat 事件也可能包含标记
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
            // 保留工具调用标记（与历史记录加载保持一致）
            if (part.type === 'tool_use' || part.type === 'tool_use_call') return `[工具调用: ${part.name || part.id || 'unknown'}]`
            if (part.type === 'tool_result') return `[工具结果]`
            // 保留 thinking 标记
            if (part.type === 'thinking') return `[thinking]`
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
     * 追加文本内容，处理重复内容
     *
     * 根据协议，增量更新时可能出现：
     * 1. 完整内容（直接返回）
     * 2. 增量内容（需要追加）
     *
     * 改进的算法：
     * - 检测next是否是previous的增量（next从previous的某个位置开始）
     * - 检测next是否包含previous（完整替换）
     * - 检测previous是否包含next（重复事件，忽略）
     * - 否则追加（真正的新内容）
     *
     * 参考：websocket-integration-guide.md 第 994-999 行
     */
    appendTextContent(previous: string, next: string): string {
      if (!previous) return next
      if (!next) return previous

      // 1. 如果next包含previous（完整替换）
      if (next.startsWith(previous)) {
        console.log(`   [appendTextContent] Complete replacement: next contains previous`)
        return next
      }

      // 2. 如果previous包含next（重复事件，返回previous）
      if (previous.startsWith(next)) {
        console.log(`   [appendTextContent] Duplicate event, ignoring next`)
        return previous
      }

      // 3. 检测next是否是previous的增量（next从previous的某个位置开始）
      const overlapIndex = previous.indexOf(next.substring(0, Math.min(50, next.length)))
      if (overlapIndex !== -1 && overlapIndex > previous.length * 0.5) {
        // next的前部分在previous的后半部分找到，可能是增量
        const newContent = next.substring(previous.length - overlapIndex)
        if (newContent && newContent !== next) {
          console.log(`   [appendTextContent] Appending增量: found overlap at ${overlapIndex}`)
          return previous + newContent
        }
      }

      // 4. 检测previous是否在next中（反向包含）
      const reverseOverlapIndex = next.indexOf(previous.substring(previous.length - 50))
      if (reverseOverlapIndex !== -1) {
        const newContent = next.substring(previous.length - reverseOverlapIndex)
        if (newContent && newContent !== next) {
          console.log(`   [appendTextContent] Appending增量: reverse overlap`)
          return previous + newContent
        }
      }

      // 5. 否则直接追加（可能有问题，但至少不会丢失内容）
      console.log(`   [appendTextContent] Direct append (no overlap detected)`)
      return previous + next
    },

    /**
     * 创建 Agent 错误消息
     */
    createAgentErrorMessage(sessionKey: string, runId: string, errorData: any) {
      const errorMessage: Message = {
        id: `${runId}-error`,
        role: 'system',
        content: `❌ Agent 执行错误\n${errorData?.error || errorData?.message || '未知错误'}`,
        timestamp: Date.now(),
        status: 'error',
        metadata: {
          type: 'agent_error',
          runId,
          errorData
        }
      }

      if (!this.messages[sessionKey]) {
        this.messages[sessionKey] = []
      }

      this.messages[sessionKey].push(errorMessage)
      // Push操作已经触发了响应式更新
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
        this.messages[sessionKey] = []
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

      // 数组操作已经触发了响应式更新
      console.log('Messages updated, total for session:', this.messages[sessionKey]?.length)
    },

    /**
     * 标准化消息角色
     */
    normalizeRole(msg: any): 'user' | 'assistant' | 'system' {
      let role = msg.role || msg.sender || msg.type || msg.author || 'unknown'
      if (role === 'bot' || role === 'ai' || role === 'model') {
        role = 'assistant'
      } else if (role === 'human') {
        role = 'user'
      }
      // 如果不是有效的角色，默认为assistant
      if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        role = 'assistant'
      }
      return role as 'user' | 'assistant' | 'system'
    }
  }
})
