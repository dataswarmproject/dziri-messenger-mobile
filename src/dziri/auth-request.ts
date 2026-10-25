export type AuthFlow = 'signIn' | 'signUp' | 'reset' | 'reset-verification';
export interface AuthFields {
  email: string;
  password: string;
  name: string;
  code: string;
  confirmation: string;
  agreed: boolean;
}

export type AuthValidation = 'email' | 'name' | 'consent' | 'length' | 'mismatch' | 'code';
export class AuthInputError extends Error {
  readonly reason: AuthValidation;
  constructor(reason: AuthValidation) {
    super(reason);
    this.reason = reason;
  }
}

/** Mirrors Consumer's Password provider; identity and password policy remain server enforced. */
export function authRequest(flow: AuthFlow, fields: AuthFields): Record<string, string> {
  const email = fields.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AuthInputError('email');
  if (flow === 'signIn') return { flow, email, password: fields.password };
  if (flow === 'reset') return { flow, email, recoveryChannel: 'sms' };
  const password = fields.password;
  if (
    [...password].length < 12 ||
    [...password].length > 128 ||
    /[\u0000-\u001f\u007f]/.test(password)
  )
    throw new AuthInputError('length');
  if (password !== fields.confirmation) throw new AuthInputError('mismatch');
  if (flow === 'signUp') {
    if (!fields.name.trim()) throw new AuthInputError('name');
    if (!fields.agreed) throw new AuthInputError('consent');
    return { flow, email, password, name: fields.name.trim() };
  }
  if (!/^\d{6}$/.test(fields.code.trim())) throw new AuthInputError('code');
  return { flow, email, code: fields.code.trim(), newPassword: password, recoveryChannel: 'sms' };
}

export function authErrorReason(
  error: unknown,
): AuthValidation | 'breached' | 'unavailable' | 'limit' | 'generic' {
  if (error instanceof AuthInputError) return error.reason;
  const message = error instanceof Error ? error.message : '';
  if (message.includes('PASSWORD_BREACHED')) return 'breached';
  if (message.includes('PASSWORD_CHECK_UNAVAILABLE')) return 'unavailable';
  if (message.includes('PASSWORD_LENGTH')) return 'length';
  if (/too many|rate.?limit/i.test(message)) return 'limit';
  if (message.includes('Invalid or expired password reset code')) return 'code';
  return 'generic';
}
