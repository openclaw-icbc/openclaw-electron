<template>
  <div class="team-panel" v-if="teamStore.activeTeam && teamStore.panelExpanded" :style="{ width: `${panelWidth}px`, flexBasis: `${panelWidth}px`, flexShrink: 0, flexGrow: 0, maxWidth: `${panelWidth}px` }">
    <!-- Resizer handle (left edge) -->
    <div class="team-panel-resizer" title="拖拽调整宽度" @mousedown="startResize"></div>

    <!-- 任务计划（从 Lead Agent 的 json-plan 输出中提取） -->
    <TaskPlanCard
      v-if="taskPlan"
      :task-plan="taskPlan"
      :agent-names="agentNameMap"
      :agent-emojis="agentEmojiMap"
    />

    <div class="team-members-card">
    <div class="team-panel-header">
      <span class="team-panel-title">团队成员</span>
      <div class="header-stats">
        <span v-if="progress && progress.completed > 0" class="stat-completed">已完成 {{ progress.completed }} 项</span>
        <span v-if="progress && progress.working > 0" class="stat-working">{{ progress.working }} 进行中</span>
      </div>
      <button class="panel-close-btn" @click="teamStore.togglePanel()">✕</button>
    </div>

    <!-- 成员计划清单 -->
    <div class="plan-list">
      <div
        v-for="member in memberList"
        :key="member.agentId"
        class="plan-item"
        :class="`plan-item-${getStatusName(member.agentId)}`"
        @click="handleMemberClick(member.agentId)"
      >
        <AgentAvatar :name="member.role" :size="36" />
        <span class="plan-item-label">{{ member.role }}</span>
        <span class="plan-item-badge" :class="`badge-${getStatusName(member.agentId)}`">
          <!-- Working: spinner -->
          <svg v-if="getStatusName(member.agentId) === 'working'" class="badge-spinner" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"/>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75"/>
          </svg>
          <!-- Completed: check -->
          <svg v-else-if="getStatusName(member.agentId) === 'completed'" class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <!-- Error: x -->
          <svg v-else-if="getStatusName(member.agentId) === 'error'" class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <!-- Pending: dot -->
          <span v-else class="badge-dot"></span>
          <span class="badge-text">{{ getStatusLabel(member.agentId) || '等待中' }}</span>
        </span>
      </div>
    </div>

    <!-- 选中成员的实时会话 -->
    <div v-if="teamStore.selectedMemberId" class="member-detail">
      <div class="member-detail-header">
        <span>{{ selectedMemberName }} 的会话</span>
        <div class="member-detail-actions">
          <button class="panel-close-btn" @click="refreshMemberMessages()" title="刷新">↻</button>
          <button class="panel-close-btn" @click="teamStore.selectMember(null)">✕</button>
        </div>
      </div>
      <div v-if="memberLoading" class="member-loading">加载中...</div>
      <div v-else class="member-messages" ref="messagesContainer">
        <div v-if="liveMessages.length === 0" class="member-empty">等待任务分配...</div>
        <div
          v-for="msg in liveMessages"
          :key="msg.id"
          class="member-msg"
          :class="`role-${msg.role}`"
        >
          <div class="msg-role-label">{{ msg.role === 'user' ? '任务' : msg.role === 'assistant' ? '回复' : '系统' }}</div>
          <div class="msg-content" v-html="renderMarkdown(msg.content)"></div>
        </div>
      </div>
    </div>
    <div v-else class="member-detail-empty">
      <span>点击上方成员查看其会话</span>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useTeamStore, useChatStore, useAgentsStore } from '@/stores'
import { renderMarkdownSync } from '@/utils/markdown'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import TaskPlanCard from '@/components/chat/TaskPlanCard.vue'

const teamStore = useTeamStore()
const chatStore = useChatStore()
const agentsStore = useAgentsStore()

const memberLoading = ref(false)
const panelWidth = ref(420)
const messagesContainer = ref<HTMLElement>()

// 计划进度统计
const progress = computed(() => teamStore.planProgress)

// 排除 Lead
const memberList = computed(() => {
  if (!teamStore.activeTeam) return []
  return teamStore.activeTeam.members.filter(
    m => m.agentId !== teamStore.activeTeam!.leadAgentId
  )
})

const selectedMemberName = computed(() => {
  if (!teamStore.selectedMemberId || !teamStore.activeTeam) return ''
  const member = teamStore.activeTeam.members.find(m => m.agentId === teamStore.selectedMemberId)
  return member?.role || ''
})

const isExecuting = computed(() => chatStore.currentSessionKey === teamStore.currentPlan?.sessionId)

const taskPlan = computed(() => chatStore.currentTaskPlan)

const agentNameMap = computed(() => {
  const map: Record<string, string> = {}
  const team = teamStore.activeTeam
  if (team) {
    for (const member of team.members) {
      const agent = agentsStore.getAgentById(member.agentId)
      map[member.agentId] = agent?.name || member.role
    }
  }
  return map
})

const agentEmojiMap = computed(() => {
  const map: Record<string, string> = {}
  const team = teamStore.activeTeam
  if (team) {
    for (const member of team.members) {
      map[member.agentId] = member.emoji || '🤖'
    }
  }
  return map
})

