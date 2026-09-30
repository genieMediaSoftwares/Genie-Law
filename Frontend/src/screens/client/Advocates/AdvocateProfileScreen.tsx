import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieAvatar,
  GenieButton,
  GenieChip,
  GenieErrorState,
  GenieHeader,
  GenieIconButton,
  GenieSkeleton,
  GenieText,
  ProfileImageViewer,
  VerifiedBadge,
  GenieRefreshControl,
  GenieSkeletonList,
  ReviewCard,
  WriteReviewSheet,
  BookConsultationSheet,
} from '../../../components';
import {
  BriefcaseIcon,
  HeartIcon,
  LocationIcon,
  StarIcon,
} from '../../../components/icons/ClientIcons';
import { advocatesApi, favoritesApi } from '../../../api/advocatesApi';
import { reviewsApi } from '../../../api/reviewsApi';
import { appointmentsApi } from '../../../api/appointmentsApi';
import { casesApi } from '../../../api/casesApi';
import { chatApi } from '../../../api/chatApi';
import { formatExperience, formatRating } from '../../../utils/format';
import { toAppError } from '../../../utils/errors';
import { useAuthStore } from '../../../store/authStore';
import type { FavoriteEntry } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { practiceAreaLabel } from '../../../i18n/labels';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View className="mt-6">
    <GenieText variant="heading-sm" className="mb-2">
      {title}
    </GenieText>
    {children}
  </View>
);

export const AdvocateProfileScreen: React.FC<
  ClientStackScreenProps<'AdvocateProfile'>
