// Case.status values, as stored in D1 (backend/src/models/index.js).
export const CASE_STATUSES = [
  "Submitted",
  "Awaiting Lawyer Acceptance",
  "Pending Lawyer Response",
  "Interested",
  "Accepted",
  "In Progress",
  "Completed",
  "Closed",
  "Rejected",
] as const;
