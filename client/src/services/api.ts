const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: number;
      username: string;
      role: 'admin' | 'super_admin'; // Remove 'lecturer' since it's not in your DB
      full_name: string; // Backend uses 'full_name', not 'fullName'
      email?: string;
    };
    session: {
      id: string;
      expiresAt: string;
    };
  };
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  timestamp: string;
}

class ApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  }

  async logout(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      console.warn('Logout request failed, but continuing with local cleanup');
    }
  }

  async getProfile(): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch profile');
    }

    return data;
  }

  async refreshToken(): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Token refresh failed');
    }

    return data;
  }
}

export const apiService = new ApiService();