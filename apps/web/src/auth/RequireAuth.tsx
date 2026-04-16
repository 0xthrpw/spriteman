import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from './useAuth.js';

export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <div className="page">Loading…</div>;
  if (!me.data) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
