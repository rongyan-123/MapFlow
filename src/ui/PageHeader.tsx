import { useContext, type ReactNode } from 'react';
import { FrameContext } from './AppFrame';
import { IconButton } from './Button';

export function PageHeader({ title, actions, context }: { title: string; actions?: ReactNode; context?: ReactNode }) {
  const frame = useContext(FrameContext);
  return <header className="mf-page-header">
    {frame && <IconButton className="mf-mobile-only" icon="menu" label="打开功能菜单" onClick={frame.openNavigation} />}
    <div className="mf-page-header-title"><span className="mf-desktop-only mf-header-breadcrumb">工作空间 <span>/</span></span><h1 title={title}>{title}</h1></div>
    {context && <div className="mf-page-header-context">{context}</div>}
    <div className="mf-page-header-actions">{actions}</div>
  </header>;
}