// 从 chatStore 读取实时消息（WS 推送自动更新）
// 使用 Lead session key 的 channel 派生成员 session key，保证会话隔离
const memberSessionKey = computed(() => {
  if (!teamStore.selectedMemberId) return ''
  const leadKey = chatStore.currentSessionKey
  if (leadKey) {
    const parts = leadKey.split(':')
    const channel = parts.slice(2).join(':')
    if (channel) return `agent:${teamStore.selectedMemberId}:${channel}`
  }
  return `agent:${teamStore.selectedMemberId}:main`
})

const liveMessages = computed(() => {
  if (!memberSessionKey.value) return []
  return chatStore.messages[memberSessionKey.value] || []
})

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    setTimeout(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }, 0)
  })
}

// 切换成员时立即滚到底部
watch(memberSessionKey, () => {
  // 延迟两帧确保 DOM 已渲染新成员的消息
  nextTick(() => nextTick(() => scrollToBottom()))
})

// 新消息到达时自动滚到底部
watch(liveMessages, () => {
  scrollToBottom()
}, { deep: true })

// 状态相关（映射 memberStatus → plan item 状态名）
function getStatusName(agentId: string): string {
  if (isExecuting.value) {
    // 当前执行中的会话：用实时 memberStatuses（sessions_send 事件驱动）
    const state = teamStore.getMemberStatus(agentId).state
    if (state === 'idle') return 'pending'
    if (state === 'busy') return 'working'
    return 'completed'
  }
  // 历史会话：用任务计划的解析状态（[PLAN_PROGRESS] 标记），不跟随当前执行中的实时状态
  const plan = chatStore.currentTaskPlan
  const task = plan?.tasks.find(t => t.assignee === agentId)
  return task?.status || 'pending'
}

function getStatusClass(agentId: string): string {
  const status = teamStore.getMemberStatus(agentId)
  return `status-ring-${status.state}`
}

function getStatusDot(agentId: string): string {
  const status = teamStore.getMemberStatus(agentId)
  if (status.state === 'idle') return ''
  return `dot-${status.state}`
}

function getStatusLabel(agentId: string): string {
  const s = getStatusName(agentId)
  if (s === 'pending') return '等待中'
  if (s === 'working') return '工作中'
  if (s === 'completed') return '已完成'
  if (s === 'error') return '出错'
  return ''
}

// Markdown 渲染
function renderMarkdown(content: string): string {
  if (!content) return ''
  try {
    return renderMarkdownSync(content)
  } catch {
    return content.replace(/\n/g, '<br>')
  }
}

// 点击成员
async function handleMemberClick(agentId: string) {
  // 点击已选中的成员不做任何操作，保持选中状态
  if (teamStore.selectedMemberId === agentId) {
    return
  }
  teamStore.selectMember(agentId)
}

// 刷新按钮
async function refreshMemberMessages() {
  if (teamStore.selectedMemberId) {
    await loadMemberHistory(teamStore.selectedMemberId)
  }
}

// 加载历史记录（首次选中时）
async function loadMemberHistory(agentId: string) {
  memberLoading.value = true
  // 使用 memberSessionKey 的派生逻辑，保证和实时订阅的 key 一致
  const leadKey = chatStore.currentSessionKey
  let sessionKey = `agent:${agentId}:main`
  if (leadKey) {
    const parts = leadKey.split(':')
    const channel = parts.slice(2).join(':')
    if (channel) sessionKey = `agent:${agentId}:${channel}`
  }

  try {
    const result = await window.electronAPI.getChatHistory(sessionKey, 100)
    if (result.success && result.data) {
      let messagesData = result.data
      if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
        const resp = result.data as { messages?: any; data?: any; items?: any }
        messagesData = resp.messages || resp.data || resp.items || []
      }
      if (Array.isArray(messagesData) && messagesData.length > 0) {
        // 只在 chatStore 没有该 session 的缓存时才写入历史
        if (!chatStore.messages[sessionKey] || chatStore.messages[sessionKey].length === 0) {
          chatStore.messages[sessionKey] = messagesData.map((msg: any, idx: number) => ({
            id: msg.id || msg.messageId || `hist-${idx}-${Math.random()}`,
            role: normalizeRole(msg),
            content: extractContent(msg),
            timestamp: msg.timestamp || msg.createdAt || Date.now(),
            status: 'sent' as const,
          }))
        }
      }
    }
  } catch (e: any) {
    console.error(`[TeamPanel] Failed to load history for ${agentId}:`, e)
  } finally {
    memberLoading.value = false
    // 加载完成后滚到底部
    nextTick(() => nextTick(() => scrollToBottom()))
  }
}

function normalizeRole(msg: any): 'user' | 'assistant' | 'system' {
  const role = (msg.role || msg.sender || msg.type || '').toLowerCase()
  if (role === 'user' || role === 'human') return 'user'
  if (role === 'assistant' || role === 'ai' || role === 'bot' || role === 'model') return 'assistant'
  return 'system'
}

