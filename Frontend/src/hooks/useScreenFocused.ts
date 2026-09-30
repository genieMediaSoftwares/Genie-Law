import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { NavigationContext } from '@react-navigation/native';

import { useRealtimeLive } from '../realtime/realtimeSession';
import type { RealtimeNamespace } from '../realtime/realtimeSession';

// Tracks whether the screen rendering this hook is the focused one. Unlike
// `useIsFocused`, it never throws outside a navigator (it reports focused), so
// screens rendered on their own — e.g. in tests — keep working.
export function useScreenFocus(): {
  focused: boolean;
  focusedRef: React.MutableRefObject<boolean>;
} {
  const navigation = useContext(NavigationContext);
  const focusedRef = useRef(navigation?.isFocused() ?? true);
  const [focused, setFocused] = useState(focusedRef.current);

  useEffect(() => {
    if (!navigation) {
      return undefined;
    }
    const update = (next: boolean) => {
      // The ref updates synchronously from the navigation event, so it is
      // correct even while the screen is frozen (freezeOnBlur) and cannot
      // re-render.
      focusedRef.current = next;
      setFocused(next);
    };
    update(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => update(true));
    const offBlur = navigation.addListener('blur', () => update(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  return { focused, focusedRef };
}

export function useScreenFocused(): boolean {
  return useScreenFocus().focused;
}

// `refetchInterval` factory that polls only while the screen is visible:
//   const pollWhileFocused = usePollWhileFocused();
//   useQuery({ ..., refetchInterval: pollWhileFocused(3000) });
//
// Tabs and stacked screens stay mounted after you leave them, and React Query
// keeps an observer's interval running regardless, so without this every
// screen you've visited kept hitting the API every few seconds in the
// background. React Query re-evaluates this function after every fetch, so
// polling stops right after the screen loses focus (even while frozen), and
// the re-render on refocus starts it again.
export function usePollWhileFocused(): (ms: number) => () => number | false {
  const { focusedRef } = useScreenFocus();
  return useCallback(
    (ms: number) => () => (focusedRef.current ? ms : false),
    [focusedRef],
  );
}

// For data the backend pushes over Socket.IO (src/realtime/realtimeSession):
// no polling while that namespace is connected, and the screen's usual
// focused-only interval while it is not, so a dropped socket never leaves the
// screen stale.
//   const fallbackPoll = useFallbackPoll('notifications');
//   useQuery({ ..., refetchInterval: fallbackPoll(3000) });
export function useFallbackPoll(
  namespace: RealtimeNamespace,
): (ms: number) => false | (() => number | false) {
  const pollWhileFocused = usePollWhileFocused();
  const live = useRealtimeLive(namespace);
  return useCallback(
    (ms: number) => (live ? false : pollWhileFocused(ms)),
    [live, pollWhileFocused],
  );
}
