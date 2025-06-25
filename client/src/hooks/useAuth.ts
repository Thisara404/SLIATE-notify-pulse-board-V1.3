import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './redux';
import {
  loginUser,
  logoutUser,
  checkAuthStatus,
  refreshAuthToken,
  clearError,
  selectAuth,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectAuthError,
  selectUserRole,
  selectIsAdmin,
  selectIsSuperAdmin,
  selectIsLecturer
} from '@/store/slices/authSlice';
import type { LoginCredentials } from '@/services/api';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  
  // Selectors
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectAuthError);
  const userRole = useAppSelector(selectUserRole);
  const isAdmin = useAppSelector(selectIsAdmin);
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);
  const isLecturer = useAppSelector(selectIsLecturer);

  // Actions
  const login = async (credentials: LoginCredentials) => {
    return dispatch(loginUser(credentials));
  };

  const logout = async () => {
    return dispatch(logoutUser());
  };

  const checkAuth = async () => {
    return dispatch(checkAuthStatus());
  };

  const refreshToken = async () => {
    return dispatch(refreshAuthToken());
  };

  const clearAuthError = () => {
    dispatch(clearError());
  };

  // Role checking utilities
  const hasRole = (roles: string | string[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    const rolePermissions = {
      'super_admin': ['all'],
      'admin': ['notice_create', 'notice_edit', 'notice_delete', 'notice_approve']
      // Remove lecturer permissions since it doesn't exist in your DB
    };

    const userPermissions = rolePermissions[user.role] || [];
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };

  // Auto-check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token && !isAuthenticated) {
      checkAuth();
    }
  }, []);

  // Auto-refresh token before expiry
  useEffect(() => {
    if (isAuthenticated && auth.sessionExpiry) {
      const expiryTime = new Date(auth.sessionExpiry).getTime();
      const currentTime = new Date().getTime();
      const timeUntilExpiry = expiryTime - currentTime;
      
      // Refresh token 5 minutes before expiry
      const refreshTime = timeUntilExpiry - (5 * 60 * 1000);
      
      if (refreshTime > 0) {
        const timeout = setTimeout(() => {
          refreshToken();
        }, refreshTime);
        
        return () => clearTimeout(timeout);
      }
    }
  }, [isAuthenticated, auth.sessionExpiry]);

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    userRole,
    isAdmin,
    isSuperAdmin,
    isLecturer,
    sessionExpiry: auth.sessionExpiry,
    lastLoginTime: auth.lastLoginTime,

    // Actions
    login,
    logout,
    checkAuth,
    refreshToken,
    clearAuthError,

    // Utilities
    hasRole,
    hasPermission,
  };
};