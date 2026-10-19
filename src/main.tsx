import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import './index.css';
import App from './App';
import { StoreProvider } from './store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <App />
      </StoreProvider>
    </MotionConfig>
  </StrictMode>,
);
