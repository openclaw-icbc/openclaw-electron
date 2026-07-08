<template>
  <div class="session-list-container">
    <button class="btn btn-primary m-2.5" @click="handleCreateSession">
      + 新建对话
    </button>

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

    <!-- Expert Entry -->
    <div class="expert-entry" @click="openExpertPanel">
      <div class="flex items-center gap-2">
        <span class="expert-entry-icon"><Icon name="users" :size="16" /></span>
        <span class="text-sm font-semibold">专家</span>
      </div>
      <span class="entry-arrow">→</span>
    </div>

    <div class="sessions-header" @click="toggleSessions">
      <div class="flex items-center gap-2">
        <span class="sessions-header-icon"><Icon name="message-square" :size="16" /></span>
        <span class="text-sm font-semibold">历史对话</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="sessions-count text-xs">{{ sessionCount }}</span>
        <span
          class="sessions-toggle-icon"
          :style="{ transform: sessionsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }"
        >▼</span>
      </div>
    </div>

    <Transition name="sessions">
      <div v-if="sessionsExpanded" class="sessions-list custom-scrollbar">
        <div v-if="sessions.length === 0" class="empty-state">
          <h3>暂无对话</h3>
          <p>创建一个新对话开始使用</p>
        </div>
        <SessionItem
          v-for="session in sessions"
          :key="session.key"
          :session="session"
          :active="session.key === currentSessionKey"
          @click="handleSelectSession(session.key)"
          @delete="handleDeleteSession"
        />
      </div>
    </Transition>

    <!-- Delete confirmation dialog -->
    <ConfirmDialog
      ref="confirmDialogRef"
      title="删除会话"
      message="确定要删除这个会话吗？此操作不可撤销。"
      confirm-text="删除"
      cancel-text="取消"
      :danger="true"
      @confirm="onConfirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore, useChatStore, useUiStore, useGatewayStore, useTeamStore } from '@/stores'
import SessionItem from './SessionItem.vue'
import PromptDialog from '@/components/common/PromptDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import Icon from '@/components/common/Icon.vue'

const configStore = useConfigStore()
const chatStore = useChatStore()
const uiStore = useUiStore()
const gatewayStore = useGatewayStore()
const teamStore = useTeamStore()

const { sessionsExpanded } = storeToRefs(configStore)
const { sessions, currentSessionKey } = storeToRefs(chatStore)

const sessionCount = computed(() => sessions.value.length)
const promptDialogRef = ref<InstanceType<typeof PromptDialog> | null>(null)
const confirmDialogRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
let pendingDeleteKey: string | null = null

function toggleSessions() {
  configStore.toggleSessionsExpanded()
}

function handleCreateSession() {
  promptDialogRef.value?.show()
}

function openExpertPanel() {
  uiStore.openExpertPanel()
}

async function onPromptConfirm(title: string) {
  if (!title || !title.trim()) return

  try {
    uiStore.showLoading('正在创建会话...')

    // 检查是否已连接到Gateway
    if (!gatewayStore.connected) {
      throw new Error('请先连接到 Gateway')
    }

    // 获取可用的 agents
    const agentsResult = await window.electronAPI.listAgents()

    if (!agentsResult.success) {
      throw new Error(agentsResult.error || '获取 Agent 列表失败')
    }

    let agents = agentsResult.data
    if (agents && !Array.isArray(agents) && agents.agents) {
      agents = agents.agents
    }

    if (!Array.isArray(agents) || agents.length === 0) {
      throw new Error('没有可用的 Agent')
    }

    const chatStore = useChatStore()
    const agentId = chatStore.currentAgentId || 'main'
    const agent = agents.find((a: any) => a.id === agentId) || agents[0]
    if (!agent || !agent.id) {
      throw new Error('Agent 数据格式错误')
    }

    // 生成 sessionKey (格式: agent:<agentId>:<label>)
    const sessionLabel = title.trim().replace(/\s+/g, '-').toLowerCase()
    const sessionKey = `agent:${agent.id}:${sessionLabel}`

    // 创建本地会话对象 (不调用 Gateway API，发送第一条消息时自动创建)
    const newSession = {
      key: sessionKey,
      label: title.trim(),
      agentId: agent.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      status: 'active' as const
    }

    // 添加到会话列表
    chatStore.addSession(newSession)

    // 自动选择新创建的会话
    await chatStore.setCurrentSession(sessionKey)

    uiStore.hideLoading()
    uiStore.showToast('新对话已创建！发送一条消息开始聊天。', 'success')
  } catch (error: any) {
    console.error('Create session error:', error)
    uiStore.hideLoading()
    uiStore.showToast(error.message || '创建会话失败', 'error')
  }
}

