import { DesignSystemShowcase, ThemeProvider } from '@snapcheck/core-components';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <DesignSystemShowcase />
    </ThemeProvider>
  </StrictMode>,
);
