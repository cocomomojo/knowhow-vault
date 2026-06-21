import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'knowhow-vault';
const base = process.env.GITHUB_ACTIONS ? `/${repoName}/` : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
