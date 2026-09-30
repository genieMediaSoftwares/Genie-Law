import { AppState, Platform } from 'react-native';
import { io } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';

import { env } from '../config/env';

// Real-time lawyer ratings.
//
// The backend recalculates a lawyer's rating whenever a review is added,
// hidden or removed, and broadcasts `lawyer_rating_updated` on the root
// Socket.IO namespace to every connected client. This app never computes or
// edits a rating itself: on that event it refetches the screens that show the
// lawyer's rating, so what it shows is always the backend's value. After a
// dropped connection comes back, it refetches the same way, so any update
// missed while offline is picked up.

export interface LawyerRatingUpdate {
  lawyerId: string;
  rating: number;
  totalReviews: number;
  updatedAt: string;
}

const refetchLawyer = (queryClient: QueryClient, lawyerId: string | null) => {
  const keys: unknown[][] = [
    ['advocates'],
    ['lawyers', 'recommend'],
    ['favorites'],
    ['cases'],
    ['reviews', 'mine'],
  ];
  if (lawyerId) {
    keys.push(['advocate', lawyerId], ['reviews', lawyerId], ['lawyer', 'profile', lawyerId]);
  } else {
    keys.push(['advocate'], ['reviews'], ['lawyer', 'profile']);
  }
  keys.forEach(queryKey => {
    queryClient.invalidateQueries({ queryKey });
  });
};

// One connection for the app's lifetime; returns a function that disconnects.
// On a phone the socket is closed while the app is in the background (the OS
// would cut it anyway) and reopened when it returns, which refetches once.
export function startLawyerRatingUpdates(queryClient: QueryClient): () => void {
  const socket = io(env.apiOrigin, {
    transports: ['websocket'],
    reconnection: true,
  });

  let connectedBefore = false;

  socket.on('connect_error', (err) => {
    // The server being unreachable is not an app error: socket.io retries.
    if (__DEV__) {
      console.warn('[lawyerRatings] Socket connection error:', err.message);
    }
  });

  socket.on('connect', () => {
    if (connectedBefore) {
      // Back after a disconnect: reload ratings from the backend.
      refetchLawyer(queryClient, null);
    }
    connectedBefore = true;
  });

  socket.on('lawyer_rating_updated', (update: LawyerRatingUpdate) => {
    refetchLawyer(queryClient, update?.lawyerId ? String(update.lawyerId) : null);
  });

  const appState =
    Platform.OS === 'web'
      ? null
      : AppState.addEventListener('change', state => {
          if (state === 'active') {
            if (!socket.connected) {
              socket.connect();
            }
          } else if (state === 'background') {
            socket.disconnect();
          }
        });

  return () => {
    appState?.remove();
    socket.removeAllListeners();
    socket.disconnect();
  };
}
