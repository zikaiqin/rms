/** @type {import('vite').UserConfig} */
import { defineConfig } from 'vite'
import { join, resolve } from 'path'
import fsp from 'fs/promises'

const staticDir = resolve(__dirname);
const alias = {
  '@scripts': resolve(__dirname, 'scripts'),
  '@styles': resolve(__dirname, 'styles'),
};
const apiRoot = '/api';

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
        'schedule/sector': '/schedule/sector.html',
        'schedule/staff': '/schedule/staff.html',
        'schedule/planner': '/schedule/planner.html',
      },
      output: {
        dir: resolve(staticDir, 'dist'),
      },
    },
  },
  appType: 'mpa',
  preview: {
    proxy: {
      [apiRoot]: {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${apiRoot}`), ''),
      },
    },
  },
  server: {
    proxy: {
      [apiRoot]: {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${apiRoot}`), ''),
      },
    },
  },
  plugins: [
    {
      name: 'custom-routing',
      apply: 'serve',
      configurePreviewServer(server) {
        const routes = {
          '/sector': '/sector.html',
          '/staff': '/staff.html',
          '/salary': '/salary.html',
          '/schedule/sector': '/schedule/sector.html',
          '/schedule/staff': '/schedule/staff.html',
          '/schedule/planner': '/schedule/planner.html',
        };
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(301, {Location: '/sector'});
            res.end();
            return;
          }
          if (req.url in routes) {
            req.url = routes[req.url];
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
          '/schedule/planner': '/schedule-planner',
        };
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(301, {Location: '/sector'});
            res.end();
            return;
          }
          if (req.url.startsWith(apiRoot)) {
            return next();
          }
          if (req.url in routes) {
            req.url = routes[req.url];
            return next();
          }
          if (req.url.split('/').some((dir) => (dir in alias))) {
            const paths = req.url.split('/');
            const index = paths.findIndex((dir) => (dir in alias));
            req.url = paths.slice(index).with(0, alias[paths[index]]).join('/');
            return next();
          }
          if (!req.url.slice(1).startsWith('@')) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html');
            fsp.readFile(join(staticDir, '/public/404.html')).then((buf) => {
              res.end(buf);
            });
            return;
          }
          next();
        });
      },
    },
    {
      name: 'copy-html-files',
      apply: 'build',
      buildStart: () => {
        const rootDir = join(staticDir, 'pages');
        const targetDir = join(rootDir, 'schedule');
        fsp.mkdir(targetDir, { recursive: true }).then(() => {
          ['sector', 'staff', 'planner'].forEach((target) => {
            const sourcePath = join(rootDir, `schedule-${target}.html`);
            fsp.copyFile(sourcePath, join(targetDir, `${target}.html`));
          });
        });
      },
      buildEnd: () => {
        fsp.rm(join(staticDir, 'pages/schedule'), { recursive: true });
      },
    },
  ],
})