<template>
  <div class="sessions-panel">
    <div class="settings-view-header">
      <h4 class="m-0">所有对话 ({{ sessions.length }})</h4>
      <button class="btn btn-primary btn-sm" @click="handleCreateSession">
        + 新建对话
      </button>
    </div>

    <PromptDialog
      ref="promptDialogRef"
      title="新建对话"
      message="请输入会话标题："
      placeholder="请输入会话标题"
      default-value="新对话"
      confirm-text="创建"
      cancel-text="取消"
      @confirm="onPromptConfirm"
    />

    <ConfirmDialog
      ref="confirmDialogRef"
      title="确认删除"
      :message="deleteConfirmMessage"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="onDeleteConfirm"
    />

    <div v-if="loading" class="sessions-loading">
      <div class="spinner"></div>
      <div>加载会话中...</div>
    </div>

    <div v-else-if="sessions.length === 0" class="sessions-empty">
      <p>暂无对话</p>
      <p class="text-sm text-muted-foreground">点击"新建对话"创建一个会话</p>
    </div>

    <div v-else class="sessions-list">
      <div
        v-for="session in sessions"
        :key="session.key"
        class="session-manage-item"
        :class="{ active: session.key === currentSessionKey }"
        @click="handleSelectSession(session.key)"
      >
        <div class="session-manage-header">
          <div class="session-manage-title">{{ session.label || session.key }}</div>
          <div class="session-manage-actions">
            <button
              class="btn btn-xs btn-destructive"
              @click.stop="handleDeleteSession(session)"
            >
              删除
            </button>
          </div>
        </div>

        <div class="session-manage-info">
          <div class="session-manage-detail">
            <span class="label">Key:</span>
            <span class="value">{{ session.key }}</span>
          </div>

          <div v-if="session.agentId" class="session-manage-detail">
            <span class="label">Agent:</span>
            <span class="value">{{ session.agentId }}</span>
          </div>

          <div v-if="session.createdAt" class="session-manage-detail">
            <span class="label">创建时间:</span>
            <span class="value">{{ formatDate(session.createdAt) }}</span>
          </div>

          <div v-if="session.messageCount !== undefined" class="session-manage-detail">
            <span class="label">消息数:</span>
            <span class="value">{{ session.messageCount }}</span>
          </div>

          <div v-if="session.lastMessageAt" class="session-manage-detail">
            <span class="label">最后活动:</span>
            <span class="value">{{ formatDate(session.lastMessageAt) }}</span>
          </div>
        </div>

        <div v-if="session.lastMessage" class="session-manage-preview">
          <span class="label">最后消息:</span>
          <span class="value">{{ truncateMessage(session.lastMessage) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore, useUiStore } from '@/stores'
import { formatDate } from '@/utils'
import PromptDialog from '@/components/common/PromptDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const chatStore = useChatStore()
const uiStore = useUiStore()

const { sessions, currentSessionKey } = storeToRefs(chatStore)
const loading = ref(false)
const promptDialogRef = ref<InstanceType<typeof PromptDialog> | null>(null)

onMounted(async () => {
  await loadSessions()
})

async function loadSessions() {
  loading.value = true
  try {
    await chatStore.loadSessions()
    // Debug: log the sessions to see what we got
    console.log('Loaded sessions:', chatStore.sessions)
  } catch (error: any) {
    console.error('Failed to load sessions:', error)
    uiStore.showToast(error.message || '加载会话失败', 'error')
  } finally {
    loading.value = false
  }
}

function handleCreateSession() {
  promptDialogRef.value?.show()
}

async function onPromptConfirm(title: string) {
  if (!title || !title.trim()) return

  try {
    loading.value = true

    // 获取可用的 agents
    const agentsResult = await window.electronAPI.listAgents()

    // 处理不同的返回格式
    let agents = agentsResult.data
    if (agents && !Array.isArray(agents) && agents.agents) {
      agents = agents.agents
    }

    if (!agentsResult.success || !Array.isArray(agents) || agents.length === 0) {
      throw new Error('没有可用的 Agent，请先连接到 Gateway')
    }

    const agent = agents[0]
    if (!agent || !agent.id) {
      throw new Error('Agent 数据格式错误')
    }

    const sessionKey = `agent:${agent.id}:${title.trim()}`

    // 创建会话
    const createResult = await window.electronAPI.createSession({
      agentId: agent.id,
      label: title.trim(),
      key: sessionKey
    })

    if (!createResult.success) {
      throw new Error(createResult.error || '创建会话失败')
    }

    // 重新加载会话列表
    await chatStore.loadSessions()

    uiStore.showToast('会话创建成功', 'success')
  } catch (error: any) {
    console.error('Failed to create session:', error)
    uiStore.showToast(error.message || '创建会话失败', 'error')
  } finally {
    loading.value = false
  }
}

function handleSelectSession(sessionKey: string) {
  chatStore.setCurrentSession(sessionKey)
  // 关闭设置对话框
  uiStore.closeSettings()
}

const confirmDialogRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const deletingSession = ref<any>(null)

const deleteConfirmMessage = computed(() => {
  if (!deletingSession.value) return ''
  const session = deletingSession.value
  const name = session.label || session.key
  if (session.messageCount > 0) {
    return `确定要删除会话"${name}"吗？此操作将删除会话及其所有消息记录。`
  }
  return `确定要删除会话"${name}"吗？`
})

function handleDeleteSession(session: any) {
  deletingSession.value = session
  confirmDialogRef.value?.show()
}

async function onDeleteConfirm() {
  if (!deletingSession.value) return

  const session = deletingSession.value

  try {
    uiStore.showLoading('正在删除会话...')
    await chatStore.deleteSession(session.key, true)

    // 删除成功后重新加载会话列表
    await loadSessions()

    uiStore.showToast('会话已删除', 'success')
  } catch (error: any) {
    console.error('Delete session error:', error)
    uiStore.showToast(error.message || '删除会话失败', 'error')
  } finally {
    uiStore.hideLoading()
    deletingSession.value = null
  }
}

function truncateMessage(message: string): string {
  if (message.length <= 100) return message
  return message.substring(0, 100) + '...'
}
</script>

<style scoped>
.settings-view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.settings-view-header h4 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.sessions-loading,
.sessions-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: hsl(var(--muted-foreground));
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid hsl(var(--muted) / 0.3);
  border-top-color: hsl(var(--primary));
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.session-manage-item {
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  padding: 1rem;
  background: hsl(var(--background));
  transition: border-color 0.15s ease;
}

.session-manage-item:hover {
  border-color: hsl(var(--primary));
}

.session-manage-item.active {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.05);
}

.session-manage-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 0.75rem;
}

.session-manage-title {
  font-weight: 600;
  color: hsl(var(--foreground));
}

.session-manage-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-xs {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  height: auto;
}

.btn-destructive {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
  border-color: hsl(var(--destructive));
}

.btn-destructive:hover {
  background: hsl(var(--destructive) / 0.2);
}

.session-manage-info {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.session-manage-detail {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.session-manage-detail .label {
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}

.session-manage-detail .value {
  color: hsl(var(--foreground));
}

.session-manage-preview {
  padding-top: 0.5rem;
  border-top: 1px solid hsl(var(--border));
  font-size: 0.875rem;
  display: flex;
  gap: 0.5rem;
}

.session-manage-preview .label {
  color: hsl(var(--muted-foreground));
  font-weight: 500;
  flex-shrink: 0;
}

.session-manage-preview .value {
  color: hsl(var(--foreground));
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