function extractContent(msg: any): string {
  let content = msg.content || msg.text || msg.body || msg.message || ''
  if (Array.isArray(content)) {
    content = content
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (part?.type === 'text' && part.text) return part.text
        if (part?.type === 'toolCall' || part?.type === 'tool_use') return `[工具调用: ${part.name || 'unknown'}]`
        if (part?.type === 'tool_result' || part?.type === 'toolResult') return `[工具结果]`
        if (part?.content) return typeof part.content === 'string' ? part.content : JSON.stringify(part.content)
        if (part?.text) return part.text
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return content
}

// 首次选中时加载历史，之后靠 WS 实时推送
watch(() => teamStore.selectedMemberId, async (newId) => {
  if (newId) {
    await loadMemberHistory(newId)
  }
})

// 拖拽调整宽度
function startResize(event: MouseEvent) {
  const startX = event.clientX
  const startWidth = panelWidth.value

  function onMouseMove(e: MouseEvent) {
    panelWidth.value = Math.max(280, Math.min(900, startWidth + (startX - e.clientX)))
  }
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.team-panel {
  min-width: 0;
  max-width: 900px;
  border-left: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  height: 100%;
  contain: layout style paint;
}

.team-panel-resizer {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
  transition: background 0.15s ease;
}
.team-panel-resizer:hover,
.team-panel-resizer:active {
  background: hsl(var(--primary));
}

.team-members-card {
  margin: 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  background: hsl(var(--background));
  box-shadow: 0 1px 3px hsl(var(--foreground) / 0.04), 0 1px 2px hsl(var(--foreground) / 0.06);
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.team-panel-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex: 1;
  justify-content: flex-end;
  margin-right: 0.5rem;
}

.stat-completed {
  font-size: 0.6875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
}

.stat-working {
  font-size: 0.6875rem;
  font-weight: 500;
  color: hsl(var(--primary));
  font-variant-numeric: tabular-nums;
}

.panel-close-btn {
  background: none; border: none; cursor: pointer;
  color: hsl(var(--muted-foreground));
  font-size: 0.9rem; padding: 0.25rem 0.4rem;
  border-radius: 0.25rem; line-height: 1;
}
.panel-close-btn:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

/* ===== 成员计划清单 ===== */
.plan-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  justify-content: flex-start;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
}

.plan-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.375rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.15s ease;
  width: 72px;
  text-align: center;
  flex-shrink: 0;
}

.plan-item:hover {
  background: hsl(var(--muted) / 0.5);
}

.plan-item.active {
  background: hsl(var(--muted));
}

.plan-item-pending {
  opacity: 0.55;
}

.plan-item-working {
  background: hsl(var(--primary) / 0.06);
  opacity: 1;
}

.plan-item-completed,
.plan-item-error {
  opacity: 1;
}

.plan-item-label {
  font-size: 0.75rem;
  color: hsl(var(--foreground));
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.plan-item-working .plan-item-label {
  font-weight: 500;
}

.plan-item-completed .plan-item-label {
  color: hsl(var(--muted-foreground));
}

/* ===== Status badge ===== */
.plan-item-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  transition: all 0.3s ease;
}

.badge-pending {
  color: hsl(var(--muted-foreground));
}

.badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: hsl(var(--muted-foreground) / 0.4);
}

.badge-working {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
}

.badge-spinner {
  width: 12px;
  height: 12px;
  color: hsl(var(--primary));
  animation: spin 1s linear infinite;
}

.badge-completed {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.badge-error {
  color: hsl(0, 84%, 60%);
  background: hsl(0, 84%, 60% / 0.1);
}

.badge-icon {
  width: 12px;
  height: 12px;
}

.badge-text {
  line-height: 1;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 成员会话区 ===== */
.member-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.member-detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.member-detail-header {
  padding: 0.625rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}

.member-detail-actions {
  display: flex;
  gap: 0.25rem;
}

.member-loading,
.member-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
}

.member-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.875rem 1rem;
  min-height: 0;
}

.member-msg {
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  line-height: 1.5;
  max-width: 100%;
  overflow: hidden;
}

.role-user {
  background: hsl(var(--primary) / 0.08);
}
.role-assistant {
  background: hsl(var(--muted) / 0.4);
}
.role-system {
  background: hsl(var(--muted) / 0.4);
}

.msg-role-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.25rem;
}

.msg-content {
  word-break: break-word;
  color: hsl(var(--foreground));
  overflow-x: hidden;
  max-width: 100%;
}

.msg-content :deep(table) {
  max-width: 100%;
  overflow-x: auto;
  display: block;
}

.msg-content :deep(img) {
  max-width: 100%;
  height: auto;
}
.msg-content :deep(pre) {
  background: hsl(var(--muted));
  padding: 0.5rem;
  border-radius: 0.25rem;
  overflow-x: auto;
  font-size: 0.75rem;
  max-width: 100%;
  white-space: pre-wrap;
  word-break: break-all;
}
.msg-content :deep(code) {
  background: hsl(var(--muted));
  padding: 0.125rem 0.25rem;
  border-radius: 0.2rem;
  font-size: 0.75rem;
}
.msg-content :deep(p) { margin: 0.25rem 0; }
</style>
