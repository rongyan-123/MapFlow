export const CONSOLE_ONBOARDING_VERSION = 2;

export type OnboardingPath = 'website' | 'agent';
export type OnboardingAgentClient = 'codex' | 'claude-code' | 'other';
export type WebsiteOnboardingStep =
  | 'generate-map'
  | 'public-library'
  | 'personal-library'
  | 'map-canvas'
  | 'map-node'
  | 'chat'
  | 'progress';
export type AgentOnboardingStep =
  | 'choose-client'
  | 'configure'
  | 'verify'
  | 'install-skill'
  | 'create-map';

export interface ConsoleOnboardingState {
  version: typeof CONSOLE_ONBOARDING_VERSION;
  dismissed: boolean;
  path: OnboardingPath | null;
  websiteStep: WebsiteOnboardingStep;
  agentStep: AgentOnboardingStep;
  agentClient: OnboardingAgentClient | null;
}

export interface OnboardingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createDefaultOnboardingState(): ConsoleOnboardingState {
  return {
    version: CONSOLE_ONBOARDING_VERSION,
    dismissed: false,
    path: null,
    websiteStep: 'generate-map',
    agentStep: 'choose-client',
    agentClient: null,
  };
}

export function getOnboardingStorageKey(accountId: string | null | undefined): string {
  const scope = accountId?.trim() || 'anonymous';
  return `mapflow.console-onboarding.v${CONSOLE_ONBOARDING_VERSION}.${encodeURIComponent(scope)}`;
}

export function readOnboardingState(
  storage: OnboardingStorage | null | undefined,
  accountId: string | null | undefined,
): ConsoleOnboardingState {
  const fallback = createDefaultOnboardingState();
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(getOnboardingStorageKey(accountId));
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isOnboardingState(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeOnboardingState(
  storage: OnboardingStorage | null | undefined,
  accountId: string | null | undefined,
  state: ConsoleOnboardingState,
): void {
  if (!storage) return;

  try {
    storage.setItem(
      getOnboardingStorageKey(accountId),
      JSON.stringify({ ...state, version: CONSOLE_ONBOARDING_VERSION }),
    );
  } catch {
    // Private browsing and locked-down webviews may reject localStorage.
  }
}

function isOnboardingState(value: unknown): value is ConsoleOnboardingState {
  if (!isRecord(value)) return false;
  return (
    value.version === CONSOLE_ONBOARDING_VERSION &&
    typeof value.dismissed === 'boolean' &&
    isNullablePath(value.path) &&
    isWebsiteStep(value.websiteStep) &&
    isAgentStep(value.agentStep) &&
    isNullableAgentClient(value.agentClient)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullablePath(value: unknown): value is OnboardingPath | null {
  return value === null || value === 'website' || value === 'agent';
}

function isWebsiteStep(value: unknown): value is WebsiteOnboardingStep {
  return (
    value === 'generate-map' ||
    value === 'public-library' ||
    value === 'personal-library' ||
    value === 'map-canvas' ||
    value === 'map-node' ||
    value === 'chat' ||
    value === 'progress'
  );
}

function isAgentStep(value: unknown): value is AgentOnboardingStep {
  return (
    value === 'choose-client' ||
    value === 'configure' ||
    value === 'verify' ||
    value === 'install-skill' ||
    value === 'create-map'
  );
}

function isNullableAgentClient(
  value: unknown,
): value is OnboardingAgentClient | null {
  return (
    value === null ||
    value === 'codex' ||
    value === 'claude-code' ||
    value === 'other'
  );
}
