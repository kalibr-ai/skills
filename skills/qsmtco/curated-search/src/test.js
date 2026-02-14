/**
 * Quick test script for Curated Search API
 *
 * Usage:
 *   npm test
 */

const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');

async function test() {
  console.log('=== Curated Search API Test ===\n');

  // Load config
  const configPath = path.resolve(__dirname, '..', 'config.yaml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

  // Check if API is reachable
  let reachable = false;
  let method = '';

  if (config.api.unix_socket && fs.existsSync(config.api.unix_socket)) {
    method = 'unix socket';
    reachable = await testUnixSocket(config.api.unix_socket);
  } else if (config.api.port) {
    method = 'tcp';
    reachable = await testTcp('127.0.0.1', config.api.port);
  }

  if (!reachable) {
    console.error('❌ API not reachable. Is the server running?');
    process.exit(1);
  }

  console.log(`✅ API reachable via ${method}`);
  console.log('\nRun the crawler with: npm run crawl');
  console.log('Then query: curl --unix-socket /tmp/curated-search.sock "http://localhost/search?q=python"');
  console.log('\n=== Test complete ===');
}

function testUnixSocket(socketPath) {
  return new Promise((resolve) => {
    const socket = net.createConnection(socketPath, () => {
      socket.end('GET /status HTTP/1.1\r\n\r\n');
      socket.on('data', (data) => {
        resolve(data.toString().includes('200 OK'));
        socket.end();
      });
      socket.on('error', () => resolve(false));
    });
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function testTcp(host, port) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: '/status' }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve(res.statusCode === 200);
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

test().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
