import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { GenieBottomSheet, GenieText } from './ui';
import { CheckIcon, ChevronDownIcon, UserIcon } from './icons/Icons';
import { roleOptions, roleLabel } from '../constants/roles';
import { colors } from '../theme';
import type { SignupRole } from '../types/auth';
import { useT } from '../i18n/useT';

interface RolePickerProps {
  label?: string;
  value: SignupRole;
  onChange: (role: SignupRole) => void;
  error?: string;
}

export const RolePicker: React.FC<RolePickerProps> = ({
  label,
  value,
  onChange,
  error,
}) => {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);

  const select = (role: SignupRole) => {
    onChange(role);
    setIsOpen(false);
  };

  return (
    <View className="mb-4">
      {label ? (
        <GenieText variant="label" className="mb-2">
          {label}
        </GenieText>
      ) : null}

      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('auth:roles.pickerA11y', { role: roleLabel(value) })}
        className={[
          'h-control flex-row items-center rounded-control border bg-input px-4 active:border-border',
          error ? 'border-error' : 'border-border',
        ].join(' ')}
      >
        <UserIcon />
        <GenieText variant="body-lg" className="ml-3 flex-1">
          {roleLabel(value)}
        </GenieText>
        <ChevronDownIcon />
      </Pressable>

      {error ? (
        <GenieText variant="caption" tone="error" className="ml-1 mt-1.5">
          {error}
        </GenieText>
      ) : null}

      <GenieBottomSheet
        visible={isOpen}
        onClose={() => setIsOpen(false)}
        title={t('auth:fields.selectRole')}
      >
        <View className="pb-6">
          {roleOptions().map(option => {
            const isSelected = option.value === value;

            return (
              <Pressable
                key={option.value}
                onPress={() => select(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${option.label}. ${option.description}`}
                className={[
                  'mb-3 flex-row items-center rounded-control border px-4 py-4 active:opacity-75',
                  isSelected
                    ? 'border-border bg-gold-muted'
                    : 'border-border bg-input',
                ].join(' ')}
              >
                <View className="flex-1">
                  <GenieText
                    variant="label"
                    tone={isSelected ? 'gold' : 'primary'}
                    className="text-base"
                  >
                    {option.label}
                  </GenieText>
                  <GenieText variant="caption" tone="secondary" className="mt-0.5">
                    {option.description}
                  </GenieText>
                </View>

                {isSelected ? <CheckIcon size={22} color={colors.gold} /> : null}
              </Pressable>
            );
          })}
        </View>
      </GenieBottomSheet>
    </View>
  );
};
