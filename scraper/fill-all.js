const fs = require('fs');
const path = require('path');

const idxPath = 'vk-docs-mcp/data/vk-bridge-index.json';
const outDir = 'vk-docs-mcp/data/vk-bridge';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive:true});
const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8').replace(/^\uFEFF/, ''));
console.log('total', idx.flat.length);
idx.flat.forEach(it => {
  const file = path.join(outDir, it.id + '.json');
  const data = {
    id: it.id,
    url: it.url,
    title: it.text,
    h1: it.text,
    group: it.group || '',
    description: '',
    examples: [],
    params: [],
    returns: {description: ''},
    sections: [],
    contentText: ''
  };
  if (!fs.existsSync(file) || fs.statSync(file).size < 100) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }
});
console.log('done');
