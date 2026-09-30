import i18n from '../i18n';
import { SIGNUP_ROLES } from '../types/auth';
import type { SignupRole } from '../types/auth';

export interface RoleOption {
  value: SignupRole;
  label: string;
  description: string;
}

// Labels are looked up when called, so they follow the current language.
const ROLE_KEYS = {
  client: { label: 'auth:roles.client', description: 'auth:roles.clientDescription' },
  lawyer: { label: 'auth:roles.lawyer', description: 'auth:roles.lawyerDescription' },
} as const;

export const roleOptions = (): RoleOption[] =>
  SIGNUP_ROLES.map(value => ({
    value,
    label: i18n.t(ROLE_KEYS[value].label),
    description: i18n.t(ROLE_KEYS[value].description),
  }));

export const DEFAULT_ROLE: SignupRole = 'client';

export const roleLabel = (value: SignupRole): string =>
  value in ROLE_KEYS ? i18n.t(ROLE_KEYS[value].label) : value;
