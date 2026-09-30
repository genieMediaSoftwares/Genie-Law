import { apiClient, unwrap } from './apiClient';
import type { ApiSuccess } from '../types/api';
import type {
  FavoriteEntry,
  LawyerProfile,
  RecommendedLawyer,
} from '../types/domain';

export const EXPERIENCE_BUCKETS = ['0-2', '3-5', '5-10', '10+'] as const;
export type ExperienceBucket = (typeof EXPERIENCE_BUCKETS)[number];

export const SORT_OPTIONS = [
  'Highest Rated',
  'Most Reviewed',
  'Name (A - Z)',
  'Name (Z - A)',
  'Newest First',
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface AdvocateFilters {
  search?: string;
  specialization?: string;
  location?: string;
  experience?: ExperienceBucket;
  minFee?: number;
  maxFee?: number;
  rating?: string;
  language?: string | string[];
  verifiedOnly?: boolean;
  availableNow?: boolean;
  sortBy?: SortOption;
}

const toQuery = (filters: AdvocateFilters): Record<string, string | string[]> => {
  const params: Record<string, string | string[]> = {};

  if (filters.search?.trim()) {
    params.search = filters.search.trim();
  }
  if (filters.specialization) {
    params.specialization = filters.specialization;
  }
  if (filters.location) {
    params.location = filters.location;
  }
  if (filters.experience) {
    params.experience = filters.experience;
  }
  if (typeof filters.minFee === 'number') {
    params.minFee = String(filters.minFee);
  }
  if (typeof filters.maxFee === 'number') {
    params.maxFee = String(filters.maxFee);
  }
  if (filters.rating) {
    params.rating = filters.rating;
  }
  if (filters.language) {
    params.language = filters.language;
  }
  if (filters.verifiedOnly) {
    params.verifiedOnly = 'true';
  }
  if (filters.availableNow) {
    params.availableNow = 'true';
  }
  if (filters.sortBy) {
    params.sortBy = filters.sortBy;
  }

  return params;
};

export const advocatesApi = {
  async list(filters: AdvocateFilters = {}): Promise<LawyerProfile[]> {
    const response = await apiClient.get<ApiSuccess<LawyerProfile[]>>(
      '/lawyers',
      { params: toQuery(filters) },
    );
    return unwrap(response) ?? [];
  },

  async getById(userId: string): Promise<LawyerProfile> {
    const response = await apiClient.get<ApiSuccess<LawyerProfile>>(
      `/lawyers/${encodeURIComponent(userId)}`,
    );
    return unwrap(response);
  },

  async recommend(
    params: Record<string, string> = {},
  ): Promise<RecommendedLawyer[]> {
    const response = await apiClient.get<ApiSuccess<RecommendedLawyer[]>>(
      '/lawyers/recommend',
      { params },
    );
    return unwrap(response) ?? [];
  },
};

export const favoritesApi = {
  async list(): Promise<FavoriteEntry[]> {
    const response = await apiClient.get<ApiSuccess<FavoriteEntry[]>>(
      '/favorites',
    );
    return unwrap(response) ?? [];
  },

  async toggle(lawyerUserId: string): Promise<{ isFavorite: boolean }> {
    const response = await apiClient.post<
      ApiSuccess<{ isFavorite: boolean }>
    >('/favorites', { lawyerId: lawyerUserId });
    return unwrap(response);
  },

  async remove(favoriteId: string): Promise<void> {
    await apiClient.delete<ApiSuccess<null>>(
      `/favorites/${encodeURIComponent(favoriteId)}`,
    );
  },
};
