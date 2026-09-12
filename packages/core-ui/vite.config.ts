import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Serves the spec sheet (`pnpm dev`) and is picked up by Storybook. There is no
// build: consumers import this package's TypeScript source directly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
