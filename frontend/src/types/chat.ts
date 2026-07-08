/**
 * 聊天相关类型定义
 */

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  createdAt?: number
  status?: 'sending' | 'sent' | 'error' | 'streaming'
  attachments?: Attachment[]
  metadata?: {
    type?: 'tool_call' | 'tool_result' | 'tool_error' | 'agent_error' | 'text'
    toolName?: string
    toolCallId?: string
    toolTitle?: string
    phase?: 'start' | 'update' | 'result'
    args?: any
    result?: any
    partialResult?: any
    error?: any
    isError?: boolean
    errorMessage?: string
    aborted?: boolean
    kind?: string
    runId?: string
    errorData?: any
    [key: string]: any
  }
}

export interface Attachment {
  type: string
  url: string
  name: string
  size?: number
  mimeType?: string
}

export interface Session {
  key: string
  label: string
  agentId?: string
  createdAt?: number
  updatedAt?: number
  messageCount?: number
  lastMessageAt?: number
  lastMessage?: string
  metadata?: Record<string, any>
  status?: 'active' | 'archived' | 'deleted'
}

export interface CreateSessionParams {
  agentId: string
  label: string
  metadata?: Record<string, any>
}

/** 任务计划中的单个任务 */
export interface TaskPlanTask {
  id: string
  title: string
  assignee: string
  description?: string
  depends_on?: string[]
  status?: 'pending' | 'working' | 'completed' | 'error'
}

/** 从 Lead Agent 输出中提取的任务计划 */
export interface TaskPlan {
  goal: string
  tasks: TaskPlanTask[]
  /** 提取来源的消息 ID */
  sourceMessageId?: string
  /** 创建时间 */
  createdAt: number
}

export interface ChatState {
  sessions: Session[]
  currentSessionKey: string | null
  currentAgentId: string | null
  currentTeamId: string | null
  messages: Record<string, Message[]>
  thinkingMessageId: string | null
  streamingMessageId: string | null
  streamingTimeout: number | null
  loading: boolean
  sessionsLoading: boolean
  currentRunId: string | null
  isSending: boolean
  processedEvents: Record<string, boolean>
  runsWithTools: Record<string, number>
  runToolPositions: Record<string, number>
  knownServerSessions: Record<string, boolean>
  /** 每个 session 的任务计划（从 Lead Agent 的 json-plan 块中提取） */
  taskPlans: Record<string, TaskPlan | null>
}

export interface SendMessageParams {
  sessionKey: string
  message: string
  attachments?: Attachment[]
}
