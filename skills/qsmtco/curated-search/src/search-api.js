/**
 * Curated Search API
 *
 * HTTP server with Unix socket support.
 * Provides search endpoint backed by SQLite FTS5 index.
 *
 * Endpoints:
 *   GET /search?q=<query>&limit=<n>&offset=<n>
 *   GET /status
 *   GET /stats
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const Indexer = require('./indexer');
const yaml = require('yaml');
const fsp = require('fs').promises;

class SearchAPI {
  constructor() {
    this.configPath = path.resolve(__dirname, '..', 'config.yaml');
    this.config = null;
    this.indexer = null;
    this.server = null;
    this.unixServer = null;
    this.logger = this.createLogger();
  }

  createLogger() {
    return (msg, level = 'info') => {
      const time = new Date().toISOString();
      console.log(`[${time}] [${level.toUpperCase()}] ${msg}`);
    };
  }

  async loadConfig() {
    try {
      const yamlStr = await fsp.readFile(this.configPath, 'utf8');
      this.config = yaml.parse(yamlStr);
      this.logger(`Configuration loaded from ${this.configPath}`, 'info');
    } catch (e) {
      console.error('Failed to load config.yaml:', e);
      process.exit(1);
    }
  }

  async initIndexer() {
    this.indexer = new Indexer(this.config.index);
    this.indexer.open();
    const stats = this.indexer.stats();
    this.logger(`Indexer ready — ${stats.documents} documents, ${stats.domains} domains`, 'info');
  }

  /**
   * Handle search request
   */
  handleSearch(req, res) {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const query = params.get('q')?.trim();
    const limit = Math.min(parseInt(params.get('limit')) || 10, 100);
    const offset = parseInt(params.get('offset')) || 0;
    const domain = params.get('domain');

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query parameter: q' }));
      return;
    }

    try {
      const result = this.indexer.search(query, { limit, offset, domainFilter: domain });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        query,
        total: result.total,
        limit,
        offset,
        results: result.results.map(r => ({
          title: r.title,
          url: r.url,
          domain: r.domain,
          score: -r.score, // BM25 lower is better; negate for ascending
          crawled_at: r.crawled_at
        }))
      }));
    } catch (e) {
      this.logger(`Search error: ${e.message}`, 'error');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Search failed' }));
    }
  }

  /**
   * Handle status request
   */
  handleStatus(req, res) {
    const stats = this.indexer ? this.indexer.stats() : null;
    const uptime = process.uptime();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime,
      config: {
        domains: this.config.domains.length,
        max_documents: this.config.index.max_documents
      },
      index: stats
    }));
  }

  /**
   * HTTP request router
   */
  handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // CORS headers if enabled
    if (this.config.api.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
    }

    if (url.pathname === '/search' && req.method === 'GET') {
      return this.handleSearch(req, res);
    }

    if (url.pathname === '/status' && req.method === 'GET') {
      return this.handleStatus(req, res);
    }

    if (url.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Curated Search API\n\nEndpoints:\n  GET /search?q=<query>\n  GET /status\n');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Start TCP HTTP server
   */
  startHttpServer() {
    if (!this.config.api.port) return;

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(this.config.api.port, this.config.api.host, () => {
      this.logger(`HTTP server listening on ${this.config.api.host}:${this.config.api.port}`, 'info');
    });

    this.server.on('error', (err) => {
      this.logger(`HTTP server error: ${err.message}`, 'error');
    });
  }

  /**
   * Start Unix domain socket server
   */
  startUnixSocketServer() {
    if (!this.config.api.unix_socket) return;

    // Ensure socket path is writable
    const socketPath = this.config.api.unix_socket;

    this.unixServer = net.createServer((connection) => {
      const reqBuffer = [];
      connection.on('data', (chunk) => reqBuffer.push(chunk));
      connection.on('end', async () => {
        try {
          const reqStr = Buffer.concat(reqBuffer).toString('utf8');
          const [reqLine, headerLines] = reqStr.split('\r\n');
          const [method, rawUrl] = reqLine.split(' ');
          const url = new URL(rawUrl, 'http://localhost');

          // Build minimal request object
          const req = { method, url, headers: {} };
          const res = {
            writeHead: (code, headers) => {
              connection.write(`HTTP/1.1 ${code}\r\n`);
              for (const [k, v] of Object.entries(headers)) {
                connection.write(`${k}: ${v}\r\n`);
              }
              connection.write('\r\n');
            },
            end: (body) => {
              if (body) connection.write(body);
              connection.end();
            }
          };

          await this.handleRequest(req, res);
        } catch (e) {
          this.logger(`Socket request error: ${e.message}`, 'error');
          connection.write('HTTP/1.1 500\r\n\r\n');
          connection.end();
        }
      });
    });

    // Remove old socket if exists
    try { fs.unlinkSync(socketPath); } catch (e) { /* ignore */ }

    this.unixServer.listen(socketPath, () => {
      this.logger(`Unix socket server listening on ${socketPath}`, 'info');
    });

    this.unixServer.on('error', (err) => {
      this.logger(`Unix socket error: ${err.message}`, 'error');
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger('Shutting down...', 'info');
    if (this.server) this.server.close();
    if (this.unixServer) this.unixServer.close();
    if (this.indexer) this.indexer.close();
    process.exit(0);
  }

  /**
   * Main startup
   */
  async start() {
    await this.loadConfig();
    await this.initIndexer();

    // Start servers
    this.startHttpServer();
    this.startUnixSocketServer();

    // Signal handling
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    this.logger('Curated Search API is ready', 'info');
  }
}

// Standalone entry point
if (require.main === module) {
  const api = new SearchAPI();
  api.start().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}

module.exports = SearchAPI;
