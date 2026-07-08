export interface TeamMember {
  agentId: string
  role: string
  emoji: string
}

export interface TeamConfig {
  id: string
  name: string
  description: string
  emoji: string
  leadAgentId: string
  members: TeamMember[]
}

export interface AgentInfo {
  id: string
  name: string
  emoji: string
  isTeamLead: boolean
  teamId?: string
}

export interface MemberStatus {
  agentId: string
  state: 'idle' | 'busy' | 'completed'
  lastActivity?: number
}

// Plan 相关类型
export type PlanItemStatus = 'pending' | 'working' | 'completed' | 'error'

export interface PlanItem {
  id: string              // 唯一标识（当前使用 agentId）
  label: string           // 显示文本（角色名）
  emoji: string           // 图标
  agentId: string         // 关联成员
  status: PlanItemStatus
  startedAt?: number
  completedAt?: number
}

export interface TeamPlan {
  sessionId: string       // 关联的 session key
  teamId: string          // 来源团队
  items: PlanItem[]
  createdAt: number
}

export interface TeamSessionState {
  memberStatuses: Record<string, MemberStatus>
  currentPlan: TeamPlan | null
  completedTaskCount: number
  toolCallAgentMap: Record<string, string>
  selectedMemberId: string | null
}

export interface TeamState {
  teams: TeamConfig[]
  activeTeamId: string | null
  activeSessionKey: string | null
  panelExpanded: boolean
  sessionStates: Record<string, TeamSessionState>
}
