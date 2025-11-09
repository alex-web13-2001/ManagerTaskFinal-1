const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const getAuthToken = (): string | null => {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
};

export const setAuthToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('access_token', token);
  else localStorage.removeItem('access_token');
};

export const authAPI = {
  signUp: async (email: string, password: string, name?: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) throw await res.json();
    const data = await res.json();
    if (data.accessToken) setAuthToken(data.accessToken);
    return data;
  },

  signIn: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw await res.json();
    const data = await res.json();
    if (data.accessToken) setAuthToken(data.accessToken);
    return data;
  },

  signOut: async () => {
    setAuthToken(null);
  },

  getProfile: async () => {
    const token = getAuthToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  },
};
