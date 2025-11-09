// Deprecated supabase client adapter - redirects calls to new API client
import * as api from '../utils/api-client';

console.warn('Deprecated: src/utils/supabase/client.tsx replaced. Use src/utils/api-client.tsx instead.');

export const getAuthToken = api.getAuthToken;
export const authAPI = api.authAPI;
