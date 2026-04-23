// SPDX-License-Identifier: AGPL-3.0-or-later
import './index.css';

// Apply theme before first paint to avoid flash
(function () {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored === 'dark' || (stored !== 'light' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
})();

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './routes/LoginPage.js';
import { BrowsePage } from './routes/BrowsePage.js';
import { RequireAuth } from './components/RequireAuth.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/browse"
            element={
              <RequireAuth>
                <BrowsePage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/browse" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
