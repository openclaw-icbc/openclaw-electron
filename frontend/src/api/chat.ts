/**
 * 聊天相关 API 封装
 */

import type { Message, Session, SendMessageParams } from '@/types/chat'

/**
 * 发送消息
 */
export async function sendMessage(params: SendMessageParams): Promise<string> {
  const result = await window.electronAPI.sendMessage(
    params.sessionKey,
    params.message,
    params.attachments
  )

  if (!result.success) {
    throw new Error(result.error || '发送消息失败')
  }

  return result.runId || ''
}

/**
 * 获取聊天历史
 */
export async function getChatHistory(sessionKey: string, limit?: number): Promise<Message[]> {
  const result = await window.electronAPI.getChatHistory(sessionKey, limit)

  if (!result.success) {
    throw new Error(result.error || '获取聊天历史失败')
  }

  return result.data || []
}

/**
 * 获取会话列表
 */
export async function listSessions(params?: any): Promise<Session[]> {
  const result = await window.electronAPI.listSessions(params)

  if (!result.success) {
    throw new Error(result.error || '获取会话列表失败')
  }

  return result.data || []
}

/**
 * 解析会话
 */
export async function resolveSession(params?: any): Promise<Session | null> {
  const result = await window.electronAPI.resolveSession(params)

  if (!result.success) {
    throw new Error(result.error || '解析会话失败')
  }

  return result.data || null
}

/**
 * 删除会话
 */
export async function deleteSession(key: string, deleteTranscript = false): Promise<void> {
  const result = await window.electronAPI.deleteSession(key, deleteTranscript)

  if (!result.success) {
    throw new Error(result.error || '删除会话失败')
  }
}

/**
 * 更新会话
 */
export async function patchSession(key: string, patch: any): Promise<void> {
  const result = await window.electronAPI.patchSession(key, patch)

  if (!result.success) {
    throw new Error(result.error || '更新会话失败')
  }
}

/**
 * 创建会话
 */
export async function createSession(params: any): Promise<any> {
  const result = await window.electronAPI.createSession(params)

  if (!result.success) {
    throw new Error(result.error || '创建会话失败')
  }

  return result.data
}

/**
 * 取消聊天
 */
export async function abortChat(sessionKey: string, runId?: string): Promise<void> {
  const result = await window.electronAPI.abortChat(sessionKey, runId)

  if (!result.success) {
    throw new Error(result.error || '取消聊天失败')
  }
}
