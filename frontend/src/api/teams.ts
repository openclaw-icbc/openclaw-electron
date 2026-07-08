import type { TeamConfig } from '@/types/team'

export async function getTeams(): Promise<TeamConfig[]> {
  return await window.electronAPI.getTeams()
}

export async function saveTeams(teams: TeamConfig[]): Promise<boolean> {
  return await window.electronAPI.saveTeams(teams)
}
