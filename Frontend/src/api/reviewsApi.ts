import { apiClient, unwrap } from './apiClient';
import type { ApiSuccess } from '../types/api';
import type { LawyerReview } from '../types/domain';

// Mirrors the backend review routes exactly:
//   POST   /reviews            { lawyerId, rating, review }  (client, one per advocate,
//                                                             only after a case/appointment)
//   GET    /reviews?lawyerId=  advocate's public reviews; without lawyerId a lawyer gets
//                              their own, a client gets the ones they wrote
//   PUT    /reviews/:id/reply  { reply }  (the reviewed advocate only)
//   POST   /reviews/:id/report (any signed-in user; flags for admin moderation)
export const reviewsApi = {
  async listForLawyer(lawyerId: string): Promise<LawyerReview[]> {
    const response = await apiClient.get<ApiSuccess<LawyerReview[]>>('/reviews', {
      params: { lawyerId },
    });
    return unwrap(response) ?? [];
  },

  async listMine(): Promise<LawyerReview[]> {
    const response = await apiClient.get<ApiSuccess<LawyerReview[]>>('/reviews');
    return unwrap(response) ?? [];
  },

  async create(input: {
    lawyerId: string;
    rating: number;
    review: string;
  }): Promise<LawyerReview> {
    const response = await apiClient.post<ApiSuccess<LawyerReview>>('/reviews', input);
    return unwrap(response);
  },

  async reply(reviewId: string, reply: string): Promise<LawyerReview> {
    const response = await apiClient.put<ApiSuccess<LawyerReview>>(
      `/reviews/${encodeURIComponent(reviewId)}/reply`,
      { reply },
    );
    return unwrap(response);
  },

  async report(reviewId: string): Promise<void> {
    await apiClient.post<ApiSuccess<LawyerReview>>(
      `/reviews/${encodeURIComponent(reviewId)}/report`,
    );
  },
};
