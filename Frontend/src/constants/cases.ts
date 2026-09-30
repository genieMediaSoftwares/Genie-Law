import { colors } from '../theme';
import type { CaseStatus, LegalCase } from '../types/domain';

export const CASE_TABS = ['All', 'In Progress', 'Closed'] as const;
export type CaseTab = (typeof CASE_TABS)[number];

const ACCEPTED_IN_PROGRESS_STATUSES: readonly CaseStatus[] = ['Accepted', 'In Progress'];
const CLOSED_STATUSES: readonly CaseStatus[] = ['Completed', 'Closed', 'Rejected'];

export const matchesTab = (item: LegalCase | CaseStatus, tab: CaseTab): boolean => {
  if (tab === 'All') {
    return true;
  }
  if (typeof item === 'string') {
    if (tab === 'In Progress') {
      return ACCEPTED_IN_PROGRESS_STATUSES.includes(item);
    }
    return CLOSED_STATUSES.includes(item);
  }
  if (tab === 'In Progress') {
    if (CLOSED_STATUSES.includes(item.status)) {
      return false;
    }
    return (
      ACCEPTED_IN_PROGRESS_STATUSES.includes(item.status) ||
      Boolean(item.assignedLawyer) ||
      Boolean(item.acceptedAt)
    );
  }
  return CLOSED_STATUSES.includes(item.status);
};

export const statusColor = (status: CaseStatus): string => {
  switch (status) {
    case 'In Progress':
      return colors.success;
    case 'Accepted':
    case 'Interested':
      return colors.info;
    case 'Submitted':
    case 'Awaiting Lawyer Acceptance':
    case 'Pending Lawyer Response':
      return colors.gold;
    case 'Rejected':
      return colors.error;
    case 'Completed':
    case 'Closed':
      return colors.textMuted;
    default:
      return colors.textSecondary;
  }
};

export const CASE_STAGES = ['Posted', 'Selected', 'Consult', 'Resolved'] as const;
export type CaseStage = (typeof CASE_STAGES)[number];

export const stageIndexForStatus = (status: CaseStatus): number => {
  switch (status) {
    case 'Submitted':
      return 0;
    case 'Awaiting Lawyer Acceptance':
    case 'Pending Lawyer Response':
    case 'Interested':
      return 1;
    case 'Accepted':
    case 'In Progress':
      return 2;
    case 'Completed':
    case 'Closed':
      return 3;
    case 'Rejected':
      return -1;
    default:
      return 0;
  }
};

export const DEFAULT_URGENCY = 'Flexible';
