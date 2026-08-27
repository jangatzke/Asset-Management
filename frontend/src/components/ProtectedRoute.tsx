import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

/**
 * Route guard that redirects unauthenticated users to the login page,
 * preserving the intended destination in the `next` query parameter.
 *
 * Lives in its own file (exporting a single component) so that `App.tsx`
 * only exports components, which keeps React Fast Refresh working.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location, next: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
}
