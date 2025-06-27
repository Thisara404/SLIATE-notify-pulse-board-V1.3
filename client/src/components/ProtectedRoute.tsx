import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRoles = [], 
  requiredPermissions = [],
  redirectTo = '/login' 
}) => {
  const { isAuthenticated, isLoading, hasRole, hasPermission, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-sliate-accent" />
          <p className="text-sliate-accent">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requiredRoles.length > 0 && !hasRole(requiredRoles)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-2">You don't have permission to access this page.</p>
          <p className="text-sm text-gray-500">
            Required roles: {requiredRoles.join(', ')} | Your role: {user?.role}
          </p>
        </div>
      </div>
    );
  }

  // Check permission requirements
  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => hasPermission(permission));
    
    if (!hasAllPermissions) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Insufficient Permissions</h2>
            <p className="text-gray-600 mb-2">You don't have the required permissions for this action.</p>
            <p className="text-sm text-gray-500">
              Required permissions: {requiredPermissions.join(', ')}
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;