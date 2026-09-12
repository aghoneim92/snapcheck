import { fontHref } from '@snapcheck/tokens';
import type { Decorator, Preview } from '@storybook/react-vite';

import { ThemeProvider } from '../src/theme/ThemeProvider';

import '../src/styles.css';

// Manrope and Martian Mono are loaded from Google Fonts rather than bundled, so
// the preview iframe needs them injected once.
if (typeof document !== 'undefined' && !document.querySelector('link[data-snapcheck-fonts]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontHref;
  link.dataset.snapcheckFonts = 'true';
  document.head.append(link);
}

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === 'dark' ? 'dark' : 'light';

  return (
    <ThemeProvider defaultTheme={theme} persist={false}>
      <div className="bg-paper p-6">
        <Story />
      </div>
    </ThemeProvider>
  );
};

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    options: {
      storySort: {
        order: ['Foundations', 'Controls', 'Forms', 'Content', 'Layout', 'Design system'],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Snapcheck Core theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [withTheme],
};

export default preview;
