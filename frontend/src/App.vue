<template>
  <div id="app" class="h-screen flex flex-col pt-9">
    <!-- Title Bar -->
    <TitleBar />

    <!-- Main App Panel -->
    <div id="app-panel" class="h-full flex flex-col">
      <div class="flex h-full overflow-hidden">
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

          <!-- Sidebar Content -->
          <SessionList />
        </div>

        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
          <!-- Chat View -->
          <div id="chat-view" class="flex-1 flex flex-col overflow-hidden">
            <div class="chat-header">
              <h3>{{ currentSessionTitle }}</h3>
              <div class="flex items-center gap-4">
                <div class="text-xs text-muted-foreground">{{ sessionStatus }}</div>
                <button
                  class="settings-btn"
                  title="设置"
                  @click="openSettings"
                >⚙️</button>
              </div>
            </div>

            <div class="chat-messages">
              <WelcomeScreen v-if="!currentSessionKey" />
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
        </div>
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
import { useConfigStore, useGatewayStore, useChatStore, useUiStore } from '@/stores'
import { useChat, useGateway } from '@/composables'

// Components
import TitleBar from '@/components/common/TitleBar.vue'
import SessionList from '@/components/session/SessionList.vue'
import WelcomeScreen from '@/components/chat/WelcomeScreen.vue'
import MessageList from '@/components/chat/MessageList.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import Toast from '@/components/common/Toast.vue'
import Loading from '@/components/common/Loading.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

// Stores
const configStore = useConfigStore()
const gatewayStore = useGatewayStore()
const chatStore = useChatStore()
const uiStore = useUiStore()

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
  return !!(chatStore.isSending && chatStore.currentRunId)
})

// Methods
async function handleSendMessage(message: string) {
  if (!canSend.value || !currentSessionKey.value) return

  try {
    await sendMessage(currentSessionKey.value, message)
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
watch(currentSessionKey, async (newSessionKey, oldSessionKey) => {
  if (newSessionKey && newSessionKey !== oldSessionKey) {
    try {
      await chatStore.loadMessages(newSessionKey)
    } catch (error: any) {
      console.error('Failed to load messages:', error)
      uiStore.showToast(error.message || '加载消息失败', 'error')
    }
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
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
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
