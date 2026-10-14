import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SafeMarkdown from './SafeMarkdown';

describe('SafeMarkdown',()=>{
  it('renders GFM while suppressing images and unsafe links',()=>{
    render(<SafeMarkdown markdown={'# 标题\n\n|A|B|\n|-|-|\n|1|2|\n\n![secret](https://x.test/a.png)\n\n[bad](javascript:alert(1)) [good](https://example.com)'}/>);
    expect(screen.getByRole('heading',{name:'标题'})).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link',{name:'good'})).toHaveAttribute('rel','noopener noreferrer');
    expect(screen.queryByRole('link',{name:'bad'})).not.toBeInTheDocument();
  });
});
