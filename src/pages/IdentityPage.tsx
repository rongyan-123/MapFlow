import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchRegistrationChallenge, type RegistrationChallenge } from '../api/identityClient';
import { useIdentity } from '../domains/identity/IdentityContext';
import { passwordRules, validateRegistration, type RegistrationFormValues } from '../domains/identity/validation';
import { describePublicError } from '../lib/publicErrors';
import type { Navigate } from '../app/useLocation';
import { Button } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';
import { WelcomeArtwork } from '../ui/WelcomeArtwork';

const emptyRegistration: RegistrationFormValues = {username:'',password:'',confirmPassword:'',email:'',phone:''};

export default function IdentityPage({ mode, navigate, onAuthenticated }: {
  mode: 'login' | 'register'; navigate: Navigate; onAuthenticated: () => void;
}) {
  const identity = useIdentity();
  const [registration, setRegistration] = useState(emptyRegistration);
  const [login, setLogin] = useState({username:'',password:''});
  const [localError, setLocalError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<RegistrationChallenge | null>(null);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const challengeController = useRef<AbortController | null>(null);
  const refreshChallenge = useCallback(async () => {
    challengeController.current?.abort();
    const controller = new AbortController();
    challengeController.current = controller;
    setChallenge(null); setChallengeAnswer(''); setChallengeError(null);
    try {
      const question = await fetchRegistrationChallenge(controller.signal);
      if (!controller.signal.aborted) setChallenge(question);
    } catch (error) {
      if (!controller.signal.aborted) setChallengeError(describePublicError(error, '验证题加载失败，请重试。'));
    }
  }, []);
  useEffect(() => {
    if (mode === 'register') void refreshChallenge();
    return () => challengeController.current?.abort();
  }, [mode, refreshChallenge]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (identity.authenticationPending) return;
    if (mode === 'login') {
      if (!login.username || !login.password) {setLocalError('请输入用户名和密码。'); return;}
      setLocalError(null);
      try {await identity.authenticateLogin(login); onAuthenticated();} catch { /* The identity controller exposes the safe error. */ }
    } else {
      const validationError = validateRegistration(registration);
      if (validationError) {setLocalError(validationError); return;}
      if (!challenge || !/^\d{1,2}$/.test(challengeAnswer.trim())) {setLocalError('请输入计算结果。'); return;}
      setLocalError(null);
      const email = registration.email.trim(); const phone = registration.phone.trim();
      try {
        await identity.authenticateRegistration({username:registration.username,password:registration.password,
          challengeId:challenge.challengeId,challengeAnswer:challengeAnswer.trim(),...(email ? {email} : {}),...(phone ? {phone} : {})});
        onAuthenticated();
      } catch {void refreshChallenge();}
    }
  }
  const visibleError = localError ?? (identity.authenticationError ? describePublicError(identity.authenticationError) : null);
  const registrationField = (field: keyof RegistrationFormValues, value: string) => setRegistration(current => ({...current,[field]:value}));
  return <div className="mf-auth-page">
    <header className="mf-auth-header"><button className="mf-brand" onClick={()=>navigate('/?marketing=1')}><span className="mf-brand-mark"><BrandMark /></span>MapFlow</button><Button variant="quiet" onClick={()=>navigate('/?marketing=1')}>返回首页</Button></header>
    <main className="mf-auth-body"><aside className="mf-auth-story"><WelcomeArtwork /><p className="mf-eyebrow">A CLEARER WAY TO LEARN</p><h2>想学的那件事，<br />值得好好开始。</h2><p>把零散的兴趣，连成可以走的路。</p></aside><section className="mf-auth-card">
      <p className="mf-eyebrow">YOUR LEARNING, CONNECTED</p>
      <h1>{mode === 'login' ? '欢迎回来' : '开始你的学习旅程'}</h1>
      <p className="mf-muted">{mode === 'login' ? '继续探索，找到下一步。' : '把想学的事，变成清晰的路线。'}</p>
      <form className="mf-stack" noValidate onSubmit={event=>void submit(event)}>
        {mode === 'login' ? <>
          <label className="mf-field">用户名<input autoComplete="username" maxLength={24} value={login.username} onChange={event=>setLogin({...login,username:event.target.value})} /></label>
          <label className="mf-field">密码<input type="password" autoComplete="current-password" maxLength={128} value={login.password} onChange={event=>setLogin({...login,password:event.target.value})} /></label>
        </> : <>
          <label className="mf-field">用户名<input aria-label="用户名" autoComplete="username" maxLength={24} value={registration.username} onChange={event=>registrationField('username',event.target.value)} /><small>2～24 个字符，可使用汉字、字母、数字、下划线或短横线。</small></label>
          <label className="mf-field">设置密码<input aria-label="设置密码" type="password" autoComplete="new-password" maxLength={128} value={registration.password} onChange={event=>registrationField('password',event.target.value)} /><small>{passwordRules(registration.username,registration.password).map(rule=><span key={rule.key} className={rule.satisfied ? 'mf-password-pass' : ''}>{rule.satisfied ? '✓ ' : '· '}{rule.label}　</span>)}</small></label>
          <label className="mf-field">确认密码<input type="password" autoComplete="new-password" maxLength={128} value={registration.confirmPassword} onChange={event=>registrationField('confirmPassword',event.target.value)} /></label>
          <div className="mf-grid mf-grid--2"><label className="mf-field">邮箱（可选）<input type="email" autoComplete="email" value={registration.email} onChange={event=>registrationField('email',event.target.value)} /></label><label className="mf-field">手机号（可选）<input type="tel" autoComplete="tel" value={registration.phone} onChange={event=>registrationField('phone',event.target.value)} /></label></div>
          <small className="mf-muted">至少填写一种联系方式，用于找回账号。</small>
          <div className="mf-row mf-row--between"><span>{challenge?.question ?? '正在获取验证题…'}</span><Button variant="quiet" onClick={()=>void refreshChallenge()}>换一道题</Button></div>
          {challengeError && <p role="alert" className="mf-status mf-status--error">{challengeError}</p>}
          <label className="mf-field">计算结果<input inputMode="numeric" autoComplete="off" maxLength={2} value={challengeAnswer} onChange={event=>setChallengeAnswer(event.target.value)} /></label>
        </>}
        {visibleError && <p role="alert" className="mf-status mf-status--error">{visibleError}</p>}
        <Button type="submit" variant="primary" disabled={identity.authenticationPending || (mode==='register' && !challenge)}>{identity.authenticationPending ? '正在处理…' : mode === 'login' ? '登录' : '创建并激活账号'}</Button>
      </form>
      <p className="mf-auth-switch">{mode==='login' ? '还没有账号？' : '已有账号？'} <Button variant="quiet" onClick={()=>{identity.resetAuthenticationError();setLocalError(null);navigate(mode==='login' ? '/register' : '/login');}}>{mode==='login' ? '创建账号' : '登录'}</Button></p>
    </section></main>
  </div>;
}
