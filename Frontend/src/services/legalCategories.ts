import { fetchLegalCategories } from '../api/categoriesApi';

// The legal case categories and their sub-types come from the backend
// (GET /categories/legal), the same list it validates cases against. App.tsx
// loads them once at startup, before any screen is drawn, so the lookups below
// can be used anywhere without waiting.

export interface LegalCategory {
  id: string;
  title: string;
  slug: string;
  subTypes: readonly string[];
}

// Home screen presentation: the categories shown first, in this order.
// Ids not present in the backend's list are skipped.
const POPULAR_CATEGORY_IDS: readonly string[] = [
  'civil_cases',
  'criminal_law',
  'family_divorce',
  'property_land',
  'cyber_crime',
  'gst_taxation',
  'employment_labour',
  'consumer_complaints',
];

let loaded: readonly LegalCategory[] | null = null;

export const loadLegalCategories = async (): Promise<void> => {
  loaded = await fetchLegalCategories();
};

export const getLegalCategories = (): readonly LegalCategory[] => {
  if (!loaded) {
    throw new Error('Legal categories are not loaded yet (App.tsx loads them at startup).');
  }
  return loaded;
};

export const popularCategories = (): LegalCategory[] =>
  POPULAR_CATEGORY_IDS.map(id => getLegalCategories().find(c => c.id === id)).filter(
    (c): c is LegalCategory => Boolean(c),
  );

export const categoryByTitle = (title: string): LegalCategory | undefined =>
  getLegalCategories().find(c => c.title.toLowerCase() === String(title || '').toLowerCase());

export const categoryById = (id: string): LegalCategory | undefined =>
  getLegalCategories().find(c => c.id === id);

export const orderedCategories = (): LegalCategory[] => {
  const popular = popularCategories();
  const rest = getLegalCategories().filter(c => !POPULAR_CATEGORY_IDS.includes(c.id));
  return [...popular, ...rest];
};
