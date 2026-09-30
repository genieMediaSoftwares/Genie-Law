import i18n from '../i18n';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MOBILE_PATTERN = /^[6-9]\d{9}$/;

const PASSWORD_MIN_LENGTH = 6;

const NAME_MIN_LENGTH = 3;

export const validateFullName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return i18n.t('auth:validation.fullNameRequired');
  }
  if (trimmed.length < NAME_MIN_LENGTH) {
    return i18n.t('auth:validation.fullNameMin', { count: NAME_MIN_LENGTH });
  }
  return undefined;
};

export const validateEmail = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return i18n.t('auth:validation.emailRequired');
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return i18n.t('auth:validation.emailInvalid');
  }
  return undefined;
};

export const validateMobile = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return i18n.t('auth:validation.mobileRequired');
  }
  if (!MOBILE_PATTERN.test(trimmed)) {
    return i18n.t('auth:validation.mobileInvalid');
  }
  return undefined;
};

export const validatePassword = (value: string): string | undefined => {
  if (!value) {
    return i18n.t('auth:validation.passwordRequired');
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return i18n.t('auth:validation.passwordMin', { count: PASSWORD_MIN_LENGTH });
  }
  return undefined;
};

export const validateLoginPassword = (value: string): string | undefined =>
  value ? undefined : i18n.t('auth:validation.passwordRequired');

export const validateConfirmPassword = (
  password: string,
  confirmPassword: string,
): string | undefined => {
  if (!confirmPassword) {
    return i18n.t('auth:validation.confirmRequired');
  }
  if (password !== confirmPassword) {
    return i18n.t('auth:validation.passwordMismatch');
  }
  return undefined;
};

export const validateResetCode = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return i18n.t('auth:validation.resetCodeRequired');
  }
  if (!/^\d{6}$/.test(trimmed)) {
    return i18n.t('auth:validation.resetCodeInvalid');
  }
  return undefined;
};

export const collectErrors = <K extends string>(
  candidates: Partial<Record<K, string | undefined>>,
): Partial<Record<K, string>> => {
  const errors: Partial<Record<K, string>> = {};
  (Object.keys(candidates) as K[]).forEach(key => {
    const message = candidates[key];
    if (message) {
      errors[key] = message;
    }
  });
  return errors;
};
