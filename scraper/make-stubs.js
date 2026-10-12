const fs = require('fs');
const path = require('path');
const idx = JSON.parse(fs.readFileSync('vk-docs-mcp/data/vk-bridge-index.json','utf8').replace(/^\uFEFF/,''));
const out = 'vk-docs-mcp/data/vk-bridge';
if (!fs.existsSync(out)) fs.mkdirSync(out, {recursive:true});
const items = idx.flat.slice(0, 10);
items.forEach(it => {
  const file = path.join(out, it.id + '.json');
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
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
});
console.log('done', items.length);
