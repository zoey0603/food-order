import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import { OrderProvider } from './state/OrderContext';
import '../css/style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing React root.');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <OrderProvider>
        <App />
      </OrderProvider>
    </HashRouter>
  </StrictMode>,
);
