import type { CaseStatus, LegalCase } from '../types/domain';
import type { GenieTextTone } from '../components/ui/GenieText';

export interface ProgressStep {
  index: number;
  title: string;
  label: string;
}

export const PROGRESS_STEPS: ProgressStep[] = [
  { index: 1, title: 'Posted', label: 'Case Posted' },
  { index: 2, title: 'Pending', label: 'Lawyer Pending' },
  { index: 3, title: 'Accepted', label: 'Lawyer Accepted' },
  { index: 4, title: 'Consultation', label: 'Consultation' },
  { index: 5, title: 'Resolved', label: 'Resolved' },
];

export const getCaseProgressStep = (
  status: CaseStatus,
  caseItem?: LegalCase,
): { currentStep: number; isRejected: boolean; activeLabel: string } => {
  if (status === 'Rejected') {
    return { currentStep: 2, isRejected: true, activeLabel: 'Request Declined' };
  }
  if (status === 'Completed' || status === 'Closed') {
    return { currentStep: 5, isRejected: false, activeLabel: 'Resolved' };
  }
  if (
    status === 'In Progress' ||
    (caseItem &&
      (caseItem.consultationDate ||
        (caseItem.hearings && caseItem.hearings.length > 0)))
  ) {
    return { currentStep: 4, isRejected: false, activeLabel: 'Consultation / In Progress' };
  }
  if (
    status === 'Accepted' ||
    (caseItem && (caseItem.assignedLawyer || caseItem.acceptedAt))
  ) {
    return { currentStep: 3, isRejected: false, activeLabel: 'Lawyer Selected & Accepted' };
  }
  if (
    status === 'Awaiting Lawyer Acceptance' ||
    status === 'Pending Lawyer Response' ||
    status === 'Interested'
  ) {
    return { currentStep: 2, isRejected: false, activeLabel: 'Lawyer Verification / Pending' };
  }
  return { currentStep: 1, isRejected: false, activeLabel: 'Posted / Awaiting Lawyer' };
};

export const getStatusBadgeTheme = (
  status: CaseStatus,
): { bg: string; tone: GenieTextTone; border: string; dot: string } => {
  switch (status) {
    case 'Accepted':
      return { bg: 'bg-success-surface', tone: 'success', border: 'border-success', dot: 'bg-success' };
    case 'In Progress':
      return { bg: 'bg-info-surface', tone: 'info', border: 'border-info', dot: 'bg-info' };
    case 'Completed':
    case 'Closed':
      return { bg: 'bg-surface-secondary', tone: 'secondary', border: 'border-border', dot: 'bg-muted' };
    case 'Rejected':
      return { bg: 'bg-error-surface', tone: 'error', border: 'border-error', dot: 'bg-error' };
    case 'Awaiting Lawyer Acceptance':
    case 'Pending Lawyer Response':
    case 'Interested':
    case 'Submitted':
    default:
      return { bg: 'bg-warning-surface', tone: 'warning', border: 'border-warning', dot: 'bg-warning' };
  }
};

export const getAssignedLawyerData = (item: LegalCase) => {
  const userObj =
    typeof item.assignedLawyer === 'object' && item.assignedLawyer
      ? item.assignedLawyer
      : typeof item.selectedLawyer === 'object' && item.selectedLawyer
      ? item.selectedLawyer
      : null;

  const profileObj = item.assignedLawyerProfile || item.selectedLawyerProfile || null;

  if (!userObj) {
    return null;
  }

  return {
    id: userObj._id,
    fullName: userObj.fullName,
    email: userObj.email,
    mobile: userObj.mobile,
    profileImage: userObj.profileImage,
    specialization: profileObj?.specialization || profileObj?.practiceAreas?.[0] || '',
    experienceYears: profileObj?.experience,
    // Only a real rating from the lawyer's profile; never a placeholder.
    rating: typeof profileObj?.rating === 'number' ? profileObj.rating : null,
    totalReviews: typeof profileObj?.totalReviews === 'number' ? profileObj.totalReviews : 0,
  };
};
