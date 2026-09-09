import { describe, expect, it } from 'vitest';
import {
  CONSOLE_ONBOARDING_VERSION,
  createDefaultOnboardingState,
  getOnboardingStorageKey,
  readOnboardingState,
  writeOnboardingState,
  type ConsoleOnboardingState,
} from './onboardingState';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    dump(key: string) {
      return values.get(key);
    },
  };
}

describe('console onboarding persistence', () => {
  it('starts the website path at the generation action', () => {
    expect(createDefaultOnboardingState().websiteStep).toBe('generate-map');
  });

  it('keeps anonymous and account states in separate versioned keys', () => {
    const storage = createMemoryStorage();
    const anonymous = createDefaultOnboardingState();
    anonymous.path = 'website';
    anonymous.dismissed = true;

    writeOnboardingState(storage, null, anonymous);

    const account = createDefaultOnboardingState();
    account.path = 'agent';
    writeOnboardingState(storage, 'player-7', account);

    expect(readOnboardingState(storage, null)).toEqual(anonymous);
    expect(readOnboardingState(storage, 'player-7')).toEqual(account);
    expect(getOnboardingStorageKey(null)).toContain(
      `v${CONSOLE_ONBOARDING_VERSION}`,
    );
    expect(getOnboardingStorageKey(null)).not.toBe(
      getOnboardingStorageKey('player-7'),
    );
  });

  it('falls back to a clean state for malformed or stale data', () => {
    const key = getOnboardingStorageKey('player-7');
    const storage = createMemoryStorage({
      [key]: JSON.stringify({ version: 0, path: 'agent' }),
    });

    expect(readOnboardingState(storage, 'player-7')).toEqual(
      createDefaultOnboardingState(),
    );
  });

  it('survives storage failures so onboarding remains usable', () => {
    const brokenStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    const state: ConsoleOnboardingState = {
      ...createDefaultOnboardingState(),
      path: 'website',
    };

    expect(readOnboardingState(brokenStorage, 'player-7')).toEqual(
      createDefaultOnboardingState(),
    );
    expect(() => writeOnboardingState(brokenStorage, 'player-7', state)).not.toThrow();
  });
});
