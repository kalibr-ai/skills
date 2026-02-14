const MiniSearch = require('minisearch');

const options = {
  fields: ['title', 'content', 'domain'],
  storeFields: ['url', 'domain', 'crawled_at', 'depth', 'excerpt'],
  searchOptions: {
    combine: true,
    fields: {
      title: { boost: 2 },
      content: { boost: 1 },
      domain: { boost: 0.5 }
    },
    prefix: 1
  },
  idField: 'url'
};

try {
  const mini = new MiniSearch(options);
  console.log('SUCCESS');
} catch (e) {
  console.error('ERROR:', e);
}
