import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    // 'react-docgen-typescript' reads TypeScript compiler-API internals that
    // TypeScript 7 no longer exposes; the Babel-based docgen works today and
    // still picks up our JSDoc on props.
    reactDocgen: 'react-docgen',
  },
};

export default config;
