import React, { useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';

import { GenieText } from '../../../components';
import { ChevronRightIcon } from '../../../components/icons/ClientIcons';
import { ChevronDownIcon } from '../../../components/icons/Icons';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';

export interface ResearchSection {
  heading: string;
  body: string;
}

const isAuthorities = (heading: string): boolean =>
  /authorit|citation|precedent|case law/i.test(heading);

export const splitIntoSections = (text: string): ResearchSection[] => {
  const lines = (text || '').split('\n');
  const sections: ResearchSection[] = [];
  let current: ResearchSection = { heading: '', body: '' };

  for (const line of lines) {
    const match = line.trim().match(/^#{2,4}\s*(.+)$/);
    if (match) {
      if (current.heading || current.body.trim()) {
        sections.push({ ...current, body: current.body.trim() });
      }
      current = { heading: match[1].trim(), body: '' };
    } else {
      current.body += `${line}\n`;
    }
  }

  if (current.heading || current.body.trim()) {
    sections.push({ ...current, body: current.body.trim() });
  }

  return sections.filter(s => s.heading || s.body);
};

const Body: React.FC<{ text: string }> = ({ text }) => (
  <View className="gap-2">
    {text.split('\n').map((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return <View key={index} className="h-1" />;
      }

      if (/^[-*•]\s+/.test(trimmed)) {
        return (
          <View key={index} className="flex-row items-start gap-2 pl-1">
            <View className="mt-2 h-1.5 w-1.5 rounded-full bg-gold" />
            <GenieText variant="body-sm" tone="secondary" className="flex-1 leading-5">
              {trimmed.replace(/^[-*•]\s+/, '').replace(/\*\*/g, '')}
            </GenieText>
          </View>
        );
      }

      return (
        <GenieText key={index} variant="body-sm" tone="secondary" className="leading-5">
          {trimmed.replace(/\*\*/g, '')}
        </GenieText>
      );
    })}
  </View>
);

const SectionCard: React.FC<{ section: ResearchSection }> = ({ section }) => {
  const { t } = useT();
  const authorities = isAuthorities(section.heading);
  const [isOpen, setIsOpen] = useState(authorities);

  if (!section.heading) {
    return (
      <View className="mb-3 rounded-card border border-border bg-card p-4">
        <Body text={section.body} />
      </View>
    );
  }

  return (
    <View className="mb-3 overflow-hidden rounded-card border border-border bg-card">
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsOpen(open => !open);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={section.heading}
        className="min-h-touch flex-row items-center gap-3 px-4 py-3.5 active:opacity-80"
      >
        <GenieText variant="body-lg" tone="gold" className="flex-1 font-bold">
          {section.heading}
        </GenieText>

        {isOpen ? (
          <ChevronDownIcon size={18} color={colors.textSecondary} />
        ) : (
          <ChevronRightIcon size={18} color={colors.textSecondary} />
        )}
      </Pressable>

      {isOpen ? (
        <View className="px-4 pb-4">
          {authorities ? (
            <View className="mb-3 rounded-control border border-warning bg-warning-surface px-3 py-2">
              <GenieText variant="caption" tone="warning" className="leading-4">
                {t('lawyer:research.authoritiesWarning')}
              </GenieText>
            </View>
          ) : null}

          <Body text={section.body} />
        </View>
      ) : null}
    </View>
  );
};

export const ResearchAnswer: React.FC<{ text: string }> = ({ text }) => {
  const sections = splitIntoSections(text);

  if (sections.length === 0) {
    return null;
  }

  return (
    <View>
      {sections.map((section, index) => (
        <SectionCard key={`${section.heading}-${index}`} section={section} />
      ))}
    </View>
  );
};
