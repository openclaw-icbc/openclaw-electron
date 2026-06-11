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

export interface ChatState {
  sessions: Session[]
  currentSessionKey: string | null
  messages: Record<string, Message[]>
  thinkingMessageId: string | null
  streamingMessageId: string | null
  streamingTimeout: number | null
  loading: boolean
  currentRunId: string | null
  isSending: boolean
  processedEvents: Record<string, boolean>
  // 跟踪已有工具事件的 runId，值为工具计数器（第几个工具），用于区分工具间文本
  runsWithTools: Record<string, number>
  // 记录工具消息的插入位置，用于后续 after-tool 文本定位
  runToolPositions: Record<string, number>
}

export interface SendMessageParams {
  sessionKey: string
  message: string
  attachments?: Attachment[]
}
