import { describe, expect, it } from 'vitest';
import { validateRegistration } from './identityValidation';

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

  it('accepts either a valid email or a digits-only phone locator', () => {
    expect(validateRegistration(valid)).toBeNull();
    expect(
      validateRegistration({ ...valid, email: '', phone: '13800138000' }),
    ).toBeNull();
  });
});
