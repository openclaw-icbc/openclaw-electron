/**
 * 聊天功能的 Composable
 */

import { useChatStore } from '@/stores'

export function useChat() {
  const chatStore = useChatStore()

  async function sendMessage(sessionKey: string, message: string, attachments?: any[]) {
    return await chatStore.sendMessage(sessionKey, message, attachments)
  }

  return {
    sendMessage
  }
}
