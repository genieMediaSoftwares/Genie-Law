import React from 'react';
import { View } from 'react-native';
import { GenieText } from './GenieText';
import type { GenieTextTone } from './GenieText';
import { displayLabel } from '../../i18n/labels';

type Kind = 'live' | 'progress' | 'done' | 'pending' | 'failed' | 'neutral';

// Solid pill: dark status tint, thin status border and a dot.
const KINDS: Record<Kind, { surface: string; border: string; dot: string; tone: GenieTextTone }> = {
  live: { surface: 'bg-surface-secondary', border: 'border-border', dot: 'bg-gold', tone: 'gold' },
  progress: { surface: 'bg-info-surface', border: 'border-info', dot: 'bg-info', tone: 'info' },
  done: { surface: 'bg-success-surface', border: 'border-success', dot: 'bg-success', tone: 'success' },
  pending: { surface: 'bg-warning-surface', border: 'border-warning', dot: 'bg-warning', tone: 'warning' },
  failed: { surface: 'bg-error-surface', border: 'border-error', dot: 'bg-error', tone: 'error' },
  neutral: { surface: 'bg-surface-secondary', border: 'border-border', dot: 'bg-muted', tone: 'secondary' },
};

const BY_STATUS: Record<string, Kind> = {
  active: 'live',
  open: 'live',
  verified: 'live',
  ongoing: 'live',
  'in progress': 'progress',
  in_progress: 'progress',
  accepted: 'done',
  closed: 'done',
  completed: 'done',
  resolved: 'done',
  approved: 'done',
  pending: 'pending',
  submitted: 'pending',
  interested: 'pending',
  'awaiting lawyer acceptance': 'pending',
  'pending lawyer response': 'pending',
  'in review': 'pending',
  review: 'pending',
  rejected: 'failed',
  cancelled: 'failed',
  failed: 'failed',
};

export interface GenieStatusBadgeProps {
  status: string;
  className?: string;
}

export const GenieStatusBadge: React.FC<GenieStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const kind = BY_STATUS[status.toLowerCase().trim()] ?? 'neutral';
  const { surface, border, dot, tone } = KINDS[kind];

  return (
    <View
      className={`h-[28px] flex-row items-center self-start rounded-[14px] border px-[10px] ${surface} ${border} ${className}`}
    >
      <View className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dot}`} />
      <GenieText variant="statusBadge" tone={tone} className="capitalize">
        {displayLabel('cases:status', status.replace(/_/g, ' '))}
      </GenieText>
    </View>
  );
};
