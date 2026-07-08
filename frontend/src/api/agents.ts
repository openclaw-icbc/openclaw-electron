export async function fetchAgents(): Promise<any> {
  const result = await window.electronAPI.listAgents()
  if (!result.success) {
    throw new Error(result.error || '获取 Agent 列表失败')
  }
  return result.data
}
