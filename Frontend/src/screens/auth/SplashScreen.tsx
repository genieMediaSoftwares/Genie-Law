import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StatusBar, View } from 'react-native';

import { GenieText, Logo } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { USE_NATIVE_DRIVER } from '../../utils/platform';
import { useT } from '../../i18n/useT';

export const SplashScreen: React.FC = () => {
  const { t } = useT();
  const restore = useAuthStore(state => state.restore);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [logoOpacity, logoScale, textOpacity, taglineOpacity]);

  const hasRestored = useRef(false);

  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    restore();
  }, [restore]);

  return (
    <View className="h-full w-full flex-1 items-center justify-center bg-background">
      <StatusBar barStyle="light-content" />

      <Animated.View
        style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}
      >
        <Logo size={124} withHalo />
      </Animated.View>

      <Animated.View style={{ opacity: textOpacity }} className="mt-8 items-center">
        <GenieText variant="heading-lg" className="tracking-[4px]">
          GENIE LAW
        </GenieText>
        <View className="mt-4 h-0.5 w-14 rounded-sm bg-gold" />
      </Animated.View>

      <Animated.View style={{ opacity: taglineOpacity }} className="mt-4">
        <GenieText variant="body-sm" tone="secondary" className="tracking-widest">
          {t('auth:splash.tagline')}
        </GenieText>
      </Animated.View>
    </View>
  );
};


