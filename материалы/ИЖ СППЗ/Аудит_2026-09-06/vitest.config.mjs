export default {
  root: new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1').split('/').map(decodeURIComponent).join('/'),
  resolve: { alias: {
    'vitest': 'C:/Users/Svyt0/Projects/izh-sppz/node_modules/vitest/dist/index.js',
    '@izh/contracts': 'C:/Users/Svyt0/Projects/izh-sppz/packages/contracts/src/index.ts'
  } },
  test: { include: ['audit-reproductions.test.ts'], pool: 'forks', maxWorkers: 1, minWorkers: 1 }
};
