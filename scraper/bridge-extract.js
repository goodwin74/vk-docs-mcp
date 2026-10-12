function extractBridgePage() {
  const getText = (el) => {
    if (!el) return '';
    return (el.textContent || '').trim().replace(/\s+/g, ' ');
  };

  const main = document.querySelector('main') || document.body;
  const title = document.title || '';
  const h1El = main.querySelector('h1') || document.querySelector('h1');
  const h1 = getText(h1El);
  
  let description = getText(main.querySelector('p'));
  
  const examples = [];
  const pres = Array.from(main.querySelectorAll('pre'));
  for (let i = 0; i < pres.length; i++) {
    const code = pres[i].textContent;
    if (code && code.trim()) {
      examples.push({ lang: 'js', code: code });
    }
  }
  const codes = Array.from(main.querySelectorAll('code'));
  for (let i = 0; i < codes.length && examples.length < 10; i++) {
    const c = codes[i];
    const t = c.textContent.trim();
    if ((t.startsWith('bridge.send') || t.indexOf('.then(') >= 0 || t.indexOf('VKWebApp') >= 0) && t.length > 10 && t.length < 2000) {
      examples.push({ lang: 'js', code: c.textContent });
    }
  }
  const seenEx = new Set();
  const uniqEx = [];
  for (let i = 0; i < examples.length; i++) {
    const k = examples[i].code.slice(0, 40);
    if (!seenEx.has(k)) {
      seenEx.add(k);
      uniqEx.push({ lang: examples[i].lang, code: examples[i].code });
    }
  }
  
  const params = [];
  const tables = Array.from(document.querySelectorAll('table'));
  for (let t = 0; t < tables.length; t++) {
    const tbl = tables[t];
    const ths = Array.from(tbl.querySelectorAll('th')).map(x => getText(x).toLowerCase());
    const hasParams = ths.some(x => x.indexOf('поле') >= 0 || x.indexOf('параметр') >= 0 || x.indexOf('name') >= 0) &&
      ths.some(x => x.indexOf('тип') >= 0 || x.indexOf('type') >= 0) &&
      ths.some(x => x.indexOf('описание') >= 0 || x.indexOf('description') >= 0);
    if (hasParams) {
      const rows = Array.from(tbl.querySelectorAll('tbody tr'));
      for (let r = 0; r < rows.length; r++) {
        const tds = Array.from(rows[r].querySelectorAll('td')).map(getText);
        if (tds.length >= 3) {
          const first = tds[0];
          const required = first.indexOf('обязательное') >= 0 || first.indexOf('required') >= 0 || first.indexOf('*') >= 0;
          let name = first.replace(/обязательное/gi, '').replace(/required/gi, '').replace(/\*/g, '').trim();
          params.push({ name: name, type: tds[1], required: required, description: tds.slice(2).join(' ') });
        }
      }
    }
  }
  
  const sections = [];
  const heads = Array.from(main.querySelectorAll('h2,h3,h4'));
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    const level = parseInt(h.tagName[1]);
    const stitle = getText(h);
    const coll = [];
    let node = h.nextElementSibling;
    while (node && node.tagName && !/^H[2-4]$/.test(node.tagName)) {
      coll.push(getText(node));
      node = node.nextElementSibling;
    }
    sections.push({ level: level, title: stitle, text: coll.filter(Boolean).join(' ') });
  }
  
  const contentParts = [];
  if (description) contentParts.push(description);
  for (let i = 0; i < sections.length; i++) {
    contentParts.push(sections[i].title + ': ' + sections[i].text);
  }
  const contentText = contentParts.join(' ');
  
  const returnsDesc = params.map(p => p.name + ': ' + p.description).join('; ');
  
  return {
    title: title,
    h1: h1,
    description: description,
    examples: uniqEx.slice(0, 5),
    params: params,
    returns: { type: '', description: returnsDesc.slice(0, 500) },
    sections: sections,
    contentText: contentText.slice(0, 2000)
  };
}
return extractBridgePage;
