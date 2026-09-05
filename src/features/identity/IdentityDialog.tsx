import {
  Children,
  cloneElement,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import type { LoginInput, RegistrationInput } from './types';
import {
  passwordRules,
  validateConfirmPasswordField,
  validateEmailField,
  validateInvitationCodeField,
  validatePasswordField,
  validatePhoneField,
  validateRegistration,
  validateUsernameField,
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

type RegistrationField =
  | 'username'
  | 'password'
  | 'confirmPassword'
  | 'invitationCode'
  | 'email'
  | 'phone';

const EMPTY_TOUCHED: Record<RegistrationField, boolean> = {
  username: false,
  password: false,
  confirmPassword: false,
  invitationCode: false,
  email: false,
  phone: false,
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
  const [touched, setTouched] = useState<Record<RegistrationField, boolean>>(EMPTY_TOUCHED);
  const touch = useCallback((field: RegistrationField) => {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  }, []);
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
    setTouched(EMPTY_TOUCHED);
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

  const usernameError = touched.username ? validateUsernameField(registration.username) : null;
  const passwordError = touched.password
    ? validatePasswordField(registration.password, registration.username)
    : null;
  const confirmPasswordError = touched.confirmPassword
    ? validateConfirmPasswordField(registration.password, registration.confirmPassword)
    : null;
  const invitationCodeError = touched.invitationCode
    ? validateInvitationCodeField(registration.invitationCode)
    : null;
  const emailError = touched.email ? validateEmailField(registration.email) : null;
  const phoneError = touched.phone ? validatePhoneField(registration.phone) : null;

  const submitRegistration = async (event: FormEvent) => {
    event.preventDefault();
    // 提交时点亮所有字段：逐个字段的错误显示在对应输入框下，
    // 「至少一种联系方式」这类跨字段错误才显示在底部。
    setTouched({
      username: true,
      password: true,
      confirmPassword: true,
      invitationCode: true,
      email: true,
      phone: true,
    });
    const validationError = validateRegistration(registration);
    if (validationError === '请至少填写邮箱或手机号。') {
      setLocalError(validationError);
      return;
    }
    if (validationError) return;
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
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-950/40"
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
            <Field label="用户名" id="login-username">
              <input
                autoFocus
                autoComplete="username"
                maxLength={24}
                value={login.username}
                onChange={(event) => setLogin({ ...login, username: event.target.value })}
              />
            </Field>
            <Field label="密码" id="login-password">
              <input
                type="password"
                autoComplete="current-password"
                maxLength={128}
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
              />
            </Field>
            <StatusMessage message={visibleError} />
            <SubmitButton pending={pending}>登录</SubmitButton>
            <p className="text-center text-xs leading-5 text-slate-500">
              邀请码只在创建账号时使用，以后只需用户名和密码。
            </p>
          </form>
        ) : (
          <form
            noValidate
            className="space-y-3.5 p-5"
            onSubmit={(event) => void submitRegistration(event)}
          >
            <Field label="用户名" id="register-username" error={usernameError}>
              <input
                autoFocus
                autoComplete="username"
                minLength={2}
                maxLength={24}
                value={registration.username}
                onChange={(event) =>
                  setRegistration({ ...registration, username: event.target.value })
                }
                onBlur={() => touch('username')}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="设置密码" id="register-password" error={passwordError}>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={registration.password}
                  onChange={(event) =>
                    setRegistration({ ...registration, password: event.target.value })
                  }
                  onBlur={() => touch('password')}
                />
              </Field>
              <PasswordRuleList
                username={registration.username}
                password={registration.password}
              />
              <Field
                label="确认密码"
                id="register-confirm-password"
                error={confirmPasswordError}
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={registration.confirmPassword}
                  onChange={(event) =>
                    setRegistration({ ...registration, confirmPassword: event.target.value })
                  }
                  onBlur={() => touch('confirmPassword')}
                />
              </Field>
            </div>
            <Field label="邀请码" id="register-invitation-code" error={invitationCodeError}>
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
                onBlur={() => touch('invitationCode')}
                className="font-mono uppercase tracking-[0.3em]"
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
              <Field label="邮箱（可选）" id="register-email" error={emailError}>
                <input
                  type="email"
                  autoComplete="email"
                  value={registration.email}
                  onChange={(event) =>
                    setRegistration({ ...registration, email: event.target.value })
                  }
                  onBlur={() => touch('email')}
                />
              </Field>
              <Field label="手机号（可选）" id="register-phone" error={phoneError}>
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={registration.phone}
                  onChange={(event) =>
                    setRegistration({ ...registration, phone: event.target.value })
                  }
                  onBlur={() => touch('phone')}
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

const errorInputClassName =
  'mt-1.5 w-full rounded-lg border border-rose-500/70 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20';

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string | null;
  children: ReactElement;
}) {
  const hasError = Boolean(error);
  const baseClassName = hasError ? errorInputClassName : inputClassName;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-300">
        {label}
      </label>
      {Children.only(
        cloneElement(children, {
          id,
          'aria-invalid': hasError || undefined,
          'aria-describedby': hasError ? `${id}-error` : undefined,
          className: `${baseClassName} ${children.props.className ?? ''}`.trim(),
        }),
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs leading-5 text-rose-300"
        >
          {error}
        </p>
      )}
    </div>
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
