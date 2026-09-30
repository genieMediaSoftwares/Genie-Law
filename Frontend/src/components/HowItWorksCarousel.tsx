import React from 'react';
import { ScrollView, View } from 'react-native';

import { GenieText } from './ui';
import { ChevronRightIcon, CloudUploadIcon, EditIcon, ScalesIcon } from './icons/ClientIcons';
import { CheckCircleIcon, UsersIcon } from './icons/LawyerIcons';
import type { IconProps } from './icons/Icons';
import { colors } from '../theme';
import i18n from '../i18n';
import { useT } from '../i18n/useT';

export interface HowItWorksStep {
  id: string;
  title: string;
  description: string;
  Icon: React.FC<IconProps>;
}

// Static instructions for posting a case; not backend data. Built when
// rendered so the text follows the current language.
export const howItWorksSteps = (): HowItWorksStep[] => [
  {
    id: 'select-issue',
    title: i18n.t('home:howItWorks.selectIssue'),
    description: i18n.t('home:howItWorks.selectIssueDescription'),
    Icon: ScalesIcon,
  },
  {
    id: 'case-details',
    title: i18n.t('home:howItWorks.caseDetails'),
    description: i18n.t('home:howItWorks.caseDetailsDescription'),
    Icon: EditIcon,
  },
  {
    id: 'upload-document',
    title: i18n.t('home:howItWorks.uploadDocument'),
    description: i18n.t('home:howItWorks.uploadDocumentDescription'),
    Icon: CloudUploadIcon,
  },
  {
    id: 'recommended-lawyer',
    title: i18n.t('home:howItWorks.recommendedLawyer'),
    description: i18n.t('home:howItWorks.recommendedLawyerDescription'),
    Icon: UsersIcon,
  },
  {
    id: 'review',
    title: i18n.t('home:howItWorks.review'),
    description: i18n.t('home:howItWorks.reviewDescription'),
    Icon: CheckCircleIcon,
  },
];

export const HowItWorksCarousel: React.FC<{
  steps?: readonly HowItWorksStep[];
  bleed?: number;
}> = ({ steps: stepsProp, bleed = 16 }) => {
  useT(); // re-render when the language changes
  const steps = stepsProp ?? howItWorksSteps();
  return (
    <View testID="how-it-works" style={{ marginHorizontal: -bleed }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: bleed,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        {steps.map((step, index) => {
          const { Icon } = step;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              {/* Step Item */}
              <View
                testID={`how-it-works-slide-${index}`}
                accessible
                accessibilityLabel={i18n.t('home:howItWorks.stepA11y', {
                  step: index + 1,
                  total: steps.length,
                  title: step.title,
                  description: step.description,
                })}
                style={{ width: 104 }}
                className="items-center"
              >
                {/* Step Circle & Badge */}
                <View className="relative items-center justify-center">
                  <View
                    testID={`how-it-works-circle-${index}`}
                    className="h-12 w-12 items-center justify-center rounded-full bg-surface-secondary"
                  >
                    <Icon size={22} color={colors.gold} />
                  </View>
                  <View
                    testID={`how-it-works-badge-${index}`}
                    className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-gold"
                  >
                    <GenieText
                      variant="caption"
                      tone="on-gold"
                      className="text-small-label font-bold"
                    >
                      {String(index + 1)}
                    </GenieText>
                  </View>
                </View>

                {/* Step Title */}
                <GenieText
                  variant="caption"
                  className="mt-2.5 text-center font-semibold"
                  numberOfLines={3}
                >
                  {step.title}
                </GenieText>

                {/* Step Description */}
                <GenieText
                  variant="caption"
                  tone="muted"
                  className="mt-1 text-center text-small-label leading-tight"
                  numberOfLines={4}
                >
                  {step.description}
                </GenieText>
              </View>

              {/* Small light arrow connecting adjacent steps */}
              {!isLast && (
                <View
                  style={{ pointerEvents: 'none', marginTop: 21 }}
                  importantForAccessibility="no-hide-descendants"
                  className="items-center justify-center px-1"
                >
                  <ChevronRightIcon size={14} color={colors.textMuted} />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
};
