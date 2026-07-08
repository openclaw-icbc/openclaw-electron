<template>
  <div class="team-plan-card">
    <!-- Header: title + cumulative stats -->
    <div class="plan-header">
      <div class="plan-title">
        <Icon name="clipboard-list" :size="14" />
        <span>协作计划</span>
      </div>
      <div v-if="progress" class="plan-stats">
        <span v-if="progress.completed > 0" class="stat-completed">
          已完成 {{ progress.completed }} 项
        </span>
        <span v-if="progress.working > 0" class="stat-working">
          {{ progress.working }} 进行中
        </span>
      </div>
    </div>

    <!-- Plan items -->
    <div class="plan-items">
      <div
        v-for="item in planItems"
        :key="item.id"
        class="plan-item"
        :class="`plan-item-${item.status}`"
        @click="handleItemClick(item)"
      >
        <!-- Avatar -->
        <AgentAvatar :name="item.label" :size="24" />

        <!-- Label -->
        <span class="plan-item-label">{{ item.label }}</span>

        <!-- Status badge -->
        <span class="plan-item-badge" :class="`badge-${item.status}`">
          <!-- Working: spinner -->
          <svg v-if="item.status === 'working'" class="badge-spinner" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"/>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75"/>
          </svg>
          <!-- Completed: check -->
          <svg v-else-if="item.status === 'completed'" class="badge-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <!-- Error: x -->
          <svg v-else-if="item.status === 'error'" class="badge-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <!-- Pending: dot -->
          <span v-else class="badge-dot"></span>

          <span class="badge-text">
            <template v-if="item.status === 'pending'">等待中</template>
            <template v-else-if="item.status === 'working'">工作中</template>
            <template v-else-if="item.status === 'completed'">已完成</template>
            <template v-else-if="item.status === 'error'">出错</template>
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTeamStore } from '@/stores/team'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import Icon from '@/components/common/Icon.vue'
import type { PlanItem } from '@/types/team'

const teamStore = useTeamStore()

const planItems = computed(() => teamStore.currentPlan?.items ?? [])
const progress = computed(() => teamStore.planProgress)

function handleItemClick(item: PlanItem) {
  if (item.agentId) {
    teamStore.selectMember(item.agentId)
  }
}
</script>

<style scoped>
.team-plan-card {
  margin: 0.75rem 1.25rem 0;
  padding: 0.75rem 0.875rem;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  flex-shrink: 0;
}

/* ===== Header ===== */
.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.plan-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.plan-progress-text {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

/* ===== Stats ===== */
.plan-stats {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.stat-completed {
  font-size: 0.6875rem;
  font-weight: 500;
  color: hsl(152, 69%, 41%);
  font-variant-numeric: tabular-nums;
}

.stat-working {
  font-size: 0.6875rem;
  font-weight: 500;
  color: hsl(var(--primary));
  font-variant-numeric: tabular-nums;
}

/* ===== Plan items ===== */
.plan-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}

.plan-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.plan-item:hover {
  background: hsl(var(--muted) / 0.5);
}

/* ===== Row status styles ===== */
.plan-item-pending {
  opacity: 0.55;
}

.plan-item-working {
  background: hsl(var(--primary) / 0.06);
  opacity: 1;
}

.plan-item-completed {
  opacity: 1;
}

.plan-item-error {
  opacity: 1;
}

/* ===== Label ===== */
.plan-item-label {
  flex: 1;
  font-size: 0.8125rem;
  color: hsl(var(--foreground));
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;
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

/* Pending */
.badge-pending {
  color: hsl(var(--muted-foreground));
}

.badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: hsl(var(--muted-foreground) / 0.4);
}

/* Working */
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

/* Completed */
.badge-completed {
  color: hsl(152, 69%, 41%);
  background: hsl(152, 69%, 41% / 0.1);
}

.badge-check {
  width: 12px;
  height: 12px;
  color: hsl(152, 69%, 41%);
}

/* Error */
.badge-error {
  color: hsl(0, 84%, 60%);
  background: hsl(0, 84%, 60% / 0.1);
}

.badge-error .badge-error {
  width: 12px;
  height: 12px;
}

.badge-text {
  line-height: 1;
}

/* ===== Animations ===== */
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
