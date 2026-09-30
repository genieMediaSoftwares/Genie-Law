import type { PickedFile } from '../types/ai';

// Hands the documents chosen in the AI Smart Case Assistant to the Post Case
// flow that continues its session. They stay on the device (in memory only)
// until "Submit Case" uploads them; if the flow is abandoned they are simply
// dropped. Navigation params are not used because files are not serializable.

const draftFiles = new Map<string, PickedFile[]>();

export const caseDraftFiles = {
  stash(sessionId: string, files: PickedFile[]): void {
    draftFiles.set(sessionId, files);
  },

  // Returns and forgets the files stashed for a session.
  take(sessionId: string | null | undefined): PickedFile[] {
    if (!sessionId) {
      return [];
    }
    const files = draftFiles.get(sessionId) ?? [];
    draftFiles.delete(sessionId);
    return files;
  },

  // Sign-out: one user's drafts never carry over to the next.
  clear(): void {
    draftFiles.clear();
  },
};
