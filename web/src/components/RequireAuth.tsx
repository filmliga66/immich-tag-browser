// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchMe } from '../features/auth/api.js';

interface RequireAuthProps {
  children: JSX.Element;
}

/**
 * Wraps a route and redirects unauthenticated users to /login?redirect=<path>.
 * Relies on fetchMe throwing 'unauthenticated' when the session cookie is missing/invalid.
 */
export function RequireAuth({ children }: RequireAuthProps): JSX.Element {
  const location = useLocation();
  const { isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
  });

  if (isLoading) {
    return <p aria-live="polite">Loading…</p>;
  }

  if (isError) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return children;
}
