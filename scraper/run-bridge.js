/**
 * Парсер VK Bridge (dev.vk.com/ru/bridge) — автономный, без OpenCode.
 * Аналог run-reference.js: перезаполняет пустые JSON в data/vk-bridge/.
 *
 * Использование:
 *   node scraper/run-bridge.js extract                 — все страницы из индекса
 *   node scraper/run-bridge.js extract --limit 20 --offset 0
 *   node scraper/run-bridge.js extract --only vkwebappinit,vkwebappclose
 *
 * Индекс читается из data/vk-bridge-index.json (flat: 98 URL).
 * Существующие файлы НЕ пропускаются по умолчанию (старые — пустые заглушки).
 * Результат: data/vk-bridge/<id>.json
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT_DIR = path.join(DATA, 'vk-bridge');
const INDEX_FILE = path.join(DATA, 'vk-bridge-index.json');

async function launch() {
  const channels = ['msedge', 'chrome', 'chrome-beta'];
  let lastErr;
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (e) { lastErr = e; }
  }
  throw new Error('Не найден системный браузер (Edge/Chrome): ' + lastErr.message);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function open(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForSelector('main h1, h1', { timeout: 15000 });
    await sleep(800);
  } catch (e) { await sleep(2000); }
}

// ---------- извлечение страницы Bridge ----------
// строка самовызываемая — page.evaluate ожидает выражение
const EXTRACT_FN = `(() => {
  const T = el => el ? (el.textContent || '').trim().replace(/\\s+/g, ' ') : '';
  const main = document.querySelector('main') || document.querySelector('article') || document.body;
  const id = (location.pathname.split('/').pop() || '').toLowerCase();
  const url = location.href;
  const title = document.title;
  const h1 = T(main.querySelector('h1') || document.querySelector('h1'));
  const description = T(main.querySelector('p'));

  // --- примеры кода: контейнер с ребёнком CodeActionsBox ("JavaScript") + span с кодом
  const examples = [];
  for (const box of main.querySelectorAll('[class*=CodeActionsBox]')) {
    const container = box.parentElement;
    if (!container) continue;
    const codeEl = [...container.children].find(c => c !== box);
    if (!codeEl) continue;
    const code = (codeEl.textContent || '').trim();
    if (code && code.length > 5 && !examples.some(e => e.code === code)) {
      examples.push({ lang: 'javascript', code });
    }
  }

  // --- таблицы: параметры/результат (Поле|Тип|Описание), совместимость
  const tables = [];
  for (const tbl of main.querySelectorAll('table')) {
    const headers = [...tbl.querySelectorAll('th')].map(x => T(x));
    const rows = [];
    const trs = [...tbl.querySelectorAll('tr')];
    for (const tr of trs) {
      const cells = [...tr.querySelectorAll('td')];
      if (!cells.length) continue;
      rows.push(cells.map(T));
    }
    if (!rows.length) continue;
    // заголовок секции, к которой привязана таблица
    let sectionTitle = '';
    let n = tbl;
    for (let i = 0; i < 8 && n && !sectionTitle; i++) {
      let p = n.previousElementSibling;
      while (p) {
        if (/^H[2-4]$/.test(p.tagName)) { sectionTitle = T(p); break; }
        p = p.previousElementSibling;
      }
      n = n.parentElement;
    }
    tables.push({ headers, rows, sectionTitle });
  }

  const isParamTable = t => t.headers.some(h => /поле/i.test(h)) && t.headers.some(h => /тип/i.test(h));
  const paramTables = tables.filter(isParamTable);

  // params: первая «Поле/Тип» таблица, которая НЕ в секции результата
  const params = [];
  const returnsTables = [];
  for (const t of paramTables) {
    const isReturn = /результат|promise|ответ|событи/i.test(t.sectionTitle);
    const parsed = t.rows.map(r => {
      const rawName = r[0] || '';
      const descAll = r.slice(2).join(' ').replace(/\\s+/g, ' ');
      // в ячейке имени бывает подпись «обязательное»/«необязательное»
      const notReq = /необязательн/i.test(rawName) || /необязательн/i.test(descAll.slice(0, 40));
      const isReq = !notReq && (/обязательн/i.test(rawName) || /\\*/.test(rawName));
      const name = rawName
        .replace(/необязательн[а-яё]*/gi, '')
        .replace(/обязательн[а-яё]*/gi, '')
        .replace(/\\*/g, '')
        .replace(/\\s+/g, ' ')
        .trim();
      return {
        name,
        type: r[1] || '',
        required: isReq,
        description: descAll,
      };
    });
    if (isReturn) returnsTables.push({ title: t.sectionTitle, rows: parsed });
    else params.push(...parsed);
  }

  // --- секции по заголовкам (текст для contentText и возвратов)
  const sections = [];
  for (const h of main.querySelectorAll('h2,h3,h4')) {
    const parts = [];
    let n = h.nextElementSibling;
    while (n && n.tagName && !/^H[2-4]$/.test(n.tagName)) {
      const t = T(n);
      if (t) parts.push(t);
      n = n.nextElementSibling;
    }
    sections.push({ level: parseInt(h.tagName[1], 10), title: T(h), text: parts.join(' ').slice(0, 2000) });
  }

  // returns: таблицы результата + текст секции «Результат»
  const returns = { description: '' };
  const retParts = [];
  for (const s of sections) {
    if (/результат/i.test(s.title) && s.text) retParts.push(s.text);
  }
  for (const t of returnsTables) {
    for (const r of t.rows) retParts.push(r.name + (r.type ? ' (' + r.type + ')' : '') + ': ' + r.description);
  }
  returns.description = retParts.join(' ').replace(/\\s+/g, ' ').slice(0, 1500);

  // --- совместимость
  const compatTable = tables.find(t => t.headers.some(h => /площадк/i.test(h)));
  const compatibility = compatTable
    ? compatTable.rows.map(r => r.join(': ')).join('; ')
    : '';

  const contentParts = [];
  if (description) contentParts.push(description);
  for (const s of sections) contentParts.push(s.title + ': ' + s.text);

  return {
    id, url, title, h1,
    group: '',
    description,
    examples: examples.slice(0, 8),
    params,
    returns,
    sections,
    compatibility,
    contentText: contentParts.join(' ').replace(/\\s+/g, ' ').slice(0, 6000),
  };
})()`;

async function extractPages(browser, items) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let done = 0, fail = 0;

  for (const item of items) {
    const outFile = path.join(OUT_DIR, item.id + '.json');
    try {
      await open(page, item.url);
      let data = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        data = await page.evaluate(EXTRACT_FN);
        if (data && data.description && data.sections.length) break;
        await sleep(2000);
      }
      if (data && data.id && (data.description || data.sections.length)) {
        data.group = item.group || '';
        fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
        done++;
        if (done % 10 === 0) console.log(`[extract] +${done} (ошибок ${fail})`);
      } else {
        fail++;
        console.log(`[extract] ${item.id}: пустой результат`);
      }
    } catch (e) {
      fail++;
      console.log(`[extract] ${item.id}: ОШИБКА ${e.message}`);
    }
    await sleep(300);
  }
  await ctx.close();
  return { done, fail };
}

// ---------- CLI ----------
(async () => {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'help';
  const opt = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
  }

  if (cmd === 'help') {
    console.log('Команды:');
    console.log('  extract                      — перезаполнить все страницы из индекса');
    console.log('  extract --limit 20 --offset 0 — по частям');
    console.log('  extract --only vkwebappinit,vkwebappclose');
    return;
  }

  if (cmd !== 'extract') {
    console.log('Неизвестная команда. Справка: node scraper/run-bridge.js help');
    return;
  }

  // readFileSync + JSON.parse падают на BOM — срезаем
  const idxRaw = fs.readFileSync(INDEX_FILE, 'utf8').replace(/^\uFEFF/, '');
  const idx = JSON.parse(idxRaw);
  let items = idx.flat || [];
  if (opt.only) {
    const want = String(opt.only).split(',').map(s => s.trim().toLowerCase());
    items = items.filter(it => want.includes(it.id.toLowerCase()));
  } else {
    const offset = parseInt(opt.offset || '0', 10);
    const limit = opt.limit ? parseInt(opt.limit, 10) : items.length;
    items = items.slice(offset, offset + limit);
  }
  if (!items.length) { console.log('Нет страниц для обработки'); return; }

  console.log(`[extract] к обработке: ${items.length}`);
  const browser = await launch();
  try {
    const r = await extractPages(browser, items);
    console.log(`[extract] ГОТОВО: ${r.done} успешно, ${r.fail} ошибок`);
  } finally {
    await browser.close();
  }
})();
