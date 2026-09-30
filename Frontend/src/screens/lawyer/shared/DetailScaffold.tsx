import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GenieHeader, GenieScreen, GenieSkeleton,
  GenieRefreshControl,
} from '../../../components';
import { DetailError } from './CaseDetailParts';

interface DetailScaffoldProps {
  title: string;
  onBack: () => void;
  isPending: boolean;
  error: unknown;
  // Return the refetch promise(s) so pull-to-refresh spins until they settle.
  onRefresh: () => unknown;
  children: React.ReactNode;
}

// Loading, failure and pull-to-refresh shell shared by the lawyer detail screens.
export const DetailScaffold: React.FC<DetailScaffoldProps> = ({
  title,
  onBack,
  isPending,
  error,
  onRefresh,
  children,
}) => {
  const header = <GenieHeader title={title} onBack={onBack} />;

  if (isPending) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        {header}
        <View className="mt-1 gap-3 px-5" testID="detail-loading">
          <GenieSkeleton className="h-16 w-full rounded-card" />
          <GenieSkeleton className="h-7 w-4/5" />
          <GenieSkeleton className="h-4 w-1/2" />
          <GenieSkeleton className="mt-4 h-24 w-full rounded-card" />
          <GenieSkeleton className="h-36 w-full rounded-card" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        {header}
        <DetailError error={error} onRetry={onRefresh} />
      </SafeAreaView>
    );
  }

  return (
    <GenieScreen
      scrollable
      header={header}
      dismissKeyboardOnTap={false}
      contentContainerClassName="pb-10"
      scrollViewProps={{
        refreshControl: (
          <GenieRefreshControl onRefresh={onRefresh} />
        ),
      }}
    >
      {children}
    </GenieScreen>
  );
};
