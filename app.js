/**
 * cPanel Passenger Entry Point — Next.js Frontend
 * =================================================
 * cPanel "Setup Node.js App" uses Phusion Passenger.
 * Set this file as the "Application startup file" in cPanel.
 *
 * Before first run on cPanel:
 *   1. npm install
 *   2. npm run build
 *   3. Restart the app from cPanel
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Next.js ready on port ${port}`);
  });
});
