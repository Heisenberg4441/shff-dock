import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DockProvider } from './state/store';
import { UiProvider } from './state/ui';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('нет узла #root — сломан index.html');

createRoot(root).render(
  <StrictMode>
    <DockProvider>
      <UiProvider>
        <App />
      </UiProvider>
    </DockProvider>
  </StrictMode>,
);
