import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    watch: {
      ignored: ['**/.shots/**'],
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
