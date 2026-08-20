import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { LoginInput, RegistrationInput } from './types';
import {
  passwordRules,
  validateRegistration,
  type RegistrationFormValues,
} from './identityValidation';
import { IdentityApiError, type ClaimedInvitation } from './identityClient';
import TurnstileVerifier from './TurnstileVerifier';

interface IdentityDialogProps {
  pending: boolean;
  requestError: unknown;
  onClose: () => void;
  onResetError: () => void;
  onLogin: (input: LoginInput) => Promise<unknown>;
  onRegister: (input: RegistrationInput) => Promise<unknown>;
  onClaimInvitation: (turnstileToken?: string) => Promise<ClaimedInvitation>;
}

function readTurnstileSiteKey(): string {
  return import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
}

type ClaimStatus = 'idle' | 'verifying' | 'claiming' | 'claimed';

const EMPTY_REGISTRATION: RegistrationFormValues = {
  username: '',
  password: '',
  confirmPassword: '',
  invitationCode: '',
  email: '',
  phone: '',
};

export default function IdentityDialog({
  pending,
  requestError,
  onClose,
  onResetError,
  onLogin,
  onRegister,
  onClaimInvitation,
}: IdentityDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [registration, setRegistration] =
    useState<RegistrationFormValues>(EMPTY_REGISTRATION);
  const [login, setLogin] = useState<LoginInput>({ username: '', password: '' });
  const [localError, setLocalError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('idle');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedCode, setClaimedCode] = useState<string | null>(null);

  const requestClaim = useCallback(
    async (turnstileToken?: string) => {
      setClaimError(null);
      setClaimStatus('claiming');
      try {
        const claimed = await onClaimInvitation(turnstileToken);
        setRegistration((current) => ({
          ...current,
          invitationCode: claimed.invitationCode,
        }));
        setClaimedCode(claimed.invitationCode);
        setClaimStatus('claimed');
      } catch (caught) {
        setClaimStatus('idle');
        setClaimError(
          caught instanceof IdentityApiError
            ? caught.message
            : '邀请码领取失败，请稍后再试。',
        );
      }
    },
    [onClaimInvitation],
  );

  const startClaim = useCallback(() => {
    setClaimError(null);
    if (readTurnstileSiteKey()) {
      setClaimStatus('verifying');
    } else {
      void requestClaim();
    }
  }, [requestClaim]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, pending]);

  const changeMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setLocalError(null);
    setClaimStatus('idle');
    setClaimError(null);
    setClaimedCode(null);
    onResetError();
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!login.username || !login.password) {
      setLocalError('请输入用户名和密码。');
      return;
    }
    setLocalError(null);
    try {
      await onLogin(login);
    } catch {
      // React Query owns the safe request error displayed below.
    }
  };

  const submitRegistration = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateRegistration(registration);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(null);
    const email = registration.email.trim();
    const phone = registration.phone.trim();
    try {
      await onRegister({
        username: registration.username,
        password: registration.password,
        invitationCode: registration.invitationCode,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      });
    } catch {
      // React Query owns the safe request error displayed below.
    }
  };

  const visibleError = localError ?? readableError(requestError);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-dialog-title"
        className="w-full max-w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-950/40"
      >
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
              MapFlow ID
            </p>
            <h2 id="identity-dialog-title" className="mt-1 text-lg font-semibold text-white">
              {mode === 'login' ? '登录学习账号' : '用邀请码激活账号'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="关闭账号窗口"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-slate-800 p-1.5">
          <ModeButton active={mode === 'login'} onClick={() => changeMode('login')}>
            登录
          </ModeButton>
          <ModeButton active={mode === 'register'} onClick={() => changeMode('register')}>
            注册激活
          </ModeButton>
        </div>

        {mode === 'login' ? (
          <form className="space-y-4 p-5" onSubmit={(event) => void submitLogin(event)}>
            <Field label="用户名">
              <input
                autoFocus
                autoComplete="username"
                maxLength={24}
                value={login.username}
                onChange={(event) => setLogin({ ...login, username: event.target.value })}
                className={inputClassName}
              />
            </Field>
            <Field label="密码">
              <input
                type="password"
                autoComplete="current-password"
                maxLength={128}
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
                className={inputClassName}
              />
            </Field>
            <StatusMessage message={visibleError} />
            <SubmitButton pending={pending}>登录</SubmitButton>
            <p className="text-center text-xs leading-5 text-slate-500">
              邀请码只在创建账号时使用，以后只需用户名和密码。
            </p>
          </form>
        ) : (
          <form className="space-y-3.5 p-5" onSubmit={(event) => void submitRegistration(event)}>
            <Field label="用户名">
              <input
                autoFocus
                autoComplete="username"
                minLength={2}
                maxLength={24}
                value={registration.username}
                onChange={(event) =>
                  setRegistration({ ...registration, username: event.target.value })
                }
                className={inputClassName}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="设置密码">
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={registration.password}
                  onChange={(event) =>
                    setRegistration({ ...registration, password: event.target.value })
                  }
                  className={inputClassName}
                />
              </Field>
              <PasswordRuleList
                username={registration.username}
                password={registration.password}
              />
              <Field label="确认密码">
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={registration.confirmPassword}
                  onChange={(event) =>
                    setRegistration({ ...registration, confirmPassword: event.target.value })
                  }
                  className={inputClassName}
                />
              </Field>
            </div>
            <Field label="邀请码">
              <input
                autoComplete="one-time-code"
                inputMode="text"
                minLength={6}
                pattern="[A-Z]{6}"
                value={registration.invitationCode}
                onChange={(event) =>
                  setRegistration({
                    ...registration,
                    invitationCode: event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z]/g, '')
                      .slice(0, 6),
                  })
                }
                className={`${inputClassName} font-mono uppercase tracking-[0.3em]`}
              />
            </Field>
            {claimStatus === 'claimed' && claimedCode ? (
              <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2.5 text-xs leading-5 text-emerald-300">
                已领取邀请码{' '}
                <span className="font-mono font-semibold tracking-[0.2em]">{claimedCode}</span>
                ，已填入上方输入框，请完成注册。
              </div>
            ) : (
              <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 px-3 py-2.5">
                <p className="text-xs leading-5 text-slate-400">
                  还没有邀请码？每 24 小时每个网络可领取一个。
                </p>
                {claimStatus === 'verifying' && readTurnstileSiteKey() ? (
                  <div className="mt-2">
                    <TurnstileVerifier
                      siteKey={readTurnstileSiteKey()}
                      onVerified={(token) => void requestClaim(token)}
                      onError={() => {
                        setClaimStatus('idle');
                        setClaimError('人机验证加载失败，请重试。');
                      }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={pending || claimStatus === 'claiming'}
                    onClick={startClaim}
                    className="mt-2 rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-400/10 disabled:cursor-wait disabled:opacity-50"
                  >
                    {claimStatus === 'claiming' ? '正在领取…' : '点击领取邀请码'}
                  </button>
                )}
                {claimError && (
                  <p role="alert" className="mt-2 text-xs text-rose-300">
                    {claimError}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="邮箱（可选）">
                <input
                  type="email"
                  autoComplete="email"
                  value={registration.email}
                  onChange={(event) =>
                    setRegistration({ ...registration, email: event.target.value })
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="手机号（可选）">
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={registration.phone}
                  onChange={(event) =>
                    setRegistration({ ...registration, phone: event.target.value })
                  }
                  className={inputClassName}
                />
              </Field>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              至少填写一种联系方式。首版不发送验证码，仅用于人工定位账号。
            </p>
            <StatusMessage message={visibleError} />
            <SubmitButton pending={pending}>创建并激活账号</SubmitButton>
          </form>
        )}
      </section>
    </div>
  );
}

const inputClassName =
  'mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10';

function Field({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <label className="block text-xs font-medium text-slate-300">
      {label}
      {children}
    </label>
  );
}

function PasswordRuleList({
  username,
  password,
}: {
  username: string;
  password: string;
}) {
  const rules = passwordRules(username, password);
  return (
    <ul className="mt-1.5 space-y-0.5">
      {rules.map((rule) => (
        <li
          key={rule.key}
          className={`text-[11px] leading-4 ${
            rule.satisfied ? 'text-emerald-400' : 'text-slate-600'
          }`}
        >
          {rule.satisfied ? '✓' : '·'} {rule.label}
        </li>
      ))}
    </ul>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function StatusMessage({ message }: { message: string | null }) {
  return (
    <div role={message ? 'alert' : undefined} className="min-h-5 text-xs text-rose-300">
      {message}
    </div>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? '正在验证…' : children}
    </button>
  );
}

function readableError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
