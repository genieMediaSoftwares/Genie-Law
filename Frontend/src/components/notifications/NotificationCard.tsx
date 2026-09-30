import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { GenieAvatar } from '../ui/GenieAvatar';
import { GenieText } from '../ui/GenieText';
import {
  BellIcon,
  BriefcaseIcon,
  ChatIcon,
  ChevronRightIcon,
  CloseIcon,
  FileIcon,
  TrashIcon,
} from '../icons/ClientIcons';
import {
  CalendarIcon,
  ChartIcon,
  UserPlusIcon,
} from '../icons/LawyerIcons';
import { CheckIcon, MailIcon } from '../icons/Icons';
import { formatRelative } from '../../utils/format';
import type { AppNotification } from '../../types/domain';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

interface NotificationCardProps {
  item: AppNotification;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onPress: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'case_posted':
    case 'proposal_received':
    case 'proposal_accepted':
    case 'proposal_rejected':
      return BriefcaseIcon;
    case 'chat_message':
      return ChatIcon;
    case 'document_uploaded':
      return FileIcon;
    case 'appointment_requested':
    case 'appointment_confirmed':
    case 'appointment_cancelled':
    case 'reminder':
      return CalendarIcon;
    case 'case_status_updated':
      return ChartIcon;
    case 'profile_verification':
    case 'review_received':
      return UserPlusIcon;
    default:
      return BellIcon;
  }
};

export const NotificationCard: React.FC<NotificationCardProps> = ({
  item,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  onPress,
  onMarkRead,
  onDelete,
}) => {
  const { t } = useT();
  const [showActions, setShowActions] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const IconComp = getTypeIcon(item.type);
  const hasSenderAvatar = Boolean(item.senderId?.profileImage || item.senderId?.fullName);

  const handlePushAway = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onDelete();
    }, 200);
  };

  if (isDismissing) {
    return null;
  }

  return (
    <View className="mb-3 w-full max-w-3xl mx-auto">
      <View className="flex-row items-center gap-2">
        {isSelectMode ? (
          <Pressable
            onPress={onToggleSelect}
            className="p-1 active:opacity-70"
          >
            <View
              className={`h-6 w-6 items-center justify-center rounded-full border ${
                isSelected
                  ? 'border-border bg-gold'
                  : 'border-border bg-surface-alt'
              }`}
            >
              {isSelected ? (
                <CheckIcon size={14} color={colors.onGold} />
              ) : null}
            </View>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => {
            if (isSelectMode) {
              onToggleSelect?.();
            } else {
              onPress();
            }
          }}
          onLongPress={() => {
            if (!isSelectMode) {
              setShowActions(!showActions);
            }
          }}
          // The gold dot is visual only; screen readers hear "Unread" instead.
          accessibilityRole="button"
          accessibilityLabel={`${item.isRead ? '' : `${t('notifications:card.unreadA11y')}, `}${item.title}. ${item.message}`}
          accessibilityState={{ selected: isSelectMode ? Boolean(isSelected) : undefined }}
          className={`flex-1 rounded-card p-4 transition-all ${
            isSelected
              ? 'border-2 border-border bg-surface-alt'
              : item.isRead
              ? 'border border-border bg-surface-alt'
              : 'border border-border bg-surface-alt '
          }`}
        >
          <View className="flex-row items-start gap-3">
            {hasSenderAvatar ? (
              <View className="relative">
                <GenieAvatar
                  uri={item.senderId?.profileImage}
                  name={item.senderId?.fullName || item.title}
                  size="md"
                />
                <View className="absolute -bottom-1 -right-1 items-center justify-center rounded-full bg-surface p-1 border border-border">
                  <IconComp size={10} color={colors.gold} />
                </View>
              </View>
            ) : (
              <View className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-alt">
                <IconComp size={20} color={colors.gold} />
              </View>
            )}

            <View className="flex-1 pr-1">
              <GenieText
                className="font-bold text-base text-text-primary"
                numberOfLines={1}
              >
                {item.title}
              </GenieText>

              <GenieText
                className="mt-0.5 text-xs text-text-secondary leading-4"
                numberOfLines={2}
              >
                {item.message}
              </GenieText>

              <GenieText className="mt-1.5 text-xs text-text-muted">
                {formatRelative(item.createdAt)}
              </GenieText>
            </View>

            <View className="flex-row items-center gap-2 pt-0.5">
              {!item.isRead ? (
                <View className="h-2.5 w-2.5 rounded-full bg-gold" />
              ) : null}

              {!isSelectMode ? (
                <Pressable
                  onPress={handlePushAway}
                  hitSlop={8}
                  className="rounded-full bg-surface-alt p-1.5 active:bg-border"
                  accessibilityLabel={t('notifications:card.dismissA11y')}
                >
                  <CloseIcon size={14} color={colors.textMuted} />
                </Pressable>
              ) : null}

              <ChevronRightIcon size={16} color={colors.textMuted} />
            </View>
          </View>
        </Pressable>
      </View>

      {showActions && !isSelectMode ? (
        <View className="mt-2 flex-row gap-2">
          {!item.isRead ? (
            <Pressable
              onPress={() => {
                setShowActions(false);
                onMarkRead();
              }}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-control border border-border bg-surface-alt py-2.5"
            >
              <MailIcon size={16} color={colors.gold} />
              <GenieText className="font-semibold text-xs text-text-primary">
                {t('notifications:card.markRead')}
              </GenieText>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              setShowActions(false);
              onDelete();
            }}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-control bg-error py-2.5 active:opacity-80"
          >
            <TrashIcon size={16} color={colors.white} />
            <GenieText className="font-bold text-xs text-white">
              {t('notifications:card.delete')}
            </GenieText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};
