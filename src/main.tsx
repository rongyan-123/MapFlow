import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@xyflow/react/dist/style.css';
import './index.css';
import Application from './app/Application';
import { IdentityProvider } from './domains/identity/IdentityContext';

// Excalidraw preloads fonts when its lazy module is evaluated in production.
(window as Window & { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <Application />
      </IdentityProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
