import { describe, expect, it } from 'vitest';
import { passwordRules, validateRegistration } from './identityValidation';

const valid = {
  username: 'firstuser',
  password: 'safe-password-2026',
  confirmPassword: 'safe-password-2026',
  invitationCode: 'QJXKRP',
  email: 'learner@example.com',
  phone: '',
};

describe('validateRegistration', () => {
  it.each([
    [{ ...valid, username: 'a' }, '用户名需要 2～24 个字符。'],
    [{ ...valid, password: '1234567', confirmPassword: '1234567' }, '密码至少需要 8 位。'],
    [{ ...valid, confirmPassword: 'different-password' }, '两次输入的密码不一致。'],
    [{ ...valid, invitationCode: 'ABCDE' }, '邀请码必须是 6 位大写字母。'],
    [{ ...valid, email: '', phone: '' }, '请至少填写邮箱或手机号。'],
    [{ ...valid, email: 'not-an-email' }, '邮箱格式无效。'],
    [{ ...valid, email: '', phone: '+1234' }, '手机号需为 8～15 位数字，可带前导 +。'],
  ])('rejects unsafe or incomplete fields', (form, message) => {
    expect(validateRegistration(form)).toBe(message);
  });

  it.each([
    [
      { ...valid, password: '12345678', confirmPassword: '12345678' },
      '密码过于常见，请更换一个更复杂的密码。',
    ],
    [
      { ...valid, password: 'FIRSTUSER2026', confirmPassword: 'FIRSTUSER2026' },
      '密码不能包含用户名。',
    ],
  ])('rejects passwords the server policy would refuse', (form, message) => {
    expect(validateRegistration(form)).toBe(message);
  });

  it.each([
    [
      { ...valid, username: '2264896153@qq.com' },
      '用户名不能使用邮箱地址，请填写昵称；邮箱请填入「邮箱」栏。',
    ],
    [
      { ...valid, username: 'a@b.com' },
      '用户名不能使用邮箱地址，请填写昵称；邮箱请填入「邮箱」栏。',
    ],
  ])('引导把邮箱误填进用户名框的用户', (form, message) => {
    expect(validateRegistration(form)).toBe(message);
  });

  it.each([
    [
      { ...valid, username: '张 三' },
      '用户名只能包含汉字、英文字母、数字、下划线或短横线。',
    ],
    [
      { ...valid, username: 'user.one' },
      '用户名只能包含汉字、英文字母、数字、下划线或短横线。',
    ],
    [
      { ...valid, username: '用户!名' },
      '用户名只能包含汉字、英文字母、数字、下划线或短横线。',
    ],
    [
      { ...valid, username: '名字emoji🙂' },
      '用户名只能包含汉字、英文字母、数字、下划线或短横线。',
    ],
  ])('rejects characters the server allowlist would refuse', (form, message) => {
    expect(validateRegistration(form)).toBe(message);
  });

  it('accepts usernames the server allowlist accepts', () => {
    expect(validateRegistration({ ...valid, username: '学习者' })).toBeNull();
    expect(validateRegistration({ ...valid, username: 'user_name-1' })).toBeNull();
    expect(validateRegistration({ ...valid, username: 'ｕｓｅｒｎａｍｅ' })).toBeNull();
  });

  it('accepts either a valid email or a digits-only phone locator', () => {
    expect(validateRegistration(valid)).toBeNull();
    expect(
      validateRegistration({ ...valid, email: '', phone: '13800138000' }),
    ).toBeNull();
  });
});

describe('passwordRules', () => {
  const satisfied = (rules: ReturnType<typeof passwordRules>) =>
    rules.filter((rule) => rule.satisfied).map((rule) => rule.key);

  it('lights no rules for an empty password', () => {
    expect(satisfied(passwordRules('firstuser', ''))).toEqual([]);
  });

  it('lights all rules for a long safe password', () => {
    const rules = satisfied(passwordRules('firstuser', 'abcdefgh'));
    expect(rules).toEqual(['length', 'not-common', 'no-username']);
  });

  it('keeps the common-password rule dark for blocklisted passwords', () => {
    const rules = satisfied(passwordRules('firstuser', '12345678'));
    expect(rules).not.toContain('not-common');
  });

  it('keeps the username rule dark when the password contains the username', () => {
    const rules = satisfied(passwordRules('firstuser', 'firstuser2026'));
    expect(rules).not.toContain('no-username');
  });

  it('treats the username rule as satisfied while the username is empty', () => {
    const rules = satisfied(passwordRules('', 'abcdefgh'));
    expect(rules).toContain('no-username');
  });
});
