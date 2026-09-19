import { defineConfig } from '@snapcheck/capture';

export default defineConfig({
  staticDir: 'packages/core-ui/storybook-static',
  snapshot: {
    viewports: [375, 1280],
    threshold: 0.01,
    pixelThreshold: 0.1,
    minChangedPixels: 250,
  },
  quarantine: [],
  harness: {},
});
