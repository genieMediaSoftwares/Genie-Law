import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isNative = !isWeb;
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export const USE_NATIVE_DRIVER = isNative;
