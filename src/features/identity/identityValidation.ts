export interface RegistrationFormValues {
  username: string;
  password: string;
  confirmPassword: string;
  invitationCode: string;
  email: string;
  phone: string;
}

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
