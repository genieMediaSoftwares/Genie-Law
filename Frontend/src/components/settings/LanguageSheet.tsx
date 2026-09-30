import React from 'react';
import { Pressable, View } from 'react-native';

import { GenieBottomSheet, GenieText } from '../ui';
import { CheckIcon } from '../icons/Icons';
import { colors } from '../../theme';
import { SUPPORTED_LANGUAGES } from '../../i18n/config';
import type { LanguageCode } from '../../i18n/config';
import { changeLanguage, currentLanguage } from '../../i18n';
import { useT } from '../../i18n/useT';

// Settings → Language. Picking a language switches the whole app immediately
// (no reload, no sign-out) and is remembered for the next launch.
export const LanguageSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const { t } = useT();
  const selected = currentLanguage();

  const choose = async (code: LanguageCode) => {
    if (code !== selected) {
      await changeLanguage(code);
    }
    onClose();
  };

  return (
    <GenieBottomSheet visible={visible} onClose={onClose} title={t('settings:language.title')}>
      <GenieText variant="body-sm" tone="secondary" className="mb-3">
        {t('settings:language.subtitle')}
      </GenieText>
      <View accessibilityRole="radiogroup" className="pb-3">
        {SUPPORTED_LANGUAGES.map(language => {
          const isSelected = language.code === selected;
          return (
            <Pressable
              key={language.code}
              onPress={() => choose(language.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${language.nativeName} (${language.englishName})`}
              className={`mb-2 min-h-[56px] flex-row items-center rounded-control border px-4 py-3 ${
                isSelected ? 'border-gold bg-gold-muted' : 'border-border bg-surface-alt'
              }`}
            >
              <View
                className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                  isSelected ? 'border-gold bg-gold' : 'border-border'
                }`}
              >
                {isSelected ? <CheckIcon size={12} color={colors.onGold} /> : null}
              </View>
              <View className="flex-1">
                <GenieText variant="body-lg" className="font-semibold">
                  {language.nativeName}
                </GenieText>
                {language.code !== 'en' ? (
                  <GenieText variant="caption" tone="secondary" className="mt-0.5">
                    {language.englishName}
                  </GenieText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </GenieBottomSheet>
  );
};
