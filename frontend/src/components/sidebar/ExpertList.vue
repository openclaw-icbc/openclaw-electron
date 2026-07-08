<template>
  <div class="expert-entry" @click="handleClick">
    <span class="text-sm font-semibold">专家</span>
    <span class="entry-arrow">→</span>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '@/stores'

const uiStore = useUiStore()

function handleClick() {
  uiStore.toggleExpertPanel()
}
</script>

<style scoped>
.expert-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 0.75rem 1rem;
  user-select: none;
  transition: background-color 0.15s ease;
}

.expert-entry:hover {
  background: hsl(var(--sidebar-hover));
}

.entry-arrow {
  font-size: 1rem;
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
}
</style>
