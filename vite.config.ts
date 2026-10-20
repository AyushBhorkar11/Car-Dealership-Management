import { defineConfig, loadEnv } from 'vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import path from 'path';

// Standard TanStack Start + Vite Configuration for CDMS
export default defineConfig(({ command, mode }) => {
  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@tanstack/react-query',
        '@tanstack/query-core',
      ],
    },
    plugins: [
      tanstackStart({
        server: { entry: 'server' },
      }),
      viteReact(),
      tailwindcss(),
      tsconfigPaths(),
      command === 'build' &&
        nitro({
          preset: 'cloudflare-module',
          output: {
            dir: 'dist',
            serverDir: 'dist/server',
            publicDir: 'dist/client',
          },
          cloudflare: {
            nodeCompat: true,
            deployConfig: true,
          },
        }),
    ].filter(Boolean),
    server: {
      host: '::',
      port: 8080,
    },
  };
});
