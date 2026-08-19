import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@xyflow/react/dist/style.css';
import './index.css';
import App from './App';
import { IdentityProvider } from './features/identity/IdentityContext';
import { AnnouncementProvider } from './features/announcements/AnnouncementProvider';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <AnnouncementProvider>
          <App />
        </AnnouncementProvider>
      </IdentityProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
