import type { GenerationInput } from './types';

export const GENERATION_TEXT_MAX_CHARS = 10_000;
export const GENERATION_API_KEY_MAX_CHARS = 512;

const GENERATION_FIELD_LABELS: Readonly<Record<keyof GenerationInput, string>> = {
  topic: '想学习什么知识？',
  role: '希望走什么职业或应用方向？',
  goalDescription: '希望最终达到什么目标？',
  learnerContextSummary: '当前基础、限制和学习偏好是什么？',
};

export function validateGenerationInput(input: GenerationInput): string | null {
  for (const field of Object.keys(GENERATION_FIELD_LABELS) as Array<keyof GenerationInput>) {
    const error = validateGenerationText(input[field], GENERATION_FIELD_LABELS[field]);
    if (error) return error;
  }
  return null;
}

export function validateGenerationText(
  value: string,
  label: string,
  maxChars = GENERATION_TEXT_MAX_CHARS,
): string | null {
  if (!value.trim()) return `请填写“${label}”。`;
  if (countUnicodeCharacters(value) > maxChars) {
    return `“${label}”不能超过 ${maxChars} 个字，请缩短后再试。`;
  }
  if (containsControlCharacter(value)) {
    return `“${label}”不能包含换行或不可见控制字符，请删除后再试。`;
  }
  return null;
}

export function validateGenerationApiKey(value: string): string | null {
  if (!value.trim()) return '请输入 DeepSeek API Key。';
  if (countUnicodeCharacters(value) > GENERATION_API_KEY_MAX_CHARS) {
    return `DeepSeek API Key 不能超过 ${GENERATION_API_KEY_MAX_CHARS} 个字符。`;
  }
  if (containsControlCharacter(value)) {
    return 'DeepSeek API Key 不能包含换行或不可见控制字符，请重新粘贴。';
  }
  return null;
}

function countUnicodeCharacters(value: string): number {
  return Array.from(value).length;
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    );
  });
}
