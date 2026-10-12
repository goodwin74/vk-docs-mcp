// Извлекает структурированные JSON для методов VK Reference
// tools - browser tools, items - список {id, url, section}

async function extractMethod(tools, tabID, item) {
  const script = `(() => {
    const getText = el => el ? (el.textContent||'').trim().replace(/\\s+/g,' ') : '';
    const main = document.querySelector('main') || document.body;
    const title = document.title;
    const h1 = getText(main.querySelector('h1')||document.querySelector('h1'));
    const id = (location.pathname.split('/').pop()||'').toLowerCase();
    const url = location.href;
    const description = getText(main.querySelector('p'));
    const examples = [];
    const pres = [...main.querySelectorAll('pre')];
    pres.forEach(p=>{ const c=p.textContent; if(c&&c.trim()) examples.push({lang:'js',code:c}); });
    const tables=[...document.querySelectorAll('table')];
    const params=[];
    for (let t=0;t<tables.length;t++) {
      const tbl=tables[t];
      const ths=[...tbl.querySelectorAll('th')].map(x=>getText(x).toLowerCase());
      const hasParam = ths.some(x=>x.includes('параметр')||x.includes('name')||x.includes('поле'));
      const hasType = ths.some(x=>x.includes('тип')||x.includes('type'));
      const hasDesc = ths.some(x=>x.includes('описание')||x.includes('description'));
      if (hasParam && (hasType||hasDesc)) {
        const rows=[...tbl.querySelectorAll('tbody tr')];
        for (let r=0;r<rows.length;r++) {
          const tds=[...rows[r].querySelectorAll('td')].map(getText);
          if (tds.length>=2) {
            const nm=tds[0].replace(/\\*/g,'').trim();
            const typ=tds[1]||'';
            const desc=tds.slice(2).join(' ')||'';
            const req=(tds[0].includes('*')||tds[0].toLowerCase().includes('обяз'));
            params.push({name:nm,type:typ,required:req,description:desc});
          }
        }
      }
    }
    const sections=[];
    const heads=[...main.querySelectorAll('h2,h3,h4')];
    for (let i=0;i<heads.length;i++) {
      const h=heads[i];
      const st=getText(h);
      const coll=[];
      let node=h.nextElementSibling;
      while(node && node.tagName && !/^H[2-4]$/.test(node.tagName)) {
        coll.push(getText(node));
        node=node.nextElementSibling;
      }
      sections.push({level:parseInt(h.tagName[1])||2,title:st,text:coll.filter(Boolean).join(' ')});
    }
    return {id, url, title, h1, description, params, examples: examples.slice(0,5), sections, contentText:(description+' '+sections.map(s=>s.title+': '+s.text).join(' ')).replace(/\\s+/g,' ').slice(0,4000), group: (id.split('.')[0])};
  })()`;
  const res = await tools.browser.evaluate({tabID, script});
  return res.value || res;
}

async function extractBatch(tools, items) {
  const tabs = await tools.browser.tabs.list();
  const outDir = 'vk-docs-mcp/data/vk-reference';
  const fs = require('fs');
  const path = require('path');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive:true});
  for (let i=0;i<items.length;i++) {
    const it = items[i];
    let f = tabs.tabs.find(t=>t.url && t.url.toLowerCase().includes(it.id));
    if (!f) {
      f = await tools.browser.tabs.open({url: it.url});
    }
    const v = await extractMethod(tools, f.id, it);
    if (v) {
      fs.writeFileSync(path.join(outDir, v.id+'.json'), JSON.stringify(v,null,2));
    }
  }
  return {ok:true, count: items.length};
}

module.exports = {extractMethod, extractBatch};