> = ({ navigation, route }) => {
  const { t } = useT();
  const { userId } = route.params;
  const queryClient = useQueryClient();
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['advocate', userId],
    queryFn: () => advocatesApi.getById(userId),
  });

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: favoritesApi.list,
  });

  const currentUserId = useAuthStore(state => state.user?.id);
  const [isWritingReview, setIsWritingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => reviewsApi.listForLawyer(userId),
  });

  // The backend accepts a review only from a client who actually worked with
  // this advocate, so the button appears only when that is already true.
  const myCasesQuery = useQuery({
    queryKey: ['cases', 'list'],
    queryFn: casesApi.list,
  });

  const idOf = (value: unknown): string => {
    if (value && typeof value === 'object' && '_id' in value) {
      return String((value as { _id?: unknown })._id ?? '');
    }
    return value == null ? '' : String(value);
  };

  const workedWithAdvocate = useMemo(
    () => (myCasesQuery.data ?? []).some(item => idOf(item.assignedLawyer) === userId),
    [myCasesQuery.data, userId],
  );

  const alreadyReviewed = useMemo(
    () =>
      (reviewsQuery.data ?? []).some(
        item => currentUserId && idOf(item.client) === String(currentUserId),
      ),
    [reviewsQuery.data, currentUserId],
  );

  const submitReview = useMutation({
    mutationFn: (input: { rating: number; review: string }) =>
      reviewsApi.create({ lawyerId: userId, ...input }),
    onSuccess: async () => {
      setIsWritingReview(false);
      setReviewError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews', userId] }),
        queryClient.invalidateQueries({ queryKey: ['advocate', userId] }),
      ]);
    },
    onError: error => setReviewError(toAppError(error).message),
  });

  const reportReview = useMutation({
    mutationFn: (reviewId: string) => reviewsApi.report(reviewId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews', userId] }),
  });

  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const bookConsultation = useMutation({
    mutationFn: (input: {
      date: string;
      timeSlot: string;
      mode: 'Chat' | 'In-Person';
      notes?: string;
    }) => appointmentsApi.book({ lawyer: userId, ...input }),
    onSuccess: async () => {
      setIsBooking(false);
      setBookingError(null);
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      navigation.navigate('Appointments');
    },
    onError: error => setBookingError(toAppError(error).message),
  });

  const isFavorite = useMemo(
    () =>
      (favoritesQuery.data ?? []).some(entry => entry.lawyer?._id === userId),
    [favoritesQuery.data, userId],
  );

  const toggleFavorite = useMutation({
    mutationFn: () => favoritesApi.toggle(userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<FavoriteEntry[]>(['favorites']);

      queryClient.setQueryData<FavoriteEntry[]>(['favorites'], current => {
        const list = current ?? [];
        return list.some(entry => entry.lawyer?._id === userId)
          ? list.filter(entry => entry.lawyer?._id !== userId)
          : [
              ...list,
              {
                _id: `pending:${userId}`,
                lawyer: {
                  _id: userId,
                  fullName: '',
                  email: '',
                  mobile: '',
                  profileImage: '',
                },
                profile: null,
              },
            ];
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['favorites'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const profile = profileQuery.data;
  const user = profile?.user;

  const handleChatNow = async () => {
    if (isStartingChat) {
      return;
    }
    setIsStartingChat(true);
    try {
      const chat = await chatApi.getOrCreateChat(userId);
      navigation.navigate('Chat', {
        chatId: chat._id,
        name: user?.fullName,
        avatar: user?.profileImage,
      });
    } catch {
      navigation.navigate('Messages');
    } finally {
      setIsStartingChat(false);
    }
  };

  const ratingStr = formatRating(profile?.rating);
  const reviewCount = profile?.totalReviews || 0;
  const expStr = formatExperience(profile?.experience);

  const expertiseList = useMemo(() => {
    if (!profile) {
      return [];
    }
    if (
      Array.isArray(profile.practiceAreas) &&
      profile.practiceAreas.length > 0
    ) {
      return profile.practiceAreas;
    }
    if (
      Array.isArray(profile.specialization) &&
      profile.specialization.length > 0
    ) {
      return profile.specialization;
    }
    if (
      typeof profile.specialization === 'string' &&
      profile.specialization.trim().length > 0
    ) {
      return [profile.specialization.trim()];
    }
    return [];
  }, [profile]);

  const header = (
    <GenieHeader
      title={t('client:advocateProfile.title')}
      onBack={() => navigation.goBack()}
      right={
        <GenieIconButton
          icon={
            <HeartIcon
              size={22}
              color={isFavorite ? colors.gold : colors.textMuted}
              filled={isFavorite}
            />
          }
          onPress={() => toggleFavorite.mutate()}
          accessibilityLabel={
            isFavorite
              ? t('client:advocateProfile.removeFavourite')
              : t('client:advocateProfile.addFavourite')
          }
        />
      }
    />
  );

  const renderBody = () => {
    if (profileQuery.isPending) {
      return (
        <View className="items-center gap-3 px-4 pt-4">
          <GenieSkeleton className="h-24 w-24 rounded-full" />
          <GenieSkeleton className="h-6 w-3/5 rounded-lg" />
          <GenieSkeleton className="h-4 w-2/5 rounded-lg" />
          <GenieSkeleton className="mt-6 h-28 w-full rounded-card" />
        </View>
      );
    }

    if (profileQuery.isError) {
      return (
        <View className="px-4">
          <GenieErrorState
            message={profileQuery.error.message}
            onRetry={() => profileQuery.refetch()}
          />
        </View>
      );
    }

    if (!profile || !user) {
      return null;
    }

    return (
      <View className="flex-1 justify-between">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-6"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <GenieRefreshControl onRefresh={() => profileQuery.refetch()} />
          }
        >
          <View className="gap-3 pt-1">
            <Pressable
              onPress={() => setIsPhotoOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('client:advocateProfile.viewPhotoA11y', { name: user.fullName })}
              className="rounded-card bg-card p-4 active:bg-surface-secondary"
            >
              <View className="flex-row items-start gap-4">
                <GenieAvatar
                  uri={user.profileImage}
                  name={user.fullName}
                  size="hero"
                  ring={Boolean(user.isVerified)}
                />

                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <GenieText variant="heading-md" className="flex-shrink">
                      {user.fullName}
                    </GenieText>
                    {user.isVerified ? (
                      <VerifiedBadge size={20} />
                    ) : null}
                  </View>

                  <GenieText variant="body-md" tone="gold" className="mt-1">
                    {Array.isArray(profile.specialization)
                      ? profile.specialization.map(practiceAreaLabel).join(', ')
                      : practiceAreaLabel(profile.specialization) ||
                        t('client:advocateProfile.generalPractice')}
                  </GenieText>

                  <View className="mt-1.5 flex-row items-center gap-1.5">
                    <LocationIcon size={13} color={colors.textMuted} />
                    <GenieText variant="secondary" tone="secondary" numberOfLines={1}>
                      {user.location || profile.officeAddress || profile.district || t('common:advocate.noLocation')}
                    </GenieText>
                  </View>
                </View>
              </View>

              <View className="mt-4 flex-row gap-2">
                {reviewCount > 0 ? (
                  <View className="flex-1 items-center rounded-control bg-surface px-3 py-2.5">
                    <View className="flex-row items-center gap-1">
                      <StarIcon size={14} color={colors.gold} />
                      <GenieText variant="button" tone="gold">
                        {ratingStr}
                      </GenieText>
                    </View>
                    <GenieText variant="caption" tone="muted" className="mt-0.5">
                      {t('client:advocateProfile.reviews', { count: reviewCount })}
                    </GenieText>
                  </View>
                ) : (
                  <View className="flex-1 items-center rounded-control bg-surface px-3 py-2.5">
                    <GenieText variant="button" tone="muted">--</GenieText>
                    <GenieText variant="caption" tone="muted" className="mt-0.5">{t('client:advocateProfile.noRatings')}</GenieText>
                  </View>
                )}
                <View className="flex-1 items-center rounded-control bg-surface px-3 py-2.5">
                  <View className="flex-row items-center gap-1">
                    <BriefcaseIcon size={14} color={colors.gold} />
                    <GenieText variant="button" tone="primary">
                      {expStr || t('client:advocateProfile.na')}
                    </GenieText>
                  </View>
                  <GenieText variant="caption" tone="muted" className="mt-0.5">{t('client:advocateProfile.experience')}</GenieText>
                </View>
              </View>
            </Pressable>

            <View className="flex-row gap-2">
              <Pressable
                onPress={handleChatNow}
                accessibilityRole="button"
                accessibilityLabel={t('client:advocateProfile.messageA11y', { name: user.fullName })}
                className="h-[50px] flex-1 flex-row items-center justify-center gap-1.5 rounded-control bg-gold active:bg-gold-pressed"
              >
                <GenieText variant="button" tone="on-gold" className="font-semibold">{t('client:advocateProfile.message')}</GenieText>
              </Pressable>
              <Pressable
                onPress={() => { setBookingError(null); setIsBooking(true); }}
                accessibilityRole="button"
                accessibilityLabel={t('client:advocateProfile.bookA11y', { name: user.fullName })}
                className="h-[50px] flex-1 flex-row items-center justify-center gap-1.5 rounded-control border border-border bg-surface active:bg-surface-secondary"
              >
                <GenieText variant="button" tone="gold" className="font-semibold">{t('client:advocateProfile.bookConsultation')}</GenieText>
              </Pressable>
            </View>
          </View>

          <Section title={t('client:advocateProfile.aboutMe')}>
            <View className="rounded-card bg-card p-4">
              <GenieText variant="body-md" tone="secondary">
                {profile.bio && profile.bio.trim().length > 0
                  ? profile.bio
                  : t('client:advocateProfile.noBio')}
              </GenieText>
            </View>
          </Section>

          <Section title={t('client:advocateProfile.expertise')}>
            {expertiseList.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {expertiseList.map((area, idx) => (
                  <GenieChip key={`${area}-${idx}`} label={practiceAreaLabel(area)} />
                ))}
              </View>
            ) : (
              <View className="rounded-card bg-card p-4">
                <GenieText variant="body-sm" tone="secondary">
                  {t('client:advocateProfile.noExpertise')}
                </GenieText>
              </View>
            )}
          </Section>

          <Section
            title={
              reviewCount > 0
                ? t('client:advocateProfile.reviewsTitleCount', { count: reviewCount })
                : t('client:advocateProfile.reviewsTitle')
            }
          >
            {workedWithAdvocate && !alreadyReviewed ? (
              <GenieButton
                label={t('client:advocateProfile.writeReview')}
                variant="outline"
                fullWidth={false}
                className="mb-3"
                onPress={() => {
                  setReviewError(null);
                  setIsWritingReview(true);
                }}
              />
            ) : null}

            {reviewsQuery.isPending ? (
              <GenieSkeletonList count={2} />
            ) : reviewsQuery.isError ? (
              <GenieErrorState
                message={reviewsQuery.error.message}
                onRetry={() => reviewsQuery.refetch()}
              />
            ) : (reviewsQuery.data ?? []).length === 0 ? (
              <GenieText variant="body-sm" tone="muted">
                {t('client:advocateProfile.noReviews')}
              </GenieText>
            ) : (
              (reviewsQuery.data ?? []).map(item => (
                <ReviewCard
                  key={item._id}
                  review={item}
                  onReport={review => reportReview.mutate(review._id)}
                />
              ))
            )}
          </Section>
        </ScrollView>

        <View className="bg-surface px-4 py-3">
          <GenieButton
            label={t('client:advocateProfile.bookConsultationButton')}
            variant="outline"
            className="mb-2"
            onPress={() => {
              setBookingError(null);
              setIsBooking(true);
            }}
          />
          <GenieButton
            label={t('client:advocateProfile.chatNow')}
            loadingLabel={t('client:advocateProfile.openingChat')}
            loading={isStartingChat}
            onPress={handleChatNow}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      {header}
      {renderBody()}

      <BookConsultationSheet
        visible={isBooking}
        lawyerName={profile?.user?.fullName ?? t('client:advocateProfile.thisAdvocate')}
        consultationFee={profile?.consultationFee ?? null}
        isSubmitting={bookConsultation.isPending}
        error={bookingError}
        onClose={() => setIsBooking(false)}
        onSubmit={input => bookConsultation.mutate(input)}
      />

      <WriteReviewSheet
        visible={isWritingReview}
        lawyerName={profile?.user?.fullName ?? t('client:advocateProfile.thisAdvocate')}
        isSubmitting={submitReview.isPending}
        error={reviewError}
        onClose={() => setIsWritingReview(false)}
        onSubmit={input => submitReview.mutate(input)}
      />

      <ProfileImageViewer
        visible={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        imageUri={user?.profileImage}
        name={user?.fullName}
      />
    </SafeAreaView>
  );
};
