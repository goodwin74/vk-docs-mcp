import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');
const OBJ_DIR = path.join(ROOT, 'data/vk-objects');
let cache = null;
function loadAll() {
    if (cache)
        return cache;
    if (!fs.existsSync(OBJ_DIR))
        return [];
    const files = fs.readdirSync(OBJ_DIR).filter(f => f.endsWith('.json'));
    cache = files.map(f => {
        try {
            return JSON.parse(fs.readFileSync(path.join(OBJ_DIR, f), 'utf8'));
        }
        catch {
            return null;
        }
    }).filter((m) => m !== null);
    return cache;
}
// Русские VK-термины → англ. варианты, встречающиеся в id/описаниях объектов
const SYNONYMS = {
    фото: ['photo', 'photos', 'фотограф'],
    фотограф: ['photo', 'photos'],
    пользовател: ['user', 'пользовател'],
    юзер: ['user'],
    сообществ: ['group', 'сообществ'],
    групп: ['group'],
    группе: ['group'],
    запис: ['post', 'запис', 'стен'],
    пост: ['post', 'запис'],
    стен: ['post', 'wall'],
    сообщен: ['message', 'сообщен'],
    личное: ['message', 'личн'],
    бесед: ['conversation', 'chat', 'бесед'],
    чат: ['chat', 'conversation'],
    вложение: ['attachment', 'влож'],
    вложения: ['attachment', 'влож'],
    ссылк: ['link'],
    видео: ['video'],
    аудио: ['audio'],
    документ: ['doc', 'document'],
    опрос: ['poll'],
    голосован: ['poll'],
    товар: ['market-item', 'market', 'товар'],
    альбом: ['album', 'market-album'],
    коммент: ['comment'],
    стикер: ['sticker'],
    стики: ['sticker'],
    подарк: ['gift'],
    гео: ['geo', 'place'],
    локаци: ['geo', 'place', 'address'],
    адрес: ['address'],
    истори: ['story', 'stories'],
    истории: ['story', 'stories'],
    история: ['story'],
    приложен: ['app', 'application'],
    обсуждени: ['topic'],
    вики: ['wiki'],
    страниц: ['wiki', 'page'],
    граффити: ['graffiti'],
    звонок: ['call'],
    звонк: ['call'],
    размер: ['photo-sizes', 'sizes'],
    цен: ['price'],
    жетон: ['sticker', 'product'],
    медиа: ['media', 'photo', 'video'],
};
const STOP_WORDS = new Set([
    'как', 'какой', 'какие', 'какую', 'каким', 'можно', 'нужно', 'надо', 'дело',
    'что', 'чтобы', 'это', 'этот', 'эта', 'для', 'при', 'из', 'через', 'про',
    'объект', 'объекты', 'поля', 'поле', 'нам', 'мы', 'есть', 'ли', 'не', 'нет',
    'the', 'and', 'for', 'with', 'from', 'где', 'когда', 'чего', 'кому',
    'его', 'её', 'их', 'мой', 'твой', 'свой', 'ваш', 'наш', 'содержит', 'содержит:',
]);
function tokenize(query) {
    const words = query.toLowerCase().split(/[^a-zа-яё0-9]+/).filter(Boolean);
    const out = [];
    for (const w of words) {
        if (w.length < 3 || STOP_WORDS.has(w))
            continue;
        out.push(w);
        const syn = SYNONYMS[w] || SYNONYMS[w.replace(/(ами|ах|ов|ам|ой|ый|ая|ое|ые|ую|ие)$/, '')];
        if (syn)
            out.push(...syn);
    }
    return [...new Set(out)];
}
export function searchObjects(query, group) {
    const words = tokenize(query);
    let all = loadAll();
    if (group)
        all = all.filter(m => (m.group || '').toLowerCase() === group.toLowerCase());
    if (!words.length)
        return [];
    const scored = all.map(m => {
        const id = m.id.toLowerCase();
        const desc = (m.description || '').toLowerCase();
        const text = (m.contentText || '').toLowerCase();
        let score = 0;
        let hits = 0;
        for (const w of words) {
            let hit = false;
            if (id === w) {
                score += 100;
                hit = true;
            }
            else if (id.includes(w)) {
                score += 40;
                hit = true;
            }
            if (desc.includes(w)) {
                score += 12;
                hit = true;
            }
            else if (text.includes(w)) {
                score += 5;
                hit = true;
            }
            if (hit)
                hits++;
        }
        // порог: хотя бы половина содержательных слов (но не меньше одного)
        const need = Math.max(1, Math.ceil(words.length / 2));
        if (hits < need)
            return null;
        // бонус за покрытие всех слов
        if (hits === words.length)
            score += 25;
        return { m, score };
    }).filter(Boolean);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20).map(x => x.m);
}
export function getObject(idOrName) {
    const key = idOrName.toLowerCase().trim();
    const all = loadAll();
    // Точное совпадение id ("user", "market-item") или заголовка страницы
    const exact = all.find(m => m.id.toLowerCase() === key || (m.h1 || '').toLowerCase() === key);
    if (exact)
        return exact;
    // Частичное совпадение заголовка допускается, только если оно однозначно:
    // иначе "сообщ" или "запись" молча вернули бы случайный объект.
    const partial = all.filter(m => (m.h1 || '').toLowerCase().includes(key) || (m.title || '').toLowerCase().includes(key));
    return partial.length === 1 ? partial[0] : null;
}
export function listObjects(group) {
    const all = loadAll();
    return group ? all.filter(m => (m.group || '').toLowerCase() === group.toLowerCase()) : all;
}
