// A single-process Next dev server makes test shutdown reliable on Windows.
const http = require('node:http');
const next = require('next');
const port = Number(process.env.NOCODE_TEST_PORT);
if (!process.env.NOCODE_TEST_DB || !process.env.NOCODE_DB_PATH?.includes('integration-')) throw new Error('Test database is required');
const app = next({ dev: true, hostname: '127.0.0.1', port });
app.prepare().then(() => { http.createServer(app.getRequestHandler()).listen(port, '127.0.0.1'); });
