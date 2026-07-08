import { defineStore, acceptHMRUpdate } from 'pinia'
import type { TeamConfig, TeamState, TeamSessionState, MemberStatus, PlanItem, PlanItemStatus, TeamPlan } from '@/types/team'
import { getTeams, saveTeams } from '@/api/teams'
import { DEFAULT_TEAMS } from '@/config/preset-teams'

function createEmptySessionState(): TeamSessionState {
  return {
    memberStatuses: {},
    currentPlan: null,
    completedTaskCount: 0,
    toolCallAgentMap: {},
    selectedMemberId: null,
  }
}

export const useTeamStore = defineStore('team', {
  state: (): TeamState => ({
    teams: [],
    activeTeamId: null,
    activeSessionKey: null,
    panelExpanded: false,
    sessionStates: {},
  }),

  getters: {
    activeTeam(): TeamConfig | null {
      if (!this.activeTeamId) return null
      return this.teams.find(t => t.id === this.activeTeamId) || null
    },

    isTeamMode(): boolean {
      return !!this.activeTeamId
    },

    getTeamById(): (id: string) => TeamConfig | undefined {
      return (id: string) => this.teams.find(t => t.id === id)
    },

    // 当前活跃 session 的状态（按 sessionKey 隔离，TeamPanel 读取用）
    currentSessionState(): TeamSessionState {
      return (this.activeSessionKey ? this.sessionStates[this.activeSessionKey] : null) || createEmptySessionState()
    },

    selectedMemberId(): string | null {
      return this.currentSessionState.selectedMemberId
    },

    currentPlan(): TeamPlan | null {
      return this.currentSessionState.currentPlan
    },

    getMemberStatus(): (agentId: string) => MemberStatus {
      return (agentId: string) => this.currentSessionState.memberStatuses[agentId] || { agentId, state: 'idle' }
    },

    planProgress(): { total: number; completed: number; working: number; pending: number } | null {
      const plan = this.currentSessionState.currentPlan
      if (!plan) return null
      const items = plan.items
      const working = items.filter(i => i.status === 'working').length
      const pending = items.filter(i => i.status === 'pending').length
      return {
        total: items.length,
        completed: this.currentSessionState.completedTaskCount,
        working,
        pending,
      }
    },
  },

  actions: {
    async loadTeams() {
      try {
        const teams = await getTeams()
        if (Array.isArray(teams) && teams.length > 0) {
          this.teams = teams
        } else {
          this.teams = DEFAULT_TEAMS
          await saveTeams(DEFAULT_TEAMS)
        }
      } catch (error: any) {
        console.error('Failed to load teams:', error)
        this.teams = DEFAULT_TEAMS
      }
    },

    // 设置当前查看/活跃的 Lead sessionKey（切换会话时调用，状态按 session 隔离）
    setActiveSession(sessionKey: string | null) {
      this.activeSessionKey = sessionKey
      if (sessionKey && !this.sessionStates[sessionKey]) {
        this.sessionStates[sessionKey] = createEmptySessionState()
      }
    },

    setActiveTeam(teamId: string | null, sessionKey?: string | null) {
      this.activeTeamId = teamId
      this.panelExpanded = !!teamId
      if (sessionKey !== undefined) {
        this.setActiveSession(sessionKey)
      }
    },

    selectMember(agentId: string | null) {
      const key = this.activeSessionKey
      if (!key) return
      if (!this.sessionStates[key]) this.sessionStates[key] = createEmptySessionState()
      this.sessionStates[key].selectedMemberId = agentId
    },

    togglePanel() {
      this.panelExpanded = !this.panelExpanded
    },

    updateMemberStatus(sessionKey: string, agentId: string, state: MemberStatus['state']) {
      if (!this.sessionStates[sessionKey]) this.sessionStates[sessionKey] = createEmptySessionState()
      this.sessionStates[sessionKey].memberStatuses[agentId] = {
        agentId,
        state,
        lastActivity: Date.now(),
      }
    },

    async persistTeams() {
      await saveTeams(this.teams)
    },

    /**
     * 初始化计划：从团队成员配置生成初始计划清单
     * 排除 Lead（Lead 是调度者，不是执行者）
     * 每个 sessionKey 独立隔离，新团队会话自动从初始状态开始
     */
    initializePlan(sessionKey: string, team: TeamConfig) {
      if (!this.sessionStates[sessionKey]) this.sessionStates[sessionKey] = createEmptySessionState()
      const s = this.sessionStates[sessionKey]
      // 新会话：清空本 session 内的执行状态（隔离保证不携带其他会话的状态）
      s.memberStatuses = {}
      s.toolCallAgentMap = {}
      s.completedTaskCount = 0
      s.selectedMemberId = null

      const items: PlanItem[] = team.members
        .filter(m => m.agentId !== team.leadAgentId)
        .map(m => ({
          id: m.agentId,
          label: m.role,
          emoji: m.emoji,
          agentId: m.agentId,
          status: 'pending' as PlanItemStatus,
        }))

      s.currentPlan = {
        sessionId: sessionKey,
        teamId: team.id,
        items,
        createdAt: Date.now(),
      }
      console.log(`[TeamStore] Plan initialized: ${items.length} items for team ${team.name} (session: ${sessionKey})`)
    },

    /**
     * 更新计划项状态（按 sessionKey 隔离）
     */
    updatePlanItemStatus(sessionKey: string, agentId: string, status: PlanItemStatus) {
      const s = this.sessionStates[sessionKey]
      if (!s?.currentPlan) return
      const item = s.currentPlan.items.find(i => i.agentId === agentId)
      if (!item) return

      item.status = status
      if (status === 'working') item.startedAt = Date.now()
      if (status === 'completed' || status === 'error') {
        item.completedAt = Date.now()
        s.completedTaskCount++
      }
      console.log(`[TeamStore] Plan item updated: ${agentId} → ${status} (session: ${sessionKey})`)
    },

    // toolCallAgentMap 操作（gateway 按 sessionKey 读写，避免跨会话污染）
    getToolCallAgent(sessionKey: string, toolCallId: string): string | undefined {
      return this.sessionStates[sessionKey]?.toolCallAgentMap[toolCallId]
    },

    setToolCallAgent(sessionKey: string, toolCallId: string, agentId: string) {
      if (!this.sessionStates[sessionKey]) this.sessionStates[sessionKey] = createEmptySessionState()
      this.sessionStates[sessionKey].toolCallAgentMap[toolCallId] = agentId
    },

    deleteToolCallAgent(sessionKey: string, toolCallId: string) {
      const s = this.sessionStates[sessionKey]
      if (s) delete s.toolCallAgentMap[toolCallId]
    },

    /**
     * 清空当前 session 的计划
     */
    clearPlan() {
      const key = this.activeSessionKey
      if (key && this.sessionStates[key]) {
        this.sessionStates[key].currentPlan = null
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTeamStore, import.meta.hot))
}
