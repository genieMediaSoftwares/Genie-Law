import { apiClient, unwrap } from './apiClient';
import type { ApiSuccess } from '../types/api';
import type { LegalCategory } from '../services/legalCategories';

// The legal case taxonomy the backend files and validates cases under.
export const fetchLegalCategories = async (): Promise<LegalCategory[]> =>
  unwrap(await apiClient.get<ApiSuccess<LegalCategory[]>>('/categories/legal'));
