/** @type {import('vite').UserConfig} */
import { defineConfig } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

const staticDir = resolve(__dirname);

export default defineConfig({
  root: 'pages',
  publicDir: '../public',
  build: {
    rollupOptions: {
      external: ['jquery', 'moment', 'lodash-es'],
      input: {
        sector: '/sector.html',
        staff: '/staff.html',
        salary: '/salary.html',
        'schedule/sector': '/schedule-sector.html',
        'schedule/staff': '/schedule-staff.html',
      },
      output: {
        dir: resolve(staticDir, 'dist'),
        paths: {
          jquery: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
          moment: 'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js',
          'lodash-es': 'https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/lodash.min.js',
        }
      },
    },
  },
  appType: 'mpa',
  plugins: [
    {
      name: 'custom-routing',
      configureServer(server) {
        const routes = {
          '/sector': '/sector',
          '/staff': '/staff',
          '/salary': '/salary',
          '/schedule/sector': '/schedule-sector',
          '/schedule/staff': '/schedule-staff',
        };
        Object.entries(routes).forEach(([k, v]) => {
          routes[`${k}/`] = v;
        });

        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(301, {Location: '/sector'});
            res.end();
            return;
          }

          if (req.url in routes) {
            req.url = routes[req.url]
          } else if (!/^@/.test(req.url.slice(1))) {
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