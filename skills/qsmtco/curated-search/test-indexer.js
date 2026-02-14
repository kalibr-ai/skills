#!/usr/bin/env node
/**
 * Quick test of the indexer functionality
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const Indexer = require('./src/indexer');

// Load config
const configPath = path.resolve(__dirname, 'config.yaml');
const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));

const indexer = new Indexer(config.index);
indexer.open();

console.log('Initial stats:', indexer.getStats());

// Add test documents
console.log('\nAdding test documents...');
const testDocs = [
  {
    url: 'https://docs.python.org/3/tutorial/',
    title: 'Python Tutorial',
    content: 'Python is an easy to learn, powerful programming language. It has efficient high-level data structures and a simple but effective approach to object-oriented programming.',
    domain: 'docs.python.org',
    depth: 1
  },
  {
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    title: 'JavaScript - MDN',
    content: 'JavaScript is a programming language that allows you to implement complex features on web pages. Every time a web page does more than just sit there and display static information.',
    domain: 'developer.mozilla.org',
    depth: 1
  },
  {
    url: 'https://nodejs.org/api/fs.html',
    title: 'File System | Node.js',
    content: 'The fs module provides an API for interacting with the file system in a manner closely modeled around standard POSIX functions.',
    domain: 'nodejs.org',
    depth: 2
  }
];

const added = indexer.addDocuments(testDocs);
console.log(`Added ${added} documents`);

// Save
indexer.save();

console.log('\nStats after adding:', indexer.getStats());
console.log('Domains:', indexer.getDomains());

// Test search
console.log('\n--- Search Tests ---');

console.log('\nSearch for "python":');
let results = indexer.search('python', { limit: 5 });
console.log(`  Total: ${results.total}`);
results.results.forEach(r => console.log(`  - ${r.title} (${r.domain}) score: ${r.score}`));

console.log('\nSearch for "javascript":');
results = indexer.search('javascript', { limit: 5 });
console.log(`  Total: ${results.total}`);
results.results.forEach(r => console.log(`  - ${r.title} (${r.domain}) score: ${r.score}`));

console.log('\nSearch with domain filter (nodejs.org only):');
results = indexer.search('file system', { domainFilter: 'nodejs.org' });
console.log(`  Total: ${results.total}`);
results.results.forEach(r => console.log(`  - ${r.title} (${r.domain})`));

console.log('\n--- Testing removeByUrl ---');
const removed = indexer.removeByUrl('https://nodejs.org/api/fs.html');
console.log(`Removed: ${removed}`);
console.log('Stats after removal:', indexer.getStats());

// Save again
indexer.save();

console.log('\nTest complete!');
indexer.close();
