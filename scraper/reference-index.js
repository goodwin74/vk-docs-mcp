// Собирает список методов VK API Reference по разделам
// Использовать через execute (browser tools)

const SECTIONS = [
  { id: 'users', url: 'https://dev.vk.com/ru/reference/users' },
  { id: 'groups', url: 'https://dev.vk.com/ru/reference/groups' },
  { id: 'messages', url: 'https://dev.vk.com/ru/reference/messages' },
  { id: 'wall', url: 'https://dev.vk.com/ru/reference/wall' },
  { id: 'photos', url: 'https://dev.vk.com/ru/reference/photos' }
];

function getIndexScript(sectionId) {
  return `(() => {
    const getText = el => el ? (el.textContent||'').trim() : '';
    const seen = {};
    const links = document.querySelectorAll('a[href^="/ru/reference/"]');
    for (let i=0;i<links.length;i++) {
      const a = links[i];
      const href = a.getAttribute('href');
      if (!href) continue;
      const m = href.match(/\\/ru\\/reference\\/(${sectionId}\\.[^/?#]+)/i);
      if (m) {
        const id = m[1].toLowerCase();
        if (!seen[id]) {
          seen[id] = {id, title: getText(a), url: 'https://dev.vk.com'+href, section: '${sectionId}'};
        }
      }
    }
    return Object.values(seen);
  })()`;
}

async function crawlSection(tools, section) {
  const tabs = await tools.browser.tabs.list();
  let f = tabs.tabs.find(t => t.url && t.url.includes(section.url));
  if (!f) {
    f = await tools.browser.tabs.open({url: section.url});
  }
  const res = await tools.browser.evaluate({tabID: f.id, script: getIndexScript(section.id)});
  return res.value || res;
}

module.exports = { SECTIONS, crawlSection, getIndexScript };
