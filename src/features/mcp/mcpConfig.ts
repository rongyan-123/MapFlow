import type { OnboardingAgentClient } from '../learning-entry/onboardingState';

export const MAPFLOW_MCP_PACKAGE = '@mapflow-publish/mcp';
export const MAPFLOW_SKILL_SOURCE =
  'https://github.com/rongyan-123/MapFlow/tree/017b5f96111fa73297e7603645681a7e7f4dc411/skills/mapflow';
export const MAPFLOW_PROJECT_TASK =
  '根据当前项目建立我的学习地图：请读取当前项目，使用 MapFlow Skill 生成一张学习地图，完成后先让我确认，再创建到我的 MapFlow 个人学习中。';

export interface McpClientConfig {
  id: OnboardingAgentClient;
  label: string;
  command: string;
  args: string[];
  registrationCommand: string | null;
}

export function getMcpClientConfig(client: OnboardingAgentClient): McpClientConfig {
  switch (client) {
    case 'codex':
      return {
        id: client,
        label: 'Codex',
        command: 'npx',
        args: ['-y', MAPFLOW_MCP_PACKAGE],
        registrationCommand: `codex mcp add mapflow -- npx -y ${MAPFLOW_MCP_PACKAGE}`,
      };
    case 'claude-code':
      return {
        id: client,
        label: 'Claude Code',
        command: 'npx',
        args: ['-y', MAPFLOW_MCP_PACKAGE],
        registrationCommand: `claude mcp add --transport stdio mapflow -- npx -y ${MAPFLOW_MCP_PACKAGE}`,
      };
    case 'other':
      return {
        id: client,
        label: '其他 MCP Agent',
        command: 'npx',
        args: ['-y', MAPFLOW_MCP_PACKAGE],
        registrationCommand: null,
      };
  }
}

export function getSkillInstallCommand(
  client: OnboardingAgentClient,
  source = MAPFLOW_SKILL_SOURCE,
): string {
  const agentFlag = client === 'other' ? '' : ` --agent ${client}`;
  return `npx skills add ${source} --skill mapflow${agentFlag}`;
}

export const MCP_VERIFICATION_COMMANDS = ['whoami', 'get_progress'] as const;
