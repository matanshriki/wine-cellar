const API_BASE = '/api';

interface APIError {
  error: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Request failed',
    }));
    throw new Error(error.error);
  }
  return response.json();
}

export const api = {
  // Auth
  async register(email: string, password: string, name?: string) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });
    return handleResponse<{ user: any; token: string }>(response);
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ user: any; token: string }>(response);
  },

  async logout() {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async getMe() {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    return handleResponse<{ user: any }>(response);
  },

  // Bottles
  async getBottles() {
    const response = await fetch(`${API_BASE}/bottles`, {
      credentials: 'include',
    });
    return handleResponse<{ bottles: any[] }>(response);
  },

  async getBottle(id: string) {
    const response = await fetch(`${API_BASE}/bottles/${id}`, {
      credentials: 'include',
    });
    return handleResponse<{ bottle: any }>(response);
  },

  async createBottle(data: any) {
    const response = await fetch(`${API_BASE}/bottles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<{ bottle: any }>(response);
  },

  async updateBottle(id: string, data: any) {
    const response = await fetch(`${API_BASE}/bottles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<{ bottle: any }>(response);
  },

  async deleteBottle(id: string) {
    const response = await fetch(`${API_BASE}/bottles/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  // Analysis
  async analyzeBottle(bottleId: string) {
    const response = await fetch(`${API_BASE}/analysis/bottles/${bottleId}`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ analysis: any }>(response);
  },

  // Recommendations
  async getRecommendations(context: any) {
    const response = await fetch(`${API_BASE}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(context),
    });
    return handleResponse<{ recommendations: any[] }>(response);
  },

  // History
  async getHistory() {
    const response = await fetch(`${API_BASE}/history`, {
      credentials: 'include',
    });
    return handleResponse<{ events: any[] }>(response);
  },

  async createOpenEvent(data: any) {
    const response = await fetch(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<{ event: any }>(response);
  },

  async getStats() {
    const response = await fetch(`${API_BASE}/history/stats`, {
      credentials: 'include',
    });
    return handleResponse<any>(response);
  },

  // Imports
  async previewCSV(csvText: string) {
    const response = await fetch(`${API_BASE}/imports/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ csvText }),
    });
    return handleResponse<{ headers: string[]; rows: string[][] }>(response);
  },

  async importCSV(csvText: string, mapping: any, isVivino?: boolean) {
    const response = await fetch(`${API_BASE}/imports/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ csvText, mapping, isVivino }),
    });
    return handleResponse<{ message: string; count: number }>(response);
  },
};

