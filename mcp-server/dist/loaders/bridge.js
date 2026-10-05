import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');
const BRIDGE_DIR = path.join(ROOT, 'data/vk-bridge');
let cache = null;
function loadAll() {
    if (cache)
        return cache;
    if (!fs.existsSync(BRIDGE_DIR))
        return [];
    const files = fs.readdirSync(BRIDGE_DIR).filter(f => f.endsWith('.json'));
    cache = files.map(f => {
        try {
            return JSON.parse(fs.readFileSync(path.join(BRIDGE_DIR, f), 'utf8'));
        }
        catch {
            return null;
        }
    }).filter((m) => m !== null);
    return cache;
}
export function searchBridge(query) {
    const q = query.toLowerCase();
    const all = loadAll();
    return all.filter(m => m.id.includes(q) ||
        (m.h1 || '').toLowerCase().includes(q) ||
        (m.title || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        (m.contentText || '').toLowerCase().includes(q)).slice(0, 20);
}
export function getBridgeMethod(slugOrName) {
    const key = slugOrName.toLowerCase().trim();
    const all = loadAll();
    // Точное совпадение id или заголовка страницы
    const exact = all.find(m => m.id === key || (m.h1 || '').toLowerCase() === key);
    if (exact)
        return exact;
    // Частичное совпадение заголовка допускается, только если оно однозначно:
    // иначе "VKWebAppShow" или "VK Bridge" молча вернули бы случайную страницу.
    const partial = all.filter(m => (m.h1 || '').toLowerCase().includes(key) || (m.title || '').toLowerCase().includes(key));
    return partial.length === 1 ? partial[0] : null;
}
export function listBridge() {
    return loadAll();
}
