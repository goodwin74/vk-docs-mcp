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
        const raw = fs.readFileSync(path.join(BRIDGE_DIR, f), 'utf8');
        return JSON.parse(raw);
    });
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
    const key = slugOrName.toLowerCase();
    const all = loadAll();
    return all.find(m => m.id === key || (m.h1 || '').toLowerCase() === key || (m.title || '').toLowerCase().includes(key)) || null;
}
export function listBridge() {
    return loadAll();
}
