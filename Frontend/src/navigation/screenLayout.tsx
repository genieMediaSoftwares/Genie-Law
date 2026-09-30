import React from 'react';

import { ErrorBoundary } from '../components/ErrorBoundary';

interface ScreenLayoutProps {
  children: React.ReactElement;
  route: { name: string };
  navigation: { canGoBack: () => boolean; goBack: () => void };
}

// Every navigator's `screenLayout`: a crash in one screen stays in that screen.
export const screenLayout = ({
  children,
  route,
  navigation,
}: ScreenLayoutProps): React.ReactElement => (
  <ErrorBoundary
    name={route.name}
    onGoBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
  >
    {children}
  </ErrorBoundary>
);
