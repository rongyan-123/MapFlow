import type {
  GenerationFundingMode,
  PlatformGenerationEntitlementSummary,
} from './types';
import type { CreditSummary } from '../credit/creditClient';

interface GenerationFundingSelectorProps {
  value: GenerationFundingMode;
  platformEntitlements: PlatformGenerationEntitlementSummary | null;
  credit?: CreditSummary | null;
  onChange: (mode: GenerationFundingMode) => void;
  disabled?: boolean;
}

export default function GenerationFundingSelector({
  value,
  platformEntitlements,
  credit,
  onChange,
  disabled = false,
}: GenerationFundingSelectorProps) {
  const freeAvailable =
    platformEntitlements?.platformModeAvailable === true &&
    platformEntitlements.available > 0;
  const creditEnough =
    credit !== null && credit !== undefined && credit.balance >= credit.pricePerTree;
  return (
    <section aria-label="技能树生成方式" className="grid gap-3 sm:grid-cols-3">
      <FundingCard
        label="选择平台免费体验"
        title={
          freeAvailable
            ? `平台免费体验 · 剩余 ${platformEntitlements?.available ?? 0} 次`
            : '平台免费体验 · 剩余 0 次'
        }
        description={
          freeAvailable
            ? '无需填写 API Key；模型和参数由服务器固定。'
            : '无需填写 API Key；模型和参数由服务器固定。'
        }
        selected={value === 'platform'}
        disabled={disabled || !freeAvailable}
        onClick={() => onChange('platform')}
      />
      <FundingCard
        label="选择使用积分生成"
        title={credit ? `积分生成 · 起价 ${credit.pricePerTree} 积分` : '积分生成'}
        description={
          credit
            ? `当前积分 ${credit.balance}${creditEnough ? '' : '，余额不足'}；可自选模型和追问次数。`
            : '可自选模型和追问次数。'
        }
        selected={value === 'credits'}
        disabled={disabled || !creditEnough}
        onClick={() => onChange('credits')}
      />
      <FundingCard
        label="选择使用自己的 API Key"
        title="使用自己的 API Key"
        description="使用你自己的 DeepSeek 余额"
        selected={value === 'byok'}
        disabled={disabled}
        onClick={() => onChange('byok')}
      />
    </section>
  );
}

function FundingCard({
  label,
  title,
  description,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition ${
        selected
          ? 'border-cyan-300 bg-cyan-400/10 text-cyan-100'
          : 'border-slate-800 bg-slate-950/55 text-slate-300 hover:border-slate-600'
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">
        {description}
      </span>
    </button>
  );
}
