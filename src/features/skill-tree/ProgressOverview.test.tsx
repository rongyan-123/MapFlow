import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressOverview from './ProgressOverview';

describe('ProgressOverview', () => {
  it('calculates the tree percentage from partial node progress', () => {
    render(
      <ProgressOverview
        displayMode="personal"
        totalNodes={2}
        progress={[
          {
            node_id: 'node-1',
            status: 'in_progress',
            evidence: '',
            progress_percent: 37,
          },
          {
            node_id: 'node-2',
            status: 'completed',
            evidence: '',
            progress_percent: 100,
          },
        ]}
      />,
    );

    expect(screen.getByText('总进度 69%')).toBeInTheDocument();
    expect(screen.getByText('已完成 1')).toBeInTheDocument();
    expect(screen.getByText('进行中 1')).toBeInTheDocument();
    expect(screen.getByText('未开始 0')).toBeInTheDocument();
  });
});
