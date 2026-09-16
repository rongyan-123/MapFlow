import { describe, expect, it } from 'vitest';
import {
  MAPFLOW_MCP_PACKAGE,
  MAPFLOW_SKILL_SOURCE,
  getSkillInstallCommand,
  MAPFLOW_PROJECT_TASK,
  getMcpClientConfig,
} from './mcpConfig';

describe('MapFlow MCP client configuration', () => {
  it('uses an MCP registration command for Codex and Claude Code', () => {
    expect(getMcpClientConfig('codex').registrationCommand).toBe(
      'codex mcp add mapflow -- npx -y @mapflow-publish/mcp',
    );
    expect(getMcpClientConfig('claude-code').registrationCommand).toBe(
      'claude mcp add --transport stdio mapflow -- npx -y @mapflow-publish/mcp',
    );
  });

  it('keeps the generic client config and verified GitHub Skill source explicit', () => {
    expect(getMcpClientConfig('other').command).toBe('npx');
    expect(getMcpClientConfig('other').args).toEqual(['-y', MAPFLOW_MCP_PACKAGE]);
    expect(MAPFLOW_SKILL_SOURCE).toBe(
      'https://github.com/rongyan-123/MapFlow/tree/017b5f96111fa73297e7603645681a7e7f4dc411/skills/mapflow',
    );
    expect(MAPFLOW_PROJECT_TASK).toContain('根据当前项目建立我的学习地图');
    expect(getSkillInstallCommand('codex')).toBe(
      'npx skills add https://github.com/rongyan-123/MapFlow/tree/017b5f96111fa73297e7603645681a7e7f4dc411/skills/mapflow --skill mapflow --agent codex',
    );
    expect(getSkillInstallCommand('claude-code')).toBe(
      'npx skills add https://github.com/rongyan-123/MapFlow/tree/017b5f96111fa73297e7603645681a7e7f4dc411/skills/mapflow --skill mapflow --agent claude-code',
    );
  });
});
