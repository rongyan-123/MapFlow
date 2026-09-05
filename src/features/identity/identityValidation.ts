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

export interface PasswordRule {
  key: string;
  label: string;
  satisfied: boolean;
}

export function passwordRules(username: string, password: string): PasswordRule[] {
  const length = Array.from(password).length;
  const weakPasswordKey = password.normalize('NFKC').toLowerCase();
  const usernameKey = username.normalize('NFKC').toLowerCase();
  return [
    {
      key: 'length',
      label: '8～128 位',
      satisfied: length >= 8 && length <= 128,
    },
    {
      key: 'not-common',
      label: '不使用常见密码',
      satisfied: !!password && !COMMON_PASSWORDS.includes(weakPasswordKey),
    },
    {
      key: 'no-username',
      label: '不包含用户名',
      satisfied: !!password && (!usernameKey || !weakPasswordKey.includes(usernameKey)),
    },
  ];
}

export function validateRegistration(form: RegistrationFormValues): string | null {
  // 与 server 端 Username::parse（src/identity/username.rs）镜像：
  // NFKC 归一化后按字符计数，再逐字符过 allowlist（长度、字符集顺序一致）
  const usernameCharacters = Array.from(form.username.normalize('NFKC'));
  if (
    usernameCharacters.length < 2 ||
    usernameCharacters.length > 24
  ) {
    return '用户名需要 2～24 个字符。';
  }
  if (usernameCharacters.includes('@')) {
    return '用户名不能使用邮箱地址，请填写昵称；邮箱请填入「邮箱」栏。';
  }
  if (usernameCharacters.some((character) => !isAllowedUsernameCharacter(character))) {
    return '用户名只能包含汉字、英文字母、数字、下划线或短横线。';
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

// 镜像 server 端 username.rs 的 allowlist：_ - 数字、拉丁/汉字字母。
// 只放行 server 必然接受的字面字符（ASCII 拉丁 + 常用 CJK），避免前端放行后端再拒的误导窗口。
function isAllowedUsernameCharacter(character: string): boolean {
  if (character === '_' || character === '-') return true;
  if (/[0-9A-Za-z]/.test(character)) return true;
  return /[㐀-鿿豈-﫿\u{20000}-\u{2FA1F}]/u.test(character);
}
