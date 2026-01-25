/**
 * Herald Admin API Client
 */
import { getAccessToken } from '../auth/oauth';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  scopes: string[];
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name?: string;
  role: string;
  scopes?: string[];
}

export interface UpdateUserRequest {
  name?: string;
  role?: string;
  scopes?: string[];
  is_active?: boolean;
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw { error: data.error || `Request failed: ${response.status}`, status: response.status };
  }

  return response;
}

export const users = {
  async list(): Promise<{ users: User[] }> {
    const response = await fetchWithAuth('/api/admin/users');
    return response.json();
  },

  async get(id: string): Promise<{ user: User }> {
    const response = await fetchWithAuth(`/api/admin/users/${id}`);
    return response.json();
  },

  async create(data: CreateUserRequest): Promise<{ user: User }> {
    const response = await fetchWithAuth('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async update(id: string, data: UpdateUserRequest): Promise<{ user: User }> {
    const response = await fetchWithAuth(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async delete(id: string): Promise<void> {
    await fetchWithAuth(`/api/admin/users/${id}`, {
      method: 'DELETE',
    });
  },
};
