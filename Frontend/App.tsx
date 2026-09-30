import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './src/nativewind-interop';

import { queryClient } from './src/api/queryClient';
import { RootNavigator } from './src/navigation/RootNavigator';
import { bindSessionExpiryHandler } from './src/store/authStore';
import { installWebFocusHygiene } from './src/utils/webFocus';
import { startLawyerRatingUpdates } from './src/realtime/lawyerRatings';
import { startRealtimeSession } from './src/realtime/realtimeSession';
import { initI18n } from './src/i18n';
import i18n from './src/i18n';
import { loadLegalCategories } from './src/services/legalCategories';
import { toAppError } from './src/utils/errors';
import { GenieButton, GenieText } from './src/components';
import { ErrorBoundary } from './src/components/ErrorBoundary';

type Startup = { state: 'loading' } | { state: 'ready' } | { state: 'failed'; message: string };

function App(): React.JSX.Element {
  // Before anything is drawn: the saved (or device) language, so a Hindi/Telugu
  // user never sees English first, and the legal categories from the backend,
  // which case forms and category screens read without waiting.
  const [startup, setStartup] = useState<Startup>({ state: 'loading' });

  const start = useCallback(async () => {
    setStartup({ state: 'loading' });
    try {
      await initI18n();
      await loadLegalCategories();
      setStartup({ state: 'ready' });
    } catch (error) {
      setStartup({ state: 'failed', message: toAppError(error).message });
    }
  }, []);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    const unsubscribe = bindSessionExpiryHandler();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const uninstall = installWebFocusHygiene();
    return uninstall;
  }, []);

  // Lawyer ratings update live everywhere they are shown.
  useEffect(() => startLawyerRatingUpdates(queryClient), []);

  // The signed-in user's notifications, cases and chats, pushed live.
  useEffect(() => startRealtimeSession(queryClient), []);

  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-background">
        <StatusBar barStyle="light-content" />
        <QueryClientProvider client={queryClient}>
          {startup.state === 'ready' ? (
            // Last line of defence, for errors outside any screen (navigation
            // chrome, drawer); each screen also has its own boundary.
            <ErrorBoundary name="app">
              <RootNavigator />
            </ErrorBoundary>
          ) : null}
          {startup.state === 'failed' ? (
            <View className="flex-1 items-center justify-center px-8">
              <GenieText variant="body-md" className="mb-6 text-center">
                {startup.message}
              </GenieText>
              <GenieButton label={String(i18n.t('common:actions.tryAgain'))} onPress={start} />
            </View>
          ) : null}
        </QueryClientProvider>
      </View>
    </SafeAreaProvider>
  );
}

export default App;
