import type { TeamConfig } from '@/types/team'

export const DEFAULT_TEAMS: TeamConfig[] = [
  {
    id: 'dev-team',
    name: '开发团队',
    description: '架构设计 → 编码开发 → 测试验证的完整开发流程',
    emoji: '🎯',
    leadAgentId: 'dev-team-lead',
    members: [
      { agentId: 'dev-team-lead', role: 'Lead', emoji: '👑' },
      { agentId: 'architect-expert', role: '架构师', emoji: '🏗️' },
      { agentId: 'developer-expert', role: '开发工程师', emoji: '💻' },
      { agentId: 'tester-expert', role: '测试工程师', emoji: '🧪' },
    ],
  },
  {
    id: 'essay-team',
    name: '高考作文阅卷团队',
    description: '出题 → 写作 → 阅卷评分',
    emoji: '📝',
    leadAgentId: 'essay-team-lead',
    members: [
      { agentId: 'essay-team-lead', role: 'Lead', emoji: '📝' },
      { agentId: 'examiner-agent', role: '阅卷老师', emoji: '📋' },
      { agentId: 'student-agent', role: '学生', emoji: '🎓' },
    ],
  },
]
