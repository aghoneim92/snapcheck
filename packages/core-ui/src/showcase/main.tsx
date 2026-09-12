import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ThemeProvider } from '../theme/ThemeProvider';
import { DesignSystemShowcase } from './DesignSystemShowcase';

import '../styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <DesignSystemShowcase />
    </ThemeProvider>
  </StrictMode>,
);
