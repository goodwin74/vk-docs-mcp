/**
 * Парсер VK API Reference (dev.vk.com/ru/method/...) — автономный, без OpenCode.
 *
 * Использование:
 *   node scraper/run-reference.js index                  — собрать список групп и методов
 *   node scraper/run-reference.js index --groups users,groups,messages,wall,photos
 *   node scraper/run-reference.js extract --group users --limit 20 --offset 0
 *   node scraper/run-reference.js extract --all
 *
 * Результат:  vk-docs-mcp/data/vk-reference/<method>.json
 * Индекс:     vk-docs-mcp/data/reference-index.json
 *
 * Использует playwright-core + системный браузер (Edge/Chrome), headless.
 * networkidle НЕ используется (счётчики держат соединение) — ждём domcontentloaded + пауза.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT_DIR = path.join(DATA, 'vk-reference');
const INDEX_FILE = path.join(DATA, 'reference-index.json');
const BASE = 'https://dev.vk.com';

const PRIORITY_GROUPS = ['users', 'groups', 'messages', 'wall', 'photos'];

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

function loadIndex() {
  const idx = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) : {};
  if (!idx.groups) idx.groups = [];
  if (!idx.methods) idx.methods = {};
  return idx;
}
function saveIndex(index) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function open(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // SPA: ждём реального рендеринга контента
  try {
    await page.waitForSelector('main h1, h1', { timeout: 15000 });
    await sleep(800);
  } catch (e) { await sleep(2000); }
}

// ---------- индекс: группы ----------
async function indexGroups(page, index) {
  console.log('[index] группы с /ru/method ...');
  await open(page, BASE + '/ru/method');
  const groups = await page.evaluate(() => {
    const out = [];
    const seen = {};
    for (const a of document.querySelectorAll('a[href^="/ru/method/"]')) {
      const href = a.getAttribute('href');
      const m = href.match(/^\/ru\/method\/([A-Za-z]+)$/);
      if (!m) continue;
      const id = m[1];
      if (seen[id]) continue;
      seen[id] = 1;
      out.push({ id, title: (a.textContent || '').trim(), url: 'https://dev.vk.com' + href });
    }
    return out;
  });
  index.groups = groups;
  saveIndex(index);
  console.log(`[index] групп: ${groups.length}`);
  return groups;
}

// ---------- индекс: методы внутри группы ----------
async function indexGroupMethods(page, index, group) {
  if (index.methods[group] && index.methods[group].length) {
    console.log(`[index] ${group}: уже есть (${index.methods[group].length})`);
    return;
  }
  console.log(`[index] ${group}: страница группы...`);
  try {
    await open(page, BASE + '/ru/method/' + group);
    const items = await page.evaluate((group) => {
      const out = [];
      const seen = {};
      const re = new RegExp('^/ru/method/' + group + '\\.', 'i');
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href') || '';
        if (!re.test(href)) continue;
        const m = href.match(new RegExp('^/ru/method/(' + group + '\\.[A-Za-z_]+)', 'i'));
        if (!m) continue;
        const id = m[1];
        if (seen[id]) continue;
        seen[id] = 1;
        const name = id.split('.')[1];
        out.push({
          id,
          name,
          group,
          title: name,
          url: 'https://dev.vk.com' + href,
        });
      }
      return out;
    }, group);
    index.methods[group] = items;
    saveIndex(index);
    console.log(`[index] ${group}: ${items.length} методов`);
  } catch (e) {
    console.log(`[index] ${group}: ОШИБКА ${e.message}`);
  }
}

// ---------- извлечение страницы метода ----------
// NOTE: строка должна самовызовываться — page.evaluate ожидает выражение со значением.
const EXTRACT_FN = `(() => {
  const T = el => el ? (el.textContent || '').trim().replace(/\\s+/g, ' ') : '';
  const main = document.querySelector('main') || document.querySelector('article') || document.body;
  const id = (location.pathname.split('/').pop() || '').toLowerCase();
  const url = location.href;
  const title = document.title;
  const h1 = T(main.querySelector('h1') || document.querySelector('h1'));
  const description = T(main.querySelector('p'));

  // примеры кода
  const examples = [];
  for (const pre of main.querySelectorAll('pre')) {
    const code = (pre.textContent || '').trim();
    if (code) examples.push({ lang: 'js', code });
  }

  // Секции "Параметры"/"Результат": div-блоки (стилизованный SPA), не таблицы.
  // Блок параметра: <div><div><span>имя</span><p>тип</p></div><div>описание</div></div>
  // Секции "Параметры"/"Результат": SPA-вёрстка, не таблицы.
  // Контейнер после h2 содержит попеременно: [div( span=имя, p=тип ), div(описание)]
  function parseParamBlocks(container) {
    const rows = [];
    if (!container) return rows;
    let block = container.nextElementSibling;
    while (block && block.tagName && !/^H[2-4]$/.test(block.tagName)) {
      if (block.tagName === 'DIV') {
        const kids = [...block.children];
        for (let i = 0; i < kids.length; i++) {
          // заголовок параметра: span — прямой ребёнок блока (в описаниях span вложен)
          const span = kids[i].querySelector ? kids[i].querySelector(':scope > span') : null;
          if (!span) continue;
          const typeEl = kids[i].querySelector('p');
          const type = typeEl ? (typeEl.textContent || '').trim() : '';
          const descEl = kids[i + 1];
          const description = descEl ? (descEl.textContent || '').trim().replace(/\\s+/g, ' ') : '';
          rows.push({
            name: (span.textContent || '').trim().replace(/\\*/g, ''),
            type,
            required: /\\*/.test(span.textContent || '')
              || /обязательный параметр/i.test(description)
              || /^обяз/i.test(description),
            description,
          });
        }
      }
      block = block.nextElementSibling;
    }
    return rows;
  }

  const params = [];
  const returns = [];
  for (const h of main.querySelectorAll('h2')) {
    const t = T(h);
    if (/параметр/i.test(t)) {
      params.push(...parseParamBlocks(h));
    } else if (/результат|ответ|result/i.test(t)) {
      const rows = parseParamBlocks(h);
      if (rows.length) {
        returns.push({ title: t, rows });
      } else {
        // простой текстовый результат
        const texts = [];
        let n = h.nextElementSibling;
        while (n && n.tagName && !/^H[2-4]$/.test(n.tagName)) {
          const tx = T(n);
          if (tx) texts.push(tx);
          n = n.nextElementSibling;
        }
        if (texts.length) returns.push({ title: t, text: texts.join(' ') });
      }
    }
  }

  // секции по заголовкам (для contentText)
  const sections = [];
  for (const h of main.querySelectorAll('h2,h3,h4')) {
    const parts = [];
    let n = h.nextElementSibling;
    while (n && n.tagName && !/^H[2-4]$/.test(n.tagName)) {
      const t = T(n);
      if (t) parts.push(t);
      n = n.nextElementSibling;
    }
    sections.push({ level: parseInt(h.tagName[1], 10), title: T(h), text: parts.join(' ').slice(0, 1500) });
  }

  const parts = [];
  if (description) parts.push(description);
  for (const s of sections) parts.push(s.title + ': ' + s.text);

  return {
    id, url, title, h1,
    description,
    params,
    returns,
    examples: examples.slice(0, 6),
    sections,
    contentText: parts.join(' ').replace(/\\s+/g, ' ').slice(0, 5000),
    group: id.split('.')[0],
  };
})()`;

async function extractPages(browser, items) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let done = 0, skip = 0, fail = 0;

  for (const item of items) {
    const outFile = path.join(OUT_DIR, item.id.toLowerCase() + '.json');
    if (fs.existsSync(outFile)) { skip++; continue; }
    try {
      await open(page, item.url);
      // SPA может рендериться лениво — до 3 попыток
      let data = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        data = await page.evaluate(EXTRACT_FN);
        if (data && data.id && (data.description || data.params.length || data.sections.length)) break;
        await sleep(2000);
      }
      if (data && data.id && (data.description || data.params.length || data.sections.length)) {
        fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
        done++;
        if (done % 10 === 0) console.log(`[extract] +${done} (пропущено ${skip}, ошибок ${fail})`);
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
  return { done, skip, fail };
}

function collectAll(index) {
  const out = [];
  for (const g of Object.keys(index.methods)) out.push(...index.methods[g]);
  return out;
}

// ---------- CLI ----------
(async () => {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'help';
  const opt = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) { opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; }
  }

  if (cmd === 'help') {
    console.log('Команды:');
    console.log('  index [--groups users,groups]   — собрать индекс групп и их методов');
    console.log('  extract --group users [--limit 20] [--offset 0]');
    console.log('  extract --all                   — извлечь всё (долго)');
    return;
  }

  const browser = await launch();
  try {
    const index = loadIndex();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    if (cmd === 'index') {
      if (!index.groups || !index.groups.length) await indexGroups(page, index);
      const wanted = opt.groups
        ? String(opt.groups).split(',')
        : (index.groups || []).map(g => g.id);
      for (const g of wanted) await indexGroupMethods(page, index, g);
      console.log('[index] всего методов:', collectAll(index).length);
    } else if (cmd === 'extract') {
      let items = [];
      if (opt.all) {
        items = collectAll(index);
      } else {
        const g = String(opt.group || PRIORITY_GROUPS.join(',')).split(',');
        for (const gg of g) {
          if (!index.methods[gg]) await indexGroupMethods(page, index, gg);
          items = items.concat(index.methods[gg] || []);
        }
      }
      await ctx.close();
      const offset = parseInt(opt.offset || '0', 10);
      const limit = opt.limit ? parseInt(opt.limit, 10) : items.length;
      const slice = items.slice(offset, offset + limit);
      console.log(`[extract] к обработке: ${slice.length} из ${items.length}`);
      const r = await extractPages(browser, slice);
      console.log(`[extract] ГОТОВО: новых ${r.done}, уже было ${r.skip}, ошибок ${r.fail}`);
    } else {
      console.log('Неизвестная команда. Справка: node scraper/run-reference.js help');
    }
    await ctx.close().catch(() => {});
  } finally {
    await browser.close();
  }
})();
