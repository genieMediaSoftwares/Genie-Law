import React, { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieCard,
  GenieGrid,
  GenieHeroCarousel,
  GenieIconButton,
  GenieScreen,
  GenieText,
  GenieWordmark,
  GenieRefreshControl,
} from '../../../components';
import { HowItWorksCarousel } from '../../../components/HowItWorksCarousel';
import { getCategoryIcon } from '../../../components/icons/CategoryIcons';
import {
  BellIcon,
  ChevronRightIcon,
  MenuIcon,
  SparkleIcon,
} from '../../../components/icons/ClientIcons';
import { notificationsApi } from '../../../api/clientApi';
import { popularCategories } from '../../../services/legalCategories';
import { useAuthStore } from '../../../store/authStore';
import { useUiStore } from '../../../store/uiStore';
import type { ClientTabScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { categoryLabel } from '../../../i18n/labels';

export const HomeScreen: React.FC<ClientTabScreenProps<'Home'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const user = useAuthStore(state => state.user);
  const openDrawer = useUiStore(state => state.openDrawer);
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => notificationsApi.list(1, 15),
  });

  const onRefresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    [queryClient],
  );

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  const header = (
    <View className="h-14 w-full flex-row items-center justify-between bg-background px-4">
      <GenieIconButton
        icon={<MenuIcon size={24} color={colors.white} />}
        onPress={openDrawer}
        accessibilityLabel={t('common:a11y.openMenu')}
      />

      <GenieWordmark size={28} />

      <GenieIconButton
        icon={<BellIcon size={22} color={colors.white} />}
        onPress={() => navigation.navigate('Notifications')}
        accessibilityLabel={t('common:nav.notifications')}
        badgeCount={unreadCount}
      />
    </View>
  );

  return (
    <GenieScreen
      scrollable
      header={header}
      dismissKeyboardOnTap={false}
      contentContainerClassName="pb-24"
      scrollViewProps={{
        refreshControl: (
          <GenieRefreshControl onRefresh={onRefresh} />
        ),
      }}
    >
      {/* Greeting */}
      <View className="mt-1 mb-5">
        <GenieText variant="heading-md" tone="secondary" className="mb-0.5">
          {t('home:welcomeBack')}
        </GenieText>
        <GenieText variant="heading-lg">
          {user ? t('home:helloName', { name: user.fullName.split(' ')[0] }) : t('home:hello')}
        </GenieText>
        <GenieText variant="secondary" tone="secondary" className="mt-1">
          {t('home:howCanWeHelp')}
        </GenieText>
      </View>

      {/* Hero Carousel */}
      <GenieHeroCarousel
        onSlidePress={slide => {
          if (slide.actionType === 'advocates') {
            (navigation as any).navigate('Tabs', { screen: 'Advocates' });
          } else {
            navigation.navigate('AiAssistant');
          }
        }}
      />

      {/* AI Smart Case Assistant - Elevated featured card */}
      <GenieCard
        tone="elevated"
        className="mt-5"
        onPress={() => navigation.navigate('AiAssistant')}
        accessibilityLabel={t('home:smartAssistant')}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="self-start rounded-pill bg-surface-secondary px-2.5 py-1">
              <SparkleIcon size={12} color={colors.gold} />
              <GenieText
                variant="caption"
                tone="gold"
                className="ml-1 font-bold tracking-widest"
              >
                {t('home:aiPowered')}
              </GenieText>
            </View>

            <GenieText variant="cardTitle" className="mt-3">
              {t('home:smartAssistant')}
            </GenieText>
            <GenieText variant="body-sm" tone="secondary" className="mt-1">
              {t('home:smartAssistantDescription')}
            </GenieText>

            <View className="mt-4 flex-row items-center">
              <GenieText variant="button" tone="gold" className="font-semibold">
                {t('home:getStarted')}
              </GenieText>
              <View className="ml-1.5 items-center justify-center">
                <ChevronRightIcon size={18} color={colors.gold} />
              </View>
            </View>
          </View>
        </View>
      </GenieCard>

      {/* Categories */}
      <View className="mt-7">
        <View className="mb-3 flex-row items-baseline justify-between">
          <GenieText variant="sectionTitle">{t('home:categories')}</GenieText>
          <Pressable
            onPress={() => navigation.navigate('AllCategories')}
            accessibilityRole="button"
            accessibilityLabel={t('home:viewAll')}
            hitSlop={8}
          >
            {({ pressed }) => (
              <GenieText variant="caption" tone={pressed ? 'gold' : 'muted'}>
                {t('home:viewAll')}
              </GenieText>
            )}
          </Pressable>
        </View>

        <GenieGrid
          className="mt-3"
          data={popularCategories()}
          keyExtractor={category => category.id}
          numColumns={4}
          gap={12}
          renderItem={category => {
            const IconComponent = getCategoryIcon(category.id);

            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('PostCase', {
                    start: 'manual',
                    categoryId: category.id,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={categoryLabel(category.id)}
                className="items-center"
              >
                {({ pressed }) => (
                  <>
                    <View
                      className={`aspect-square w-full items-center justify-center rounded-card border ${
                        pressed ? 'bg-surface-secondary border-border' : 'bg-card border-border'
                      }`}
                    >
                      <IconComponent size={20} color={colors.gold} />
                    </View>
                    <GenieText
                      variant="caption"
                      className="mt-2 w-full text-center font-medium"
                      numberOfLines={2}
                    >
                      {categoryLabel(category.id)}
                    </GenieText>
                  </>
                )}
              </Pressable>
            );
          }}
        />
      </View>

      {/* AI Legal Chat */}
      <GenieCard
        tone="elevated"
        className="mt-7"
        onPress={() => navigation.navigate('AiChat')}
        accessibilityLabel={t('home:legalAssistant')}
      >
        <View className="flex-row items-center self-start rounded-pill bg-info-surface px-2.5 py-1 border border-info/10">
          <SparkleIcon size={12} color={colors.info} />
          <GenieText
            variant="smallLabel"
            tone="info"
            className="ml-1 font-bold tracking-widest"
          >
            {t('home:aiPowered')}
          </GenieText>
        </View>

        <GenieText variant="cardTitle" className="mt-3">
          {t('home:legalAssistant')}
        </GenieText>
        <GenieText variant="secondary" tone="secondary" className="mt-1">
          {t('home:legalAssistantDescription')}
        </GenieText>

        <View className="mt-4 flex-row items-center">
          <GenieText variant="button" tone="info" className="font-semibold">
            {t('home:askNow')}
          </GenieText>
          <View className="ml-1.5 items-center justify-center">
            <ChevronRightIcon size={18} color={colors.info} />
          </View>
        </View>
      </GenieCard>

      {/* How It Works */}
      <View className="mt-7">
        <View className="mb-3 flex-row items-baseline justify-between">
          <GenieText variant="sectionTitle">{t('home:howItWorksTitle')}</GenieText>
          <GenieText variant="caption" tone="muted">
            {t('home:howItWorksTagline')}
          </GenieText>
        </View>

        <HowItWorksCarousel />
      </View>
    </GenieScreen>
  );
};
