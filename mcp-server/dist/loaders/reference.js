import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');
const REF_DIR = path.join(ROOT, 'data/vk-reference');
let cache = null;
function loadAll() {
    if (cache)
        return cache;
    if (!fs.existsSync(REF_DIR))
        return [];
    const files = fs.readdirSync(REF_DIR).filter(f => f.endsWith('.json'));
    cache = files.map(f => {
        try {
            return JSON.parse(fs.readFileSync(path.join(REF_DIR, f), 'utf8'));
        }
        catch {
            return null;
        }
    }).filter((m) => m !== null);
    return cache;
}
export function searchApi(query, group) {
    const q = query.toLowerCase();
    let all = loadAll();
    if (group)
        all = all.filter(m => (m.group || m.id.split('.')[0]) === group.toLowerCase());
    const scored = all.map(m => {
        let score = 0;
        const id = m.id.toLowerCase();
        if (id === q)
            score = 100;
        else if (id.endsWith('.' + q) || id.includes(q))
            score = 50;
        else if ((m.description || '').toLowerCase().includes(q))
            score = 10;
        else if ((m.contentText || '').toLowerCase().includes(q))
            score = 5;
        return { m, score };
    }).filter(x => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20).map(x => x.m);
}
export function getApiMethod(nameOrId) {
    const key = nameOrId.toLowerCase().trim();
    const all = loadAll();
    // точное совпадение id ("users.get") или только имя (".get" не подходит — ищем полное совпадение имени)
    return all.find(m => m.id.toLowerCase() === key)
        || all.find(m => m.id.toLowerCase().endsWith('.' + key) && key.includes('.'))
        || all.find(m => m.h1 && m.h1.toLowerCase() === key)
        || null;
}
export function listApi(group) {
    const all = loadAll();
    return group ? all.filter(m => (m.group || m.id.split('.')[0]) === group.toLowerCase()) : all;
}
