import { describe, expect, it } from 'vitest';
import {
  GENERATION_TEXT_MAX_CHARS,
  validateGenerationApiKey,
  validateGenerationInput,
  validateGenerationText,
} from './generationValidation';

describe('generationValidation', () => {
  it('accepts exactly ten thousand characters in every user-authored generation field', () => {
    const boundary = '学'.repeat(GENERATION_TEXT_MAX_CHARS);

    expect(
      validateGenerationInput({
        topic: boundary,
        role: boundary,
        goalDescription: boundary,
        learnerContextSummary: boundary,
      }),
    ).toBeNull();
    expect(validateGenerationText(boundary, '补充信息')).toBeNull();
  });

  it('names the field and limit when a generation field exceeds the boundary', () => {
    expect(
      validateGenerationInput({
        topic: '学'.repeat(GENERATION_TEXT_MAX_CHARS + 1),
        role: '开发者',
        goalDescription: '交付服务',
        learnerContextSummary: '零基础',
      }),
    ).toBe('“想学习什么知识？”不能超过 10000 个字，请缩短后再试。');
  });

  it('distinguishes blank, control-character, and API-key failures', () => {
    expect(validateGenerationInput({
      topic: ' ',
      role: '开发者',
      goalDescription: '交付服务',
      learnerContextSummary: '零基础',
    })).toBe('请填写“想学习什么知识？”。');
    expect(validateGenerationText('包含\n换行', '补充信息')).toBe(
      '“补充信息”不能包含换行或不可见控制字符，请删除后再试。',
    );
    expect(validateGenerationApiKey('   ')).toBe('请输入 DeepSeek API Key。');
    expect(validateGenerationApiKey('key\nwith-control')).toBe(
      'DeepSeek API Key 不能包含换行或不可见控制字符，请重新粘贴。',
    );
    expect(validateGenerationApiKey('k'.repeat(513))).toBe(
      'DeepSeek API Key 不能超过 512 个字符。',
    );
  });
});
