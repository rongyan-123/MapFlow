import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@xyflow/react/dist/style.css';
import './index.css';
import App from './App';
import { IdentityProvider } from './features/identity/IdentityContext';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <App />
      </IdentityProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
