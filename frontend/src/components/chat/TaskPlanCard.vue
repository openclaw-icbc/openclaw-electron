<template>
  <div v-if="taskPlan" class="task-plan-card" :class="{ collapsed: isCollapsed }">
    <!-- 头部 -->
    <div class="plan-header" @click="isCollapsed = !isCollapsed">
      <div class="plan-header-left">
        <svg class="plan-header-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <span class="plan-title">任务计划</span>
        <span class="plan-count">{{ completedCount }}/{{ taskPlan.tasks.length }}</span>
      </div>
      <div class="plan-header-right">
        <span class="plan-progress-text">{{ progressPercent }}%</span>
        <svg class="plan-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ rotated: !isCollapsed }">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>

    <!-- 目标描述 -->
    <div v-if="taskPlan.goal && !isCollapsed" class="plan-goal">{{ taskPlan.goal }}</div>

    <!-- 进度条 -->
    <div v-show="!isCollapsed" class="plan-progress-track">
      <div class="plan-progress-fill" :style="{ width: progressPercent + '%' }"></div>
    </div>

    <!-- 任务列表 -->
    <div v-show="!isCollapsed" class="plan-task-list">
      <div
        v-for="(task, index) in taskPlan.tasks"
        :key="task.id"
        class="plan-task-item"
        :class="'status-' + (task.status || 'pending')"
      >
        <!-- 左侧时间线 -->
        <div class="task-timeline">
          <div class="task-node" :class="'node-' + (task.status || 'pending')">
            <!-- completed: checkmark -->
            <svg v-if="task.status === 'completed'" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <!-- working: spinner -->
            <div v-else-if="task.status === 'working'" class="node-spinner"></div>
            <!-- error: x -->
            <svg v-else-if="task.status === 'error'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <!-- pending: dot -->
            <div v-else class="node-dot"></div>
          </div>
          <div v-if="index < taskPlan.tasks.length - 1" class="task-connector" :class="{ 'connector-done': task.status === 'completed' }"></div>
        </div>

        <!-- 右侧内容 -->
        <div class="task-body">
          <div class="task-top-row">
            <span class="task-title" :class="{ 'title-done': task.status === 'completed' }">{{ task.title }}</span>
            <span class="task-badge" :class="'badge-' + (task.status || 'pending')">{{ getStatusLabel(task.status) }}</span>
          </div>
          <div class="task-bottom-row">
            <span v-if="task.assignee" class="task-assignee-tag">{{ getAssigneeName(task.assignee) }}</span>
            <span v-if="task.depends_on && task.depends_on.length" class="task-dep-text">依赖 {{ task.depends_on.join(', ') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

export interface TaskPlanTask {
  id: string
  title: string
  assignee: string
  description?: string
  depends_on?: string[]
  status?: 'pending' | 'working' | 'completed' | 'error'
}

export interface TaskPlan {
  goal: string
  tasks: TaskPlanTask[]
}

interface Props {
  taskPlan: TaskPlan | null
  agentNames?: Record<string, string>
  agentEmojis?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  taskPlan: null,
  agentNames: () => ({}),
  agentEmojis: () => ({})
})

const isCollapsed = ref(false)

const completedCount = computed(() => {
  if (!props.taskPlan) return 0
  return props.taskPlan.tasks.filter(t => t.status === 'completed').length
})

const progressPercent = computed(() => {
  if (!props.taskPlan || props.taskPlan.tasks.length === 0) return 0
  return Math.round((completedCount.value / props.taskPlan.tasks.length) * 100)
})

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'completed': return '已完成'
    case 'working': return '进行中'
    case 'error': return '失败'
    default: return '待执行'
  }
}

function getAssigneeName(agentId: string): string {
  return props.agentNames[agentId] || agentId
}
</script>

<style scoped>
.task-plan-card {
  margin: 0.5rem;
  border-radius: 12px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  box-shadow: 0 1px 3px hsl(var(--foreground) / 0.04), 0 1px 2px hsl(var(--foreground) / 0.06);
  overflow: hidden;
  flex-shrink: 0;
}

.task-plan-card.collapsed {
  border-color: hsl(var(--border));
  box-shadow: none;
}

/* ===== Header ===== */
.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
}

.plan-header:hover {
  background: hsl(var(--muted) / 0.4);
}

.plan-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.plan-header-icon {
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}

.plan-title {
  font-weight: 600;
  font-size: 13px;
  color: hsl(var(--foreground));
  letter-spacing: -0.01em;
}

.plan-count {
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
}

.plan-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.plan-progress-text {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
}

.plan-chevron {
  color: hsl(var(--muted-foreground));
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.plan-chevron.rotated {
  transform: rotate(180deg);
}

/* ===== Goal ===== */
.plan-goal {
  padding: 0 14px 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  line-height: 1.5;
}

/* ===== Progress Bar ===== */
.plan-progress-track {
  height: 2px;
  background: hsl(var(--muted) / 0.5);
}

.plan-progress-fill {
  height: 100%;
  background: hsl(var(--primary));
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ===== Task List ===== */
.plan-task-list {
  padding: 4px 0;
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.2) transparent;
}

.plan-task-list::-webkit-scrollbar {
  width: 4px;
}

.plan-task-list::-webkit-scrollbar-track {
  background: transparent;
}

.plan-task-list::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 2px;
}

.plan-task-list::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.35);
}

.plan-task-item {
  display: flex;
  gap: 10px;
  padding: 8px 14px 8px 10px;
  transition: background 0.12s ease;
}

.plan-task-item:hover {
  background: hsl(var(--muted) / 0.3);
}

.plan-task-item.status-working {
  background: hsl(var(--primary) / 0.04);
}

.plan-task-item.status-working:hover {
  background: hsl(var(--primary) / 0.07);
}

/* ===== Timeline (left column) ===== */
.task-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 22px;
  padding-top: 1px;
}

.task-node {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.node-pending {
  border: 1.5px solid hsl(var(--border));
  background: transparent;
}

.node-working {
  border: 2px solid hsl(var(--primary));
  background: hsl(var(--primary) / 0.08);
}

.node-completed {
  border: none;
  background: hsl(142, 76%, 40%);
  color: white;
}

.node-error {
  border: none;
  background: hsl(var(--destructive));
  color: white;
}

.node-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--muted-foreground) / 0.4);
}

.node-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid hsl(var(--primary) / 0.25);
  border-top-color: hsl(var(--primary));
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.task-connector {
  width: 1.5px;
  flex: 1;
  min-height: 8px;
  background: hsl(var(--border));
  margin: 3px 0;
}

.connector-done {
  background: hsl(142, 76%, 40% / 0.4);
}

/* ===== Task Body (right column) ===== */
.task-body {
  flex: 1;
  min-width: 0;
  padding-top: 1px;
}

.task-top-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-title {
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--foreground));
  line-height: 1.4;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-title.title-done {
  color: hsl(var(--muted-foreground));
  text-decoration: line-through;
}

/* ===== Status Badge ===== */
.task-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.01em;
}

.badge-pending {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 0.5);
}

.badge-working {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
}

.badge-completed {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 0.5);
}

.badge-error {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.1);
}

/* ===== Bottom Row ===== */
.task-bottom-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}

.task-assignee-tag {
  font-size: 11px;
  font-weight: 500;
  color: hsl(var(--foreground) / 0.7);
  background: hsl(var(--muted) / 0.5);
  padding: 0px 6px;
  border-radius: 4px;
  line-height: 1.6;
}

.task-dep-text {
  font-size: 11px;
  color: hsl(var(--muted-foreground) / 0.6);
}
</style>
