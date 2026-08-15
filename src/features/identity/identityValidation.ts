export interface RegistrationFormValues {
  username: string;
  password: string;
  confirmPassword: string;
  invitationCode: string;
  email: string;
  phone: string;
}

// Mirrors the server-side PasswordPolicy common-password allowlist in src/runtime.rs.
const COMMON_PASSWORDS = [
  '00000000',
  '11111111',
  '123123123',
  '12345678',
  '123456789',
  '1q2w3e4r',
  'abc12345',
  'admin123',
  'iloveyou',
  'password',
  'password123',
  'qwerty123',
];

export function validateRegistration(form: RegistrationFormValues): string | null {
  const usernameLength = Array.from(form.username).length;
  if (
    usernameLength < 2 ||
    usernameLength > 24 ||
    form.username.trim() !== form.username
  ) {
    return '用户名需要 2～24 个字符。';
  }
  const passwordLength = Array.from(form.password).length;
  if (passwordLength < 8) return '密码至少需要 8 位。';
  if (passwordLength > 128) return '密码最多允许 128 位。';
  const weakPasswordKey = form.password.normalize('NFKC').toLowerCase();
  if (COMMON_PASSWORDS.includes(weakPasswordKey)) {
    return '密码过于常见，请更换一个更复杂的密码。';
  }
  const usernameKey = form.username.normalize('NFKC').toLowerCase();
  if (weakPasswordKey.includes(usernameKey)) {
    return '密码不能包含用户名。';
  }
  if (form.password !== form.confirmPassword) return '两次输入的密码不一致。';
  if (!/^[A-Z]{6}$/.test(form.invitationCode)) {
    return '邀请码必须是 6 位大写字母。';
  }

  const email = form.email.trim();
  const phone = form.phone.trim();
  if (!email && !phone) return '请至少填写邮箱或手机号。';
  if (email && !/^[^@\s]+@[^@\s]+$/.test(email)) return '邮箱格式无效。';
  if (phone && !/^\+?\d{8,15}$/.test(phone)) {
    return '手机号需为 8～15 位数字，可带前导 +。';
  }
  return null;
}
