const API_BASE = 'http://localhost:5000/api';

// Retrieve stored JWT token
export function getToken(): string | null {
  return localStorage.getItem('token');
}

// Store JWT token
export function setToken(token: string) {
  localStorage.setItem('token', token);
}

// Remove JWT token
export function removeToken() {
  localStorage.removeItem('token');
}

// Unified API caller
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Check if current user is Admin
export function decodeUserFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload; // { id, username, email, accountTier, groupArea }
  } catch (e) {
    return null;
  }
}
