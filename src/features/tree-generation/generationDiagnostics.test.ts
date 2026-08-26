import { describe, expect, it } from 'vitest';
import { TreeGenerationApiError } from './treeGenerationClient';
import {
  createGenerationDiagnostic,
  readableGenerationError,
  serializeGenerationDiagnostic,
} from './generationDiagnostics';

describe('generationDiagnostics', () => {
  it('serializes only the closed diagnostic whitelist', () => {
    const error = new TreeGenerationApiError(
      502,
      'generation.planning_follow_up_not_allowed',
      'MODEL-FREEDOM-SENTINEL',
      '81000000-0000-4000-8000-000000000001',
    );
    const diagnostic = createGenerationDiagnostic({
      operation: 'adjust',
      error,
      sessionId: '71000000-0000-4000-8000-000000000001',
      planVersion: 2,
      occurredAt: '2026-08-13T00:00:00.000Z',
    });
    const serialized = serializeGenerationDiagnostic(diagnostic);

    expect(Object.keys(JSON.parse(serialized))).toEqual([
      'diagnosticVersion',
      'product',
      'occurredAt',
      'operation',
      'httpStatus',
      'errorCode',
      'traceId',
      'sessionId',
      'planVersion',
    ]);
    expect(serialized).not.toContain('MODEL-FREEDOM-SENTINEL');
    expect(serialized).not.toContain('message');
    expect(serialized).not.toContain('prompt');
    expect(serialized).not.toContain('response');
    expect(serialized).not.toContain('apiKey');
  });

  it('does not create a support diagnostic for local validation errors', () => {
    expect(
      createGenerationDiagnostic({
        operation: 'adjust',
        error: new Error('USER-FEEDBACK-SENTINEL'),
        sessionId: '71000000-0000-4000-8000-000000000001',
        planVersion: 2,
        occurredAt: '2026-08-13T00:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('maps API errors to closed local copy instead of rendering server free text', () => {
    const error = new TreeGenerationApiError(
      502,
      'generation.planning_follow_up_not_allowed',
      'SYSTEM-PROMPT-SENTINEL',
    );

    expect(readableGenerationError(error)).toBe(
      'DeepSeek 未按当前规划阶段返回结果，本次修改未保存，请重试。',
    );
    expect(readableGenerationError(error)).not.toContain('SENTINEL');
  });

  it('turns safe server validation details into a field-specific correction', () => {
    const error = new TreeGenerationApiError(
      400,
      'generation.input_invalid',
      'server detail must not render',
      '84000000-0000-4000-8000-000000000001',
      { field: 'goalDescription', reason: 'too_long', maxChars: 10_000 },
    );

    expect(readableGenerationError(error)).toBe(
      '“希望最终达到什么目标？”不能超过 10000 个字，请缩短后再试。',
    );
    expect(readableGenerationError(error)).not.toContain('server detail');
  });

  it('rejects free text smuggled through diagnostic scalar fields', () => {
    const error = new TreeGenerationApiError(
      999,
      'SYSTEM-PROMPT-SENTINEL',
      'MODEL-FREEDOM-SENTINEL',
      'TRACE-SENTINEL',
    );
    const diagnostic = createGenerationDiagnostic({
      operation: 'adjust',
      error,
      sessionId: 'SESSION-SENTINEL',
      planVersion: -1,
      occurredAt: 'TIME-SENTINEL',
    });
    const serialized = serializeGenerationDiagnostic(diagnostic);

    expect(JSON.parse(serialized)).toMatchObject({
      httpStatus: 0,
      errorCode: 'generation.unclassified_error',
      traceId: null,
      sessionId: null,
      planVersion: null,
    });
    expect(serialized).not.toContain('SENTINEL');
    expect(Number.isNaN(Date.parse(JSON.parse(serialized).occurredAt))).toBe(false);
  });

  it('refuses forged diagnostics that bypass the typed constructor', () => {
    const forged = {
      diagnosticVersion: 1,
      product: 'MapFlow',
      occurredAt: '2026-08-13T00:00:00.000Z',
      operation: 'SYSTEM-PROMPT-SENTINEL',
      httpStatus: 502,
      errorCode: 'generation.invalid_model_output',
      traceId: null,
      sessionId: null,
      planVersion: null,
    };

    expect(serializeGenerationDiagnostic(forged as never)).toBe('');
  });
});
