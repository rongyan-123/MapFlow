import { describe, expect, it } from 'vitest';
import {
  passwordRules,
  validateConfirmPasswordField,
  validateEmailField,
  validateInvitationCodeField,
  validatePasswordField,
  validatePhoneField,
  validateRegistration,
  validateUsernameField,
} from './identityValidation';

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

describe('validateUsernameField', () => {
  it.each([
    ['', '请输入用户名。'],
    ['a', '用户名需要 2～24 个字符。'],
    ['2264896153@qq.com', '用户名不能使用邮箱地址，请填写昵称；邮箱请填入「邮箱」栏。'],
    ['张 三', '用户名只能包含汉字、英文字母、数字、下划线或短横线。'],
  ])('rejects unsafe usernames on blur', (username, message) => {
    expect(validateUsernameField(username)).toBe(message);
  });

  it('accepts usernames the server allowlist accepts', () => {
    expect(validateUsernameField('学习者')).toBeNull();
    expect(validateUsernameField('user_name-1')).toBeNull();
  });
});

describe('validatePasswordField', () => {
  it.each([
    ['', 'firstuser', '请输入密码。'],
    ['1234567', 'firstuser', '密码至少需要 8 位。'],
    ['12345678', 'firstuser', '密码过于常见，请更换一个更复杂的密码。'],
    ['FIRSTUSER2026', 'firstuser', '密码不能包含用户名。'],
  ])('rejects unsafe passwords on blur', (password, username, message) => {
    expect(validatePasswordField(password, username)).toBe(message);
  });

  it('accepts a long safe password', () => {
    expect(validatePasswordField('safe-password-2026', 'firstuser')).toBeNull();
  });
});

describe('validateConfirmPasswordField', () => {
  it.each([
    ['safe-password-2026', '', '请再次输入密码。'],
    ['safe-password-2026', 'different-password', '两次输入的密码不一致。'],
  ])('rejects a missing or mismatched confirmation on blur', (password, confirm, message) => {
    expect(validateConfirmPasswordField(password, confirm)).toBe(message);
  });

  it('accepts a matching confirmation', () => {
    expect(validateConfirmPasswordField('safe-password-2026', 'safe-password-2026')).toBeNull();
  });
});

describe('validateInvitationCodeField', () => {
  it.each([
    ['', '请输入邀请码。'],
    ['ABCDE', '邀请码必须是 6 位大写字母。'],
    ['abc123', '邀请码必须是 6 位大写字母。'],
  ])('rejects a missing or malformed invitation on blur', (invitationCode, message) => {
    expect(validateInvitationCodeField(invitationCode)).toBe(message);
  });

  it('accepts a 6-letter uppercase invitation', () => {
    expect(validateInvitationCodeField('QJXKRP')).toBeNull();
  });
});

describe('validateEmailField and validatePhoneField', () => {
  it('treats an empty contact as unfilled, not invalid', () => {
    expect(validateEmailField('')).toBeNull();
    expect(validatePhoneField('')).toBeNull();
  });

  it.each([
    ['not-an-email', '邮箱格式无效。'],
    ['a b@example.com', '邮箱格式无效。'],
  ])('rejects malformed emails once filled', (email, message) => {
    expect(validateEmailField(email)).toBe(message);
  });

  it.each([
    ['+1234', '手机号需为 8～15 位数字，可带前导 +。'],
    ['13800138000123456', '手机号需为 8～15 位数字，可带前导 +。'],
  ])('rejects malformed phones once filled', (phone, message) => {
    expect(validatePhoneField(phone)).toBe(message);
  });

  it('accepts valid contacts', () => {
    expect(validateEmailField(' learner@example.com ')).toBeNull();
    expect(validatePhoneField('13800138000')).toBeNull();
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
