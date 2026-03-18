<template>
  <div class="title-bar">
    <div class="title-bar-content" style="-webkit-app-region: drag;">
      <div class="title-bar-title">OpenClaw Desktop Client</div>
    </div>
    <div class="title-bar-controls" style="-webkit-app-region: no-drag;">
      <button
        class="title-bar-button minimize-btn"
        title="最小化"
        @click="minimize"
      >
        <span>─</span>
      </button>
      <button
        class="title-bar-button maximize-btn"
        title="最大化"
        @click="maximize"
      >
        <span>□</span>
      </button>
      <button
        class="title-bar-button close-btn"
        title="关闭"
        @click="close"
      >
        <span>✕</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
function minimize() {
  if (window.electronAPI?.minimizeWindow) {
    window.electronAPI.minimizeWindow()
  }
}

function maximize() {
  if (window.electronAPI?.maximizeWindow) {
    window.electronAPI.maximizeWindow()
  }
}

function close() {
  if (window.electronAPI?.closeWindow) {
    window.electronAPI.closeWindow()
  }
}
</script>

<style scoped>
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  background: hsl(var(--muted) / 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
}

.title-bar-content {
  display: flex;
  align-items: center;
  padding: 0 0.625rem;
  flex: 1;
  height: 100%;
}

.title-bar-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--foreground) / 0.7);
  letter-spacing: 0.05em;
}

.title-bar-controls {
  display: flex;
  height: 100%;
}

.title-bar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  background: none;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.title-bar-button:hover {
  background: hsl(var(--muted) / 0.5);
}

.title-bar-button.close-btn:hover {
  background: hsl(var(--destructive));
}

.title-bar-button span {
  font-size: 0.6875rem;
  font-weight: 400;
  opacity: 0.8;
}

.title-bar-button:hover span {
  opacity: 1;
}
</style>
