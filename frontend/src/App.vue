<template>
  <div id="app" class="h-screen flex flex-col pt-9">
    <!-- Title Bar -->
    <TitleBar />

    <!-- Main App Panel -->
    <div id="app-panel" class="h-full flex flex-col">
      <div class="flex h-full overflow-hidden min-w-0">
        <!-- Sidebar -->
        <div
          id="sidebar"
          class="sidebar"
          :style="{ width: `${sidebarWidth}px` }"
        >
          <!-- Resizer handle -->
          <div
            class="resizer"
            title="Drag to resize"
            @mousedown="startResize"
          ></div>

          <!-- Sidebar Header -->
          <div class="sidebar-header">
            <h2 class="text-lg font-semibold">OpenClaw</h2>
            <div
              class="connection-indicator"
              :class="{ online: connected, offline: !connected }"
            ></div>
          </div>

          <!-- Session List (contains 新建对话 + 专家入口 + 历史对话) -->
          <SessionList />
        </div>

        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col bg-background min-w-0 overflow-hidden min-h-0">
          <!-- Expert Panel (replaces chat when open) -->
          <template v-if="uiStore.expertPanelOpen">
            <ExpertPanel />
          </template>

          <!-- Chat View -->
          <template v-else>
            <div id="chat-view" class="flex-1 flex flex-col overflow-hidden">
              <div class="chat-header">
                <h3>{{ currentSessionTitle }}</h3>
                <div class="flex items-center gap-4">
                  <div class="text-xs text-muted-foreground">{{ sessionStatus }}</div>
                  <button
                    class="settings-btn"
                    title="设置"
                    @click="openSettings"
                  >
                    <Icon name="settings" :size="18" />
                  </button>
                </div>
              </div>

              <div class="chat-messages">
                <WelcomeScreen v-if="!currentSessionKey" />
                <NewSessionView
                  v-else-if="currentMessages.length === 0 && !loading"
                />
                <MessageList
                  v-else
                  :messages="currentMessages"
                  :loading="loading"
                  :thinking-message-id="thinkingMessageId"
                  :streaming-message-id="streamingMessageId"
                  ref="messageListRef"
                />
              </div>

              <MessageInput
                v-if="currentSessionKey"
                :disabled="!canSend"
                :can-abort="canAbort"
                :is-sending="chatStore.isSending"
                @send="handleSendMessage"
                @abort="handleAbort"
                ref="messageInputRef"
              />
            </div>
          </template>
        </div>

        <!-- Team Panel (right side, only in team mode) -->
        <TeamPanel />
      </div>
    </div>

    <!-- Settings Dialog -->
    <SettingsDialog />

    <!-- Common Components -->
    <Toast />
    <Loading />
    <ConfirmDialog ref="confirmDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore, useGatewayStore, useChatStore, useUiStore, useAgentsStore, useTeamStore } from '@/stores'
import { useChat, useGateway } from '@/composables'

// Components
import TitleBar from '@/components/common/TitleBar.vue'
import SessionList from '@/components/session/SessionList.vue'
import ExpertPanel from '@/components/chat/ExpertPanel.vue'
import WelcomeScreen from '@/components/chat/WelcomeScreen.vue'
import NewSessionView from '@/components/chat/NewSessionView.vue'
import MessageList from '@/components/chat/MessageList.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import TeamPanel from '@/components/chat/TeamPanel.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import Toast from '@/components/common/Toast.vue'
import Loading from '@/components/common/Loading.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import Icon from '@/components/common/Icon.vue'

// Stores
const configStore = useConfigStore()
const gatewayStore = useGatewayStore()
const chatStore = useChatStore()
const uiStore = useUiStore()
const agentsStore = useAgentsStore()
const teamStore = useTeamStore()

// Composables
const { sendMessage } = useChat()
const { connect } = useGateway()

// Refs
const messageListRef = ref<InstanceType<typeof MessageList>>()
const messageInputRef = ref<InstanceType<typeof MessageInput>>()
const confirmDialogRef = ref<InstanceType<typeof ConfirmDialog>>()

