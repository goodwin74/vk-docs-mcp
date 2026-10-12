// helper for browser extraction
function extractFull() {
  const getText = el => el ? (el.textContent||'').trim().replace(/\s+/g,' ') : '';
  const main = document.querySelector('main') || document.body;
  const title = document.title;
  const h1 = getText(main.querySelector('h1')||document.querySelector('h1'));
  const description = getText(main.querySelector('p'));
  const id = (location.pathname.split('/').pop()||'').toLowerCase();
  const url = location.href;
  const examples=[];
  const pres=[...main.querySelectorAll('pre')];
  pres.forEach(p=>{const c=p.textContent; if(c&&c.trim()) examples.push({lang:'js',code:c});});
  const textAll=main.innerText||'';
  const m=textAll.match(/bridge\.send\([\s\S]{0,1400}?\)(?=\n\n|\n[A-ZА-Я]|$)/g);
  if(m){ for(let i=0;i<m.length&&examples.length<10;i++){ const c=m[i].trim(); if(c.length>10) examples.push({lang:'js',code:c});}}
  const seen=new Set(); const uniqEx=[];
  for(let i=0;i<examples.length;i++){ const k=examples[i].code.slice(0,50); if(!seen.has(k)){seen.add(k); uniqEx.push(examples[i]);}}
  const params=[]; const tables=[...document.querySelectorAll('table')];
  for(let t=0;t<tables.length;t++){
    const tbl=tables[t]; const ths=[...tbl.querySelectorAll('th')].map(x=>getText(x).toLowerCase());
    const has=ths.some(x=>x.includes('поле')||x.includes('параметр')||x.includes('name'))&&ths.some(x=>x.includes('тип')||x.includes('type'))&&ths.some(x=>x.includes('описание')||x.includes('description'));
    if(has){
      const rows=[...tbl.querySelectorAll('tbody tr')];
      for(let r=0;r<rows.length;r++){
        const tds=[...rows[r].querySelectorAll('td')].map(getText);
        if(tds.length>=3){ const first=tds[0]; const req=(first.indexOf('обязательное')>=0||first.indexOf('required')>=0||first.indexOf('*')>=0); const nm=first.replace(/обязательное/gi,'').replace(/required/gi,'').replace(/\*/g,'').trim(); params.push({name:nm,type:tds[1],required:req,description:tds.slice(2).join(' ')});}
      }
    }
  }
  const sections=[]; const heads=[...main.querySelectorAll('h2,h3,h4')];
  for(let i=0;i<heads.length;i++){ const h=heads[i]; const level=parseInt(h.tagName[1]); const st=getText(h); const coll=[]; let node=h.nextElementSibling; while(node&&node.tagName&&!/^H[2-4]$/.test(node.tagName)){coll.push(getText(node)); node=node.nextElementSibling;} sections.push({level,title:st,text:coll.filter(Boolean).join(' ')});}
  const contentParts=[]; if(description) contentParts.push(description); for(let i=0;i<sections.length;i++) contentParts.push(sections[i].title+': '+sections[i].text);
  return {id,url,title,h1,description,examples:uniqEx.slice(0,8),params,returns:{description:params.map(p=>p.name+': '+p.description).join('; ').slice(0,800)},sections,contentText:contentParts.join(' ').slice(0,3000),group:''};
}
