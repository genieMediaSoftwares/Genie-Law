import React, { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from 'react-native';

export interface GenieGridProps<T> {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number, itemWidth: number) => React.ReactNode;
  numColumns?: number;
  gap?: number;
  className?: string;
  testID?: string;
  emptyComponent?: React.ReactNode;
}

/**
 * A non-virtualized, equal-width grid.
 *
 * Every item gets the SAME fixed pixel width, computed from the container's
 * measured width — including the last, incomplete row. This avoids the
 * classic `FlatList numColumns` bug where `flex: 1` items in a short final
 * row stretch to fill the remaining space and end up wider than every other
 * item. Text never influences item width; long labels wrap inside the fixed
 * width instead.
 *
 * Intended for short, non-paginated lists (categories, filter grids). For
 * long, server-paginated lists keep using FlatList.
 */
export function GenieGrid<T>({
  data,
  keyExtractor,
  renderItem,
  numColumns = 4,
  gap = 12,
  className = '',
  testID,
  emptyComponent,
}: GenieGridProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setContainerWidth(current => (width > 0 && width !== current ? width : current));
  }, []);

  if (data.length === 0) {
    return (
      <View onLayout={onLayout} testID={testID}>
        {emptyComponent}
      </View>
    );
  }

  // Total gap width consumed between columns, subtracted before dividing so
  // every column — including the last row's — is exactly the same width.
  const itemWidth =
    containerWidth > 0 ? (containerWidth - gap * (numColumns - 1)) / numColumns : 0;

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      className={`flex-row flex-wrap ${className}`}
      style={{ columnGap: gap, rowGap: gap }}
    >
      {containerWidth > 0
        ? data.map((item, index) => (
            <View key={keyExtractor(item, index)} style={{ width: itemWidth }}>
              {renderItem(item, index, itemWidth)}
            </View>
          ))
        : null}
    </View>
  );
}
