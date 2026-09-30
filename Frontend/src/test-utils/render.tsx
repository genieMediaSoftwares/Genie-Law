// Test-only: renders a screen with the providers the app gives it, and a
// navigation prop that records calls.
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });

export const renderWithClient = async (ui: React.ReactElement, client = createTestQueryClient()) => {
  const result = await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { ...result, queryClient: client };
};

export const navigationStub = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(() => true),
  addListener: jest.fn(() => () => undefined),
  isFocused: jest.fn(() => true),
  getParent: jest.fn(() => undefined),
});