function handleDeleteSession(sessionKey: string) {
  pendingDeleteKey = sessionKey
  confirmDialogRef.value?.show()
}

async function onConfirmDelete() {
  if (!pendingDeleteKey) return
  const sessionKey = pendingDeleteKey
  pendingDeleteKey = null
  try {
    await chatStore.deleteSession(sessionKey, true)
    if (chatStore.currentSessionKey === sessionKey) {
      chatStore.setCurrentSession(null)
    }
    uiStore.showToast('会话已删除', 'success')
  } catch (error: any) {
    uiStore.showToast(error.message || '删除失败', 'error')
  }
}

async function handleSelectSession(sessionKey: string) {
  uiStore.closeExpertPanel()
  chatStore.setCurrentSession(sessionKey)

  const parts = sessionKey.split(':')
  if (parts.length >= 3 && parts[0] === 'agent') {
    const agentId = parts[1]
    const channel = parts.slice(2).join(':')

    chatStore.setCurrentAgent(agentId)

    // 只根据 session key 格式推断 team 上下文
    // 不从 agent 身份推断（避免 lead agent 的个人会话被错误关联到 team）
    if (channel.startsWith('team-')) {
      // channel 可能是旧格式 team-<teamId> 或新格式 team-<teamId>-<random>
      // 用已知 team 列表匹配
      const matched = teamStore.teams.find((t) =>
        channel === `team-${t.id}` || channel.startsWith(`team-${t.id}-`)
      )
      const teamId = matched ? matched.id : channel.substring(5)
      chatStore.setCurrentTeam(teamId)
      teamStore.setActiveTeam(teamId)
    } else {
      chatStore.setCurrentTeam(null)
      teamStore.setActiveTeam(null)
    }
  } else {
    chatStore.setCurrentTeam(null)
    teamStore.setActiveTeam(null)
  }
}
</script>

<style scoped>
.session-list-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sessions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 0.75rem 1rem;
  margin: 0.5rem 0.625rem 0;
  user-select: none;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  transition: all 0.15s ease;
}

.sessions-header:hover {
  background: hsl(var(--sidebar-hover));
  border-color: hsl(var(--primary) / 0.3);
}

.expert-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 0.75rem 1rem;
  margin: 0 0.625rem;
  user-select: none;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  transition: all 0.15s ease;
}

.expert-entry:hover {
  background: hsl(var(--sidebar-hover));
  border-color: hsl(var(--primary) / 0.3);
}

.expert-entry-icon {
  display: flex;
  align-items: center;
  color: hsl(var(--muted-foreground));
}

.entry-arrow {
  font-size: 1rem;
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
}

.sessions-header-icon {
  display: flex;
  align-items: center;
}

.sessions-count {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.sessions-toggle-icon {
  transition: transform 0.3s ease;
  display: inline-block;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
  color: hsl(var(--muted-foreground));
}

.empty-state h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: hsl(var(--foreground));
}

.empty-state p {
  font-size: 0.875rem;
  margin: 0;
}

.sessions-enter-active,
.sessions-leave-active {
  transition: all 0.3s ease;
}

.sessions-enter-from,
.sessions-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}
</style>
