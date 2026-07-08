/**
 * Gateway 状态管理
 */

import { defineStore } from 'pinia'
import type { GatewayState, GatewayHello } from '@/types/gateway'
import { connectGateway, disconnectGateway, isConnected, onConnected, onDisconnected, onEvent } from '@/api/gateway'
import { useChatStore } from './chat'
import { useTeamStore } from './team'

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
      const chatStore = useChatStore()
      const teamStore = useTeamStore()

      console.log('🔍🔍🔍 Gateway event received:', event.event)

      if (event.event === 'chat' && event.payload) {
        const payload = event.payload
        const sessionKey = payload.sessionKey

        // Lead 会话事件
        if (sessionKey && sessionKey === chatStore.currentSessionKey) {
          chatStore.handleChatMessage(payload)
          return
        }

        // 团队成员会话事件 → 始终存入 chatStore（实时渲染）
        // 匹配 agent:<memberId>: 开头的任意 channel（兼容 main 和自定义 session key）
        if (teamStore.activeTeam && sessionKey) {
          const memberIds = teamStore.activeTeam.members
            .filter(m => m.agentId !== teamStore.activeTeam!.leadAgentId)
            .map(m => m.agentId)
          for (const memberId of memberIds) {
            if (sessionKey.startsWith(`agent:${memberId}:`)) {
              // 确保消息数组存在
              if (!chatStore.messages[sessionKey]) {
                chatStore.messages[sessionKey] = []
              }
              chatStore.handleChatMessage(payload)
              return
            }
          }
        }

        chatStore.handleChatMessage(payload)
        return
      }

      if (event.event === 'agent' && event.payload) {
        const payload = event.payload
        const sessionKey = payload.sessionKey

        // 从 sessionKey 解析 agentId 和 channel（状态按 session 隔离，不依赖当前查看的会话）
        const parts = sessionKey ? sessionKey.split(':') : []
        const agentId = parts.length >= 2 ? parts[1] : ''
        const channel = parts.length >= 3 ? parts.slice(2).join(':') : ''

        // 判断是否为团队 Lead 会话：agentId 是某团队的 leadAgentId
        const leadTeam = agentId ? teamStore.teams.find(t => t.leadAgentId === agentId) || null : null
        const isLeadSession = !!leadTeam

        if (isLeadSession) {
          // 渲染 Lead 回复（仅当用户当前查看该会话）
          if (sessionKey === chatStore.currentSessionKey) {
            chatStore.handleAgentEvent(payload)
          }

          // 检测 sessions_send 工具事件 → 更新成员进度（按 sessionKey 隔离）
          if (payload.stream === 'tool' && payload.data) {
            const tool = (payload.data.tool || payload.data.name || '').toLowerCase()
            const phase = payload.data.phase
            const args = payload.data.args || payload.data.input || {}
            const toolCallId = payload.data.toolCallId || payload.data.id

            if (tool.includes('session') || tool.includes('send') || phase === 'start') {
              console.log(`[Gateway] 🔍 Tool event: tool=${tool}, phase=${phase}, args=`, JSON.stringify(args).substring(0, 200), `toolCallId=${toolCallId}, session=${sessionKey}`)
            }

            // 宽泛匹配 sessions_send 工具（兼容不同命名格式）
            if (tool.includes('session') && tool.includes('send') && leadTeam) {
              // 提取目标 agentId：兼容 agentId、sessionKey（agent:xxx:main）、to、target 等字段
              let targetAgentId = args.agentId || args.agent_id || args.target || args.to
              if (!targetAgentId && args.sessionKey) {
                const ap = args.sessionKey.split(':')
                if (ap.length >= 2 && ap[0] === 'agent') {
                  targetAgentId = ap[1]
                }
              }

              console.log(`[Gateway] sessions_send detected: tool=${tool}, phase=${phase}, target=${targetAgentId}, toolCallId=${toolCallId}, session=${sessionKey}`)

              if (phase === 'start' && targetAgentId) {
                if (toolCallId) teamStore.setToolCallAgent(sessionKey, toolCallId, targetAgentId)
                teamStore.updateMemberStatus(sessionKey, targetAgentId, 'busy')
                teamStore.updatePlanItemStatus(sessionKey, targetAgentId, 'working')
                // 自动选中工作中的成员（仅当用户当前查看该 Lead 会话）
                if (sessionKey === teamStore.activeSessionKey) {
                  const cur = teamStore.selectedMemberId
                  if (!cur || cur !== targetAgentId) {
                    teamStore.selectMember(targetAgentId)
                  }
                }
                // 用 Lead 实际使用的 sessionKey 订阅成员事件（可能是自定义 key 而非 main）
                const memberKey = args.sessionKey || `agent:${targetAgentId}:main`
                if (!chatStore.messages[memberKey]) {
                  chatStore.messages[memberKey] = []
                  window.electronAPI.subscribeSession({ key: memberKey }).catch(() => {})
                }
              } else if (phase === 'result') {
                // result 阶段：从映射中查找 agentId（result 事件可能不带 args）
                const resolvedAgentId = targetAgentId || (toolCallId ? teamStore.getToolCallAgent(sessionKey, toolCallId) : null) || null
                if (resolvedAgentId) {
                  teamStore.updateMemberStatus(sessionKey, resolvedAgentId, 'completed')
                  teamStore.updatePlanItemStatus(sessionKey, resolvedAgentId, 'completed')
                  if (toolCallId) teamStore.deleteToolCallAgent(sessionKey, toolCallId)
                }
              }
            }
          }

          // lifecycle.end → Lead 完成，所有 busy 成员标记为 completed
          if (payload.stream === 'lifecycle' && payload.data?.phase === 'end' && leadTeam) {
            console.log('[Gateway] Lead lifecycle.end → marking all busy members as completed')
            for (const member of leadTeam.members) {
              const st = teamStore.sessionStates[sessionKey]?.memberStatuses[member.agentId]
              if (st?.state === 'busy') {
                teamStore.updateMemberStatus(sessionKey, member.agentId, 'completed')
                teamStore.updatePlanItemStatus(sessionKey, member.agentId, 'completed')
              }
            }
          }
          return
        }

        // 团队成员会话事件 → 始终存入 chatStore（从 channel 解析 team 验证成员，不依赖 activeTeam）
        if (channel.startsWith('team-')) {
          const team = teamStore.teams.find(t => channel === `team-${t.id}` || channel.startsWith(`team-${t.id}-`))
          if (team && team.members.some(m => m.agentId === agentId)) {
            if (!chatStore.messages[sessionKey]) {
              chatStore.messages[sessionKey] = []
            }
            chatStore.handleAgentEvent(payload)
            return
          }
        }

        chatStore.handleAgentEvent(payload)
        return
      }

      if (event.event === 'session.tool' && event.payload) {
        const payload = event.payload
        chatStore.handleAgentEvent(payload)
        return
      }

      console.warn(`⚠️ Unknown or unhandled event type: ${event.event}`)
    }
  }
})
