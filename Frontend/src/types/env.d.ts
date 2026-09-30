declare module '@env' {
  export const API_BASE_URL: string | undefined;
  export const API_TIMEOUT_MS: string | undefined;
  export const SUPPORT_EMAIL: string | undefined;
  export const SUPPORT_PHONE: string | undefined;
  export const AI_UPLOAD_MAX_MB: string | undefined;
  export const AI_OPTIMIZE_MAX_MB: string | undefined;
}

declare module '*.png' {
  const content: any;
  export default content;
}

declare module '*.jpg' {
  const content: any;
  export default content;
}

