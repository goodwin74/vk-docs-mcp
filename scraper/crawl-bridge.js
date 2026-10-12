const fs = require('fs');
const path = require('path');

function readIndex() {
  const p = 'vk-docs-mcp/data/vk-bridge-index.json';
  const s = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(s);
}

module.exports = { readIndex };