// State
const { sidebarWidth } = storeToRefs(configStore)
const { connected } = storeToRefs(gatewayStore)
const { sessions, currentSessionKey, currentMessages, loading, thinkingMessageId, streamingMessageId } = storeToRefs(chatStore)

// Computed
const currentSessionTitle = computed(() => {
  if (!currentSessionKey.value) return '选择或创建一个对话'

  if (chatStore.currentTeamId) {
    const team = teamStore.getTeamById(chatStore.currentTeamId)
    if (team) return team.name
  }

  if (chatStore.currentAgentId && chatStore.currentAgentId !== 'main') {
    const agent = agentsStore.getAgentById(chatStore.currentAgentId)
    if (agent) return agent.name
  }

  const session = sessions.value.find(s => s.key === currentSessionKey.value)
  return session?.label || '未知会话'
})

const sessionStatus = computed(() => {
  return connected.value ? '已连接' : '离线'
})

const canSend = computed(() => {
  return currentSessionKey.value && connected.value && !loading.value && !chatStore.isSending
})

const canAbort = computed(() => {
  // 只要正在发送就允许停止，不管是否有runId
  // 如果没有runId（还在等待服务器响应），前端只清理状态不发送abort消息
  return chatStore.isSending
})

/**
 * 从 Lead session key 中提取 channel 部分
 * e.g. "agent:essay-team-lead:team-essay-abc123" → "team-essay-abc123"
 */
function extractChannel(sessionKey: string): string {
  const parts = sessionKey.split(':')
  return parts.slice(2).join(':')
}

/**
 * 为成员生成隔离的 session key（和 Lead 共享同一个 channel）
 * e.g. member="student-agent", channel="team-essay-abc123" → "agent:student-agent:team-essay-abc123"
 */
function buildMemberSessionKey(agentId: string, channel: string): string {
  return `agent:${agentId}:${channel}`
}

// Methods
async function handleSendMessage(message: string) {
  if (!canSend.value || !currentSessionKey.value) return

  try {
    let finalMessage = message

    // 新的 team session：在消息前面注入路由指令，告诉 Lead 用独立 sessionKey 与成员通信
    // 这样每个 team 对话的成员 session 是隔离的，不会污染 main session 和历史会话
    if (chatStore.currentTeamId && !chatStore.knownServerSessions[currentSessionKey.value]) {
      const team = teamStore.getTeamById(chatStore.currentTeamId)
      if (team) {
        const channel = extractChannel(currentSessionKey.value)
        const routingLines = team.members
          .filter(m => m.agentId !== team.leadAgentId)
          .map(m => `- ${m.role}: sessionKey = "${buildMemberSessionKey(m.agentId, channel)}"`)
          .join('\n')

        finalMessage = `[SYSTEM-ROUTING] 本次对话中，调用 sessions_send 时必须使用 sessionKey 参数（不要用 agentId），各成员的 sessionKey 如下：\n${routingLines}\n[/SYSTEM-ROUTING]\n\n${message}`
        console.log('[App] New team session — routing info injected')
      }
    }

    await sendMessage(currentSessionKey.value, finalMessage)
  } catch (error: any) {
    uiStore.showToast(error.message || '发送消息失败', 'error')
  }
}

async function handleAbort() {
  if (!canAbort.value) return

  try {
    await chatStore.abortCurrentChat()
    uiStore.showToast('已停止生成', 'success')
  } catch (error: any) {
    uiStore.showToast(error.message || '停止生成失败', 'error')
  }
}

function openSettings() {
  uiStore.openSettings()
}

// Sidebar resize
let isResizing = false

