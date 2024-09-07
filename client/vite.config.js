/** @type {import('vite').UserConfig} */
import { defineConfig } from 'vite'
import postcssUrl from 'postcss-url';
import { resolve } from 'path'
import fs from 'fs'

const staticDir = resolve(__dirname);
const alias = {
  '@scripts': resolve(__dirname, 'scripts'),
  '@styles': resolve(__dirname, 'styles'),
};

export default defineConfig({
  root: 'pages',
  publicDir: '../public',
  resolve: {
    alias,
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        sector: '/sector.html',
        staff: '/staff.html',
        salary: '/salary.html',
        'schedule/sector': '/schedule-sector.html',
        'schedule/staff': '/schedule-staff.html',
      },
      output: {
        dir: resolve(staticDir, 'dist'),
      },
    },
  },
  css: (process.env.NODE_ENV === 'production' ? {
    postcss: {
      plugins: [
        postcssUrl({
          url: (asset) => {
            // fucking hell this took way too long to figure out
            if (asset.url.endsWith('material-symbols-outlined.woff2')) {
              return 'https://cdn.jsdelivr.net/npm/material-symbols@0.2.3/material-symbols-outlined.woff2';
            }
            return asset.url;
          },
        }),
      ],
    },
  } : undefined),
  appType: 'mpa',
  plugins: [
    {
      name: 'custom-routing',
      configurePreviewServer(server) {
        const routes = {
          '/sector': '/sector.html',
          '/staff': '/staff.html',
          '/salary': '/salary.html',
          '/schedule/sector': '/schedule-sector.html',
          '/schedule/staff': '/schedule-staff.html',
        };
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(301, {Location: '/sector'});
            res.end();
            return;
          }
          if (req.url in routes) {
            req.url = routes[req.url]
          }
          next();
        });
      },
      configureServer(server) {
        const routes = {
          '/sector': '/sector',
          '/staff': '/staff',
          '/salary': '/salary',
          '/schedule/sector': '/schedule-sector',
          '/schedule/staff': '/schedule-staff',
        };
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(301, {Location: '/sector'});
            res.end();
            return;
          }

          if (req.url in routes) {
            req.url = routes[req.url]
          }
          else if (req.url.split('/').some((dir) => (dir in alias))) {
            const paths = req.url.split('/');
            const index = paths.findIndex((dir) => (dir in alias));
            req.url = paths.slice(index).with(0, alias[paths[index]]).join('/');
          }
          else if (!/^@/.test(req.url.slice(1))) {
            const filePath = resolve(__dirname, req.url.slice(1));
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              req.url = filePath;
            } else {
              res.writeHead(404);
              res.end();
              return;
            }
          }
          next();
        });
      },
    },
  ],
})