// Single rule for "is this lawyer verified?", used everywhere the verified
// badge is shown for a lawyer. Admin approval sets both the lawyer profile's
// `verificationStatus` and the user's `isVerified`, so either one counts.
export const isLawyerVerified = (
  profile?: {
    verificationStatus?: string | null;
    user?: { isVerified?: boolean | null } | null;
  } | null,
): boolean =>
  profile?.verificationStatus === 'verified' || Boolean(profile?.user?.isVerified);
