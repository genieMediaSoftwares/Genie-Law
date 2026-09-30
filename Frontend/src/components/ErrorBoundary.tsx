import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GenieButton } from './ui/GenieButton';
import { GenieErrorState } from './ui/GenieErrorState';
import i18n from '../i18n';
import { describeError } from '../utils/log';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  // Names the failing area in the log (the screen's route name).
  name: string;
  // Offered next to "Try again" when there is somewhere to go back to.
  onGoBack?: () => void;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// A render error inside one screen replaces that screen with a recovery view
// instead of unmounting the whole app. The error is logged (never shown: its
// text is for developers), and "Try again" renders the screen afresh.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const where = info.componentStack?.trim().split('\n')[0]?.trim() ?? '';
    console.error(`[crash] ${this.props.name}: ${describeError(error)} ${where}`);
  }

  private retry = () => this.setState({ failed: false });

  render(): React.ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    const { onGoBack } = this.props;
    return (
      <SafeAreaView className="flex-1 justify-center bg-background px-6">
        <GenieErrorState
          message={i18n.t('common:errors.generic')}
          onRetry={this.retry}
        />
        {onGoBack ? (
          <View className="mt-3 items-center">
            <GenieButton
              label={i18n.t('common:actions.goBack')}
              onPress={onGoBack}
              variant="ghost"
              fullWidth={false}
            />
          </View>
        ) : null}
      </SafeAreaView>
    );
  }
}
