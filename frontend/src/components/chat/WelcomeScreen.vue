<template>
  <div class="welcome-screen">
    <div class="welcome-content">
      <h3 class="welcome-title">欢迎使用 OpenClaw Desktop Client</h3>
      <p class="welcome-subtitle">开始使用：</p>
      <ol class="welcome-steps">
        <li>点击右上角的 <strong>⚙️</strong> 设置按钮</li>
        <li>在设置中选择 <strong>Config</strong></li>
        <li>配置你的 Gateway URL 和 token</li>
        <li>点击 <strong>Save & Connect</strong></li>
        <li>在左侧选择一个会话或点击 <strong>+ 新建对话</strong> 创建新会话</li>
        <li>开始聊天！</li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
// Welcome screen component - 无需额外逻辑
</script>

<style scoped>
.welcome-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 1.25rem;
}

.welcome-content {
  text-align: center;
  color: hsl(var(--muted-foreground));
  max-width: 400px;
}

.welcome-title {
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 0.625rem;
}

.welcome-subtitle {
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
}

.welcome-steps {
  text-align: left;
  max-width: 400px;
  margin: 0 auto;
  list-style: decimal;
  list-style-position: inside;
  space-y: 0.25rem;
}

.welcome-steps li {
  padding: 0.25rem 0;
  font-size: 0.875rem;
}

.welcome-steps strong {
  color: hsl(var(--foreground));
}
</style>
