/**
 * DEPRECATED: This file is maintained for backward compatibility
 * New code should import from '../api-client.tsx' instead
 * 
 * This compatibility layer re-exports the new API client to avoid
 * breaking existing imports throughout the codebase.
 */

console.warn(
  '⚠️ DEPRECATION WARNING: Importing from utils/supabase/client.tsx is deprecated. ' +
  'Please update your imports to use utils/api-client.tsx instead.'
);

// Re-export everything from the new API client
export {
  getAuthToken,
  authAPI,
  tasksAPI,
  projectsAPI,
  invitationsAPI,
  teamAPI,
  diagnosticsAPI,
  userSettingsAPI,
  categoriesAPI,
} from '../api-client';

// Export a dummy supabase object for compatibility
// This prevents immediate breakage but logs warnings
export const supabase = {
  auth: {
    getSession: async () => {
      console.warn('⚠️ supabase.auth.getSession() is deprecated');
      return { data: { session: null }, error: null };
    },
    signInWithPassword: async () => {
      console.warn('⚠️ supabase.auth.signInWithPassword() is deprecated, use authAPI.signIn()');
      throw new Error('Use authAPI.signIn() instead');
    },
    signOut: async () => {
      console.warn('⚠️ supabase.auth.signOut() is deprecated, use authAPI.signOut()');
      throw new Error('Use authAPI.signOut() instead');
    },
    onAuthStateChange: () => {
      console.warn('⚠️ supabase.auth.onAuthStateChange() is deprecated, use authAPI.onAuthStateChange()');
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },
    refreshSession: async () => {
      console.warn('⚠️ supabase.auth.refreshSession() is deprecated');
      return { data: { session: null }, error: null };
    },
  },
};