function startResize(event: MouseEvent) {
  isResizing = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

function handleResize(event: MouseEvent) {
  if (!isResizing) return
  const newWidth = event.clientX
  configStore.setSidebarWidth(newWidth)
}

function stopResize() {
  isResizing = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// Watch for session changes and load messages
// 切换会话时同步更新 teamStore 的活跃 session（状态按 session 隔离）
watch(currentSessionKey, (newKey) => {
  if (newKey) teamStore.setActiveSession(newKey)
}, { flush: 'sync' })

watch(currentSessionKey, async (newSessionKey, oldSessionKey) => {
  if (newSessionKey) {
    try {
      await chatStore.loadMessages(newSessionKey)
    } catch (error: any) {
      console.warn('Session has no history yet (new session):', newSessionKey)
      chatStore.messages[newSessionKey] = []
    }
  }
})

// Watch for team changes and sync teamStore + subscribe member sessions
watch(() => chatStore.currentTeamId, async (newTeamId, oldTeamId) => {
  if (newTeamId) {
    teamStore.setActiveTeam(newTeamId)

    // 订阅团队成员 session（延迟确保连接就绪）
    // 使用 Lead session key 的 channel 派生成员的 session key，保证每个 team 对话隔离
    const team = teamStore.getTeamById(newTeamId)
    const leadSessionKey = chatStore.currentSessionKey
    const channel = leadSessionKey ? extractChannel(leadSessionKey) : null

    if (team && channel) {
      setTimeout(async () => {
        for (const member of team.members) {
          if (member.agentId !== team.leadAgentId) {
            const memberKey = buildMemberSessionKey(member.agentId, channel)
            chatStore.messages[memberKey] = chatStore.messages[memberKey] || []
            try {
              await window.electronAPI.subscribeSession({ key: memberKey })
              console.log(`[App] Subscribed to member session: ${memberKey}`)
            } catch (e: any) {
              console.warn(`[App] Failed to subscribe member session: ${memberKey}`, e.message)
            }
          }
        }
      }, 500)
    }
  } else {
    // 退出 team 模式时取消订阅（用之前的 channel 派生成员 key）
    if (oldTeamId) {
      const oldTeam = teamStore.getTeamById(oldTeamId)
      const oldChannel = chatStore.currentSessionKey ? extractChannel(chatStore.currentSessionKey) : null
      if (oldTeam && oldChannel) {
        for (const member of oldTeam.members) {
          if (member.agentId !== oldTeam.leadAgentId) {
            window.electronAPI.unsubscribeSession({ key: buildMemberSessionKey(member.agentId, oldChannel) }).catch(() => {})
          }
        }
      }
    }
    teamStore.setActiveTeam(null)
  }
})

// Watch for connection changes and reload sessions
watch(connected, async (newConnected, oldConnected) => {
  if (newConnected && !oldConnected) {
    try {
      await chatStore.loadSessions()
    } catch (error: any) {
      console.error('Failed to reload sessions after connection:', error)
    }
  }
})

// Lifecycle
onMounted(async () => {
  // 初始化
  await configStore.loadConfig()
  gatewayStore.initializeEventListeners()

  // 如果有保存的配置，尝试连接
  if (configStore.gateway && configStore.gateway.url) {
    try {
      await connect(
        configStore.gateway.url,
        configStore.gateway.token,
        configStore.gateway.password
      )

      // 等待一小段时间确保连接建立后再加载会话
      setTimeout(async () => {
        if (gatewayStore.connected) {
          try {
            await teamStore.loadTeams()
            await agentsStore.loadAgents(teamStore.teams)
            await chatStore.loadSessions()
          } catch (error: any) {
            console.error('Failed to load sessions after connection:', error)
          }
        }
      }, 1000)
    } catch (error: any) {
      console.error('Failed to connect:', error)
    }
  }
})

onUnmounted(() => {
  // 清理
})
</script>

<style scoped>
#app {
  font-family: var(--font-sans);
}

.sidebar {
  min-width: 200px;
  max-width: 800px;
  flex-shrink: 0;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  display: flex;
  flex-direction: column;
  border-right: 1px solid hsl(var(--border));
  position: relative;
  overflow: hidden;
}

.resizer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s ease;
}

.resizer:hover {
  background: hsl(var(--primary));
}

.sidebar-header {
  padding: 1.25rem;
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: hsl(var(--destructive));
}

.connection-indicator.online {
  background: hsl(142, 76%, 36%);
}

.chat-header {
  padding: 1rem 1.25rem;
  background: hsl(var(--background));
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.settings-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  color: hsl(var(--foreground));
  transition: background-color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-btn:hover {
  background: hsl(var(--muted));
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  background: hsl(var(--background));
}
</style>
