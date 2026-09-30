import { Linking } from 'react-native';

import { env } from '../config/env';

export type SupportChannel = 'phone' | 'email';

export const supportContact = {
  phone: env.supportPhone,
  email: env.supportEmail,
};

export const supportUrl = (channel: SupportChannel): string =>
  channel === 'phone'
    ? `tel:${supportContact.phone.replace(/[^\d+]/g, '')}`
    : `mailto:${supportContact.email}`;

// Resolves false when the device has no dialer or mail app to hand the link to.
export const openSupport = async (channel: SupportChannel): Promise<boolean> => {
  try {
    await Linking.openURL(supportUrl(channel));
    return true;
  } catch {
    return false;
  }
};
