/**
 * DEPRECATED: This file is no longer needed with self-hosted architecture
 * 
 * Previously contained Supabase project credentials.
 * Now the application uses self-hosted backend with JWT authentication.
 * 
 * These exports are kept as empty strings for backward compatibility.
 * Any code importing these values should be updated to use the new API client.
 */

console.warn(
  '⚠️ DEPRECATION WARNING: supabase/info.tsx is deprecated. ' +
  'The application now uses self-hosted infrastructure. ' +
  'Update your code to remove references to projectId and publicAnonKey.'
);

// Export empty strings for backward compatibility
export const projectId = "";
export const publicAnonKey = "";