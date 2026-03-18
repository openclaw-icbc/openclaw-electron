/**
 * Gateway 连接的 Composable
 */

import { useGatewayStore } from '@/stores'

export function useGateway() {
  const gatewayStore = useGatewayStore()

  async function connect(url: string, token?: string, password?: string) {
    return await gatewayStore.connect(url, token, password)
  }

  async function disconnect() {
    await gatewayStore.disconnect()
  }

  return {
    connect,
    disconnect,
    connected: gatewayStore.connected,
    connecting: gatewayStore.connecting
  }
}
