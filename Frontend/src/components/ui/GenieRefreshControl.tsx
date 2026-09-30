import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import { colors } from '../../theme';
import { logError } from '../../utils/log';

export interface GenieRefreshControlProps
  extends Omit<RefreshControlProps, 'refreshing' | 'onRefresh'> {
  // Return the refetch promise(s) so the spinner stays until they settle.
  onRefresh: () => unknown;
}

// Pull-to-refresh that spins ONLY while a refresh the user pulled for is in
// flight. Never bind a RefreshControl to a query's `isRefetching`/`isFetching`:
// those are also true for automatic background refetches (stale data on
// screen mount, cache invalidations after a mutation elsewhere, polling), which
// made the native spinner flash on ordinary navigation. Background refreshes
// stay silent; real loading/error states still come from each query.
export const GenieRefreshControl: React.FC<GenieRefreshControlProps> = ({
  onRefresh,
  ...rest
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshRef.current();
    } catch (error) {
      // React Query's refetch() resolves with the error in query state rather
      // than throwing, so screens still show their real error UI. Anything
      // else is logged, not swallowed.
      logError('pull-to-refresh', error);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  return (
    <RefreshControl
      tintColor={colors.gold}
      colors={[colors.gold]}
      {...rest}
      refreshing={refreshing}
      onRefresh={handleRefresh}
    />
  );
};
