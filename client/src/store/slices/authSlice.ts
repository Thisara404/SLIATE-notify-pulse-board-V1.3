import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiService, LoginCredentials, AuthResponse } from '@/services/api';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'super_admin'; // Remove 'lecturer'
  full_name: string; // Match backend field name
  email?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  lastLoginTime: string | null;
  sessionExpiry: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  lastLoginTime: null,
  sessionExpiry: null,
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await apiService.login(credentials);
      
      // Store token in localStorage
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('auth_user', JSON.stringify(response.data.user));
      localStorage.setItem('auth_session_expiry', response.data.session.expiresAt);
      
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return rejectWithValue(message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
      await apiService.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear local storage regardless of API response
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_session_expiry');
      
      dispatch(clearAuth());
    }
  }
);

export const checkAuthStatus = createAsyncThunk(
  'auth/checkStatus',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('auth_token');
      const userString = localStorage.getItem('auth_user');
      const sessionExpiry = localStorage.getItem('auth_session_expiry');

      if (!token || !userString) {
        throw new Error('No authentication data found');
      }

      // Check if session is expired
      if (sessionExpiry && new Date(sessionExpiry) < new Date()) {
        throw new Error('Session expired');
      }

      // Verify token with backend
      const response = await apiService.getProfile();
      
      return {
        token,
        user: response.data.user,
        session: response.data.session,
      };
    } catch (error) {
      // Clear invalid data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_session_expiry');
      
      const message = error instanceof Error ? error.message : 'Authentication check failed';
      return rejectWithValue(message);
    }
  }
);

export const refreshAuthToken = createAsyncThunk(
  'auth/refresh',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.refreshToken();
      
      // Update stored token
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('auth_session_expiry', response.data.session.expiresAt);
      
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      return rejectWithValue(message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.lastLoginTime = null;
      state.sessionExpiry = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.sessionExpiry = action.payload.session.expiresAt;
        state.lastLoginTime = new Date().toISOString();
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload as string;
      })
      
      // Logout cases
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
      })
      
      // Check auth status cases
      .addCase(checkAuthStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.sessionExpiry = action.payload.session?.expiresAt || null;
        state.error = null;
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload as string;
      })
      
      // Refresh token cases
      .addCase(refreshAuthToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshAuthToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.sessionExpiry = action.payload.session.expiresAt;
        state.error = null;
      })
      .addCase(refreshAuthToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // Don't clear auth state on refresh failure, let user try again
      });
  },
});

export const { clearAuth, clearError, setLoading } = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;

// Role-based selectors
export const selectUserRole = (state: { auth: AuthState }) => state.auth.user?.role;
export const selectIsAdmin = (state: { auth: AuthState }) => 
  state.auth.user?.role === 'admin' || state.auth.user?.role === 'super_admin';
export const selectIsSuperAdmin = (state: { auth: AuthState }) => 
  state.auth.user?.role === 'super_admin';
export const selectIsLecturer = (state: { auth: AuthState }) => 
  state.auth.user?.role === 'lecturer';

export default authSlice.reducer;