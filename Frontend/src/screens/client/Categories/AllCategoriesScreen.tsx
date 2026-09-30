import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  GenieEmptyState,
  GenieGrid,
  GenieHeader,
  GenieSearchInput,
  GenieText,
} from '../../../components';
import { getCategoryIcon } from '../../../components/icons/CategoryIcons';
import {
  getLegalCategories,
  type LegalCategory,
} from '../../../services/legalCategories';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { categoryLabel } from '../../../i18n/labels';

const GRID_COLUMNS = 4;
const GRID_GAP = 12;

export const AllCategoriesScreen: React.FC<
  ClientStackScreenProps<'AllCategories'>
> = ({ navigation }) => {
  const { t, i18n } = useT();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return getLegalCategories();
    }
    return getLegalCategories().filter(
      c =>
        c.title.toLowerCase().includes(q) ||
        categoryLabel(c.id).toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
    // Re-filter when the language changes: names are matched in both languages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, i18n.language]);

  const handleSelectCategory = (category: LegalCategory) => {
    navigation.navigate('PostCase', {
      start: 'manual',
      categoryId: category.id,
    });
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader title={t('client:categories.title')} onBack={() => navigation.goBack()} />

      <View className="px-4 pb-3 pt-1">
        <GenieSearchInput
          placeholder={t('client:categories.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <GenieGrid
          testID="all-categories-grid"
          data={filteredCategories as LegalCategory[]}
          keyExtractor={item => item.id}
          numColumns={GRID_COLUMNS}
          gap={GRID_GAP}
          emptyComponent={
            <GenieEmptyState
              title={t('client:categories.noneFound')}
              description={t('client:categories.noneFoundHint')}
            />
          }
          renderItem={item => {
            const IconComponent = getCategoryIcon(item.id);

            return (
              <Pressable
                onPress={() => handleSelectCategory(item)}
                accessibilityRole="button"
                accessibilityLabel={categoryLabel(item.id)}
                className="items-center"
              >
                {({ pressed }) => (
                  <>
                  {/* Square icon container — always the same size as every
                      other item in the grid, regardless of row completeness
                      or how long this category's name is. */}
                  <View className={`aspect-square w-full items-center justify-center rounded-card ${pressed ? 'bg-surface-secondary' : 'bg-surface'}`}>
                    <IconComponent size={26} color={colors.gold} />
                  </View>

                  {/* Text area matches the icon card's width; long names wrap
                      instead of resizing the card or truncating. */}
                  <GenieText
                    variant="caption"
                    className="mt-2 w-full text-center font-medium"
                  >
                    {categoryLabel(item.id)}
                  </GenieText>
                  </>
                )}
              </Pressable>
            );
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
