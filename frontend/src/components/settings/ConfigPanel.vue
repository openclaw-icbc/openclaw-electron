<template>
  <div class="config-panel">
    <h4 class="text-base font-semibold mb-4">配置</h4>

    <ConfirmDialog
      ref="confirmDialogRef"
      title="重新连接确认"
      message="配置已更改。是否使用新设置重新连接？"
      confirm-text="重新连接"
      cancel-text="取消"
      @confirm="onConfirmReconnect"
    />

    <div class="config-content">
      <div class="form-group">
        <label for="gateway-url" class="form-label">网关地址</label>
        <input
          id="gateway-url"
          v-model="localConfig.url"
          type="text"
          class="input"
          placeholder="ws://localhost:18789"
        />
      </div>
      <div class="form-group">
        <label for="gateway-token" class="form-label">网关令牌（可选）</label>
        <input
          id="gateway-token"
          v-model="localConfig.token"
          type="password"
          class="input"
          placeholder="输入网关令牌"
        />
      </div>
      <div class="form-group">
        <label for="gateway-password" class="form-label">网关密码（可选）</label>
        <input
          id="gateway-password"
          v-model="localConfig.password"
          type="password"
          class="input"
          placeholder="输入网关密码"
        />
      </div>
      <div class="button-group">
        <button class="btn btn-secondary" @click="handleTestConnection">
          测试连接
        </button>
        <button class="btn btn-primary" @click="handleSaveAndConnect">
          保存并连接
        </button>
      </div>
      <div v-if="status" class="status" :class="`status-${status.type}`">
        {{ status.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore, useGatewayStore, useUiStore, useChatStore } from '@/stores'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const configStore = useConfigStore()
const gatewayStore = useGatewayStore()
const uiStore = useUiStore()
const chatStore = useChatStore()

const { gateway } = storeToRefs(configStore)
const { connected } = storeToRefs(gatewayStore)

const localConfig = reactive({
  url: gateway.value.url,
  token: gateway.value.token || '',
  password: gateway.value.password || ''
})

const status = ref<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
const confirmDialogRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)

// Store pending config for reconnection
const pendingConfig = ref<any>(null)

function showConfigStatus(message: string, type: 'success' | 'error' | 'info') {
  status.value = { type, message }
}

async function handleTestConnection() {
  const config = {
    url: localConfig.url,
    token: localConfig.token || '',
    password: localConfig.password || ''
  }

  if (!config.url) {
    showConfigStatus('请输入 Gateway URL', 'error')
    return
  }

  // 检查是否已经连接
  if (gatewayStore.connected) {
    const currentGateway = configStore.gateway
    const configChanged =
      config.url !== currentGateway.url ||
      config.token !== currentGateway.token ||
      config.password !== currentGateway.password

    if (!configChanged) {
      showConfigStatus('✅ 已经使用这些设置连接！', 'success')
      return
    }

    // Store config and show dialog
    pendingConfig.value = config
    confirmDialogRef.value?.show()
    return
  }

  await doTestConnection(config)
}

async function onConfirmReconnect() {
  if (pendingConfig.value) {
    await doTestConnection(pendingConfig.value)
    pendingConfig.value = null
  }
}

async function doTestConnection(config: any) {
  showConfigStatus('正在测试连接...', 'info')

  try {
    // 测试连接
    const result = await window.electronAPI.connectGateway(config)

    if (result.success) {
      // 更新配置
      await configStore.updateGateway(config)

      showConfigStatus('✅ 连接测试成功！', 'success')
      uiStore.showToast('连接成功', 'success')

      // 加载会话列表
      const chatStore = useChatStore()
      try {
        await chatStore.loadSessions()
      } catch (error: any) {
        console.error('Failed to load sessions:', error)
      }
    } else {
      showConfigStatus(`❌ 连接失败: ${result.error}`, 'error')
      uiStore.showToast(result.error || '连接失败', 'error')
    }
  } catch (error: any) {
    showConfigStatus(`❌ 连接测试错误: ${error.message}`, 'error')
    uiStore.showToast(error.message || '连接测试失败', 'error')
  }
}

async function handleSaveAndConnect() {
  const config = {
    url: localConfig.url,
    token: localConfig.token || '',
    password: localConfig.password || ''
  }

  if (!config.url) {
    showConfigStatus('请输入 Gateway URL', 'error')
    return
  }

  // 检查是否已经连接
  if (connected.value) {
    const configChanged =
      config.url !== gateway.value.url ||
      config.token !== gateway.value.token ||
      config.password !== gateway.value.password

    if (!configChanged) {
      showConfigStatus('✅ 已连接！配置已保存。', 'success')
      return
    }
  }

  showConfigStatus('正在保存配置...', 'info')

  try {
    // 先保存配置
    const saved = await configStore.updateGateway(config)
    if (!saved) {
      throw new Error('保存配置失败')
    }

    showConfigStatus('正在连接...', 'info')

    // 连接到 Gateway
    const result = await window.electronAPI.connectGateway(config)

    if (result.success) {
      showConfigStatus('✅ 连接成功！', 'success')
      uiStore.showToast('连接成功！', 'success')

      // 加载会话列表
      try {
        await chatStore.loadSessions()
      } catch (error: any) {
        console.error('Failed to load sessions:', error)
      }
    } else {
      showConfigStatus(`❌ 连接失败: ${result.error}`, 'error')
      uiStore.showToast(result.error || '连接失败', 'error')
    }
  } catch (error: any) {
    showConfigStatus(`❌ 错误: ${error.message}`, 'error')
    uiStore.showToast(error.message || '操作失败', 'error')
  }
}
</script>

<style scoped>
.config-content {
  max-width: 500px;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--input));
  border-radius: calc(var(--radius) - 4px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.button-group {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.status {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: calc(var(--radius) - 4px);
  font-size: 0.875rem;
}

.status-success {
  background: hsl(142, 76%, 96%);
  color: hsl(142, 76%, 36%);
  border: 1px solid hsl(142, 76%, 80%);
}

.status-error {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
  border: 1px solid hsl(var(--destructive) / 0.3);
}
</style>
