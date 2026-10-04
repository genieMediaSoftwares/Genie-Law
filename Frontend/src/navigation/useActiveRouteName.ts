import { useContext } from 'react';
import { NavigationContainerRefContext } from '@react-navigation/native';

// Name of the innermost focused route (the tab, when the tab bar is showing).
// The app's overlays render beside the navigators rather than inside one, so
// they read it from the container. Read on render: the drawer re-renders each
// time it opens, which is when the value matters.
export const useActiveRouteName = (): string | undefined => {
  const root = useContext(NavigationContainerRefContext);
  return root?.isReady() ? root.getCurrentRoute()?.name : undefined;
};
