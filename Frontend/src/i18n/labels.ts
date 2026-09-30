import i18n from './index';
import { getLegalCategories } from '../services/legalCategories';

// Display text for values that are also DATA: category titles, case statuses,
// progress steps, request statuses... They stay in English in the code and in
// API requests (the backend compares them), and are translated only when
// shown. Unknown values (e.g. a new status from the server) are shown as-is.

export const labelKey = (value: string): string =>
  String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const translateOr = (key: string, fallback: string): string =>
  // Dynamic keys cannot be type-checked; i18n.exists guards them instead.
  i18n.exists(key) ? String(i18n.t(key as never)) : fallback;

// A label group within a namespace, e.g. displayLabel('cases:status', 'In Progress').
export const displayLabel = (group: string, value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  return translateOr(`${group}.${labelKey(value)}`, value);
};

// "Family & Divorce" (or its id) -> the category name in the current language.
export const categoryLabel = (titleOrId: string | null | undefined): string => {
  if (!titleOrId) {
    return '';
  }
  const id = getLegalCategories().find(category => category.title === titleOrId)?.id ?? titleOrId;
  return translateOr(`categories:items.${id}.title`, titleOrId);
};

// "Child Custody" -> the sub-type in the current language.
export const subTypeLabel = (subType: string | null | undefined): string =>
  displayLabel('categories:subTypes', subType);

// A lawyer's practice area / specialization: a category name, a sub-type, or
// a common area like "General Practice". Free text the lawyer typed is shown
// as written.
export const practiceAreaLabel = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  const asCategory = categoryLabel(value);
  if (asCategory !== value) {
    return asCategory;
  }
  const asSubType = subTypeLabel(value);
  if (asSubType !== value) {
    return asSubType;
  }
  return displayLabel('categories:practiceAreas', value);
};
