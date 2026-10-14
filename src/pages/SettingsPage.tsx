import { useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '../domains/identity/IdentityContext';
import { THEME_OPTIONS,useTheme } from '../domains/identity/useTheme';
import { readCreditSummary,signInForCredit,formatCreditAmount } from '../api/creditClient';
import { describePublicError } from '../lib/publicErrors';
import type { Navigate } from '../app/useLocation';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

export default function SettingsPage({navigate}:{navigate:Navigate}) {
  const identity=useIdentity();const {theme,setTheme}=useTheme();const queryClient=useQueryClient();
  const [logoutConfirmation,setLogoutConfirmation]=useState(false);
  const creditKey=['credit',identity.session?.account.playerId];
  const credit=useQuery({queryKey:creditKey,queryFn:readCreditSummary,enabled:!!identity.session,retry:false});
  const signin=useMutation({mutationFn:()=>signInForCredit(identity.session!.csrfToken),onSuccess:()=>queryClient.invalidateQueries({queryKey:creditKey})});
  return <><PageHeader title="账号与设置" /><div className="mf-content"><main className="mf-page mf-stack"><div className="mf-page-heading"><div><h1>让学习，合你的习惯。</h1><p>账号、外观与学习积分。</p></div></div>
    <section className="mf-card"><div className="mf-section-title"><h2>我的账号</h2></div>{identity.session ? <><div className="mf-row mf-row--between mf-wrap"><div><strong>{identity.session.account.username}</strong><p className="mf-muted mf-small">账号 ID：{identity.session.account.playerId}</p></div><Button disabled={identity.logoutPending} onClick={()=>setLogoutConfirmation(true)}>{identity.logoutPending?'正在退出…':'退出登录'}</Button></div>{identity.logoutError && <p role="alert" className="mf-status mf-status--error">{describePublicError(identity.logoutError)}</p>}</> : <Button variant="primary" onClick={()=>navigate('/login')}>登录账号</Button>}</section>
    <section className="mf-card mf-stack"><h2>外观</h2><label className="mf-field mf-setting-select">界面主题<select aria-label="界面主题" value={theme} onChange={event=>setTheme(event.target.value)}>{THEME_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label><p className="mf-muted mf-small">主题保存到当前设备，下一次打开时继续使用。</p></section>
    {identity.session && <section className="mf-card mf-stack"><h2>学习积分</h2>{credit.isPending && <p role="status" className="mf-status">正在读取积分…</p>}{credit.error && <p role="alert" className="mf-status mf-status--error">{describePublicError(credit.error)} <Button onClick={()=>void credit.refetch()}>重试</Button></p>}{credit.data && <div className="mf-row mf-row--between mf-wrap"><p>当前积分 <strong>{formatCreditAmount(credit.data.balance)}</strong></p><Button variant="primary" aria-label={credit.data.signedInToday?'今日已签到':'签到领取积分'} disabled={credit.data.signedInToday||signin.isPending} onClick={()=>signin.mutate()}>{signin.isPending?'签到中…':credit.data.signedInToday?'今日已签到':'签到领取积分'}</Button></div>}{signin.data && <p role="status" className="mf-status">签到成功，获得 {formatCreditAmount(signin.data.awarded)} 积分。</p>}{signin.error && <p role="alert" className="mf-status mf-status--error">{describePublicError(signin.error)}</p>}</section>}
    <section className="mf-card mf-stack"><h2>模型与额度</h2><div className="mf-row mf-wrap"><Button onClick={()=>navigate('/models')}>模型与价格</Button><Button onClick={()=>navigate('/wallet')}>充值与流水</Button>{identity.session?.account.isAdmin && <Button onClick={()=>navigate('/admin')}>管理后台</Button>}</div></section>
  </main></div>{logoutConfirmation&&identity.session&&<Dialog title="退出登录" onClose={()=>setLogoutConfirmation(false)} dismissible={!identity.logoutPending}><div className="mf-stack"><p>退出当前账号？已保存的地图和聊天会保留。</p>{identity.logoutError&&<p role="alert" className="mf-status mf-status--error">{describePublicError(identity.logoutError)}</p>}<div className="mf-row"><Button disabled={identity.logoutPending} onClick={()=>setLogoutConfirmation(false)}>取消</Button><Button variant="danger" disabled={identity.logoutPending} onClick={()=>void identity.logout().then(()=>setLogoutConfirmation(false)).catch(()=>{})}>{identity.logoutPending?'正在退出…':'确认退出'}</Button></div></div></Dialog>}</>;
}
