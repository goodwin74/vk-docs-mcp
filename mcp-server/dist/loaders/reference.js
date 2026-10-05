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
// Русские VK-термины → англ. варианты, встречающиеся в id/описаниях
const SYNONYMS = {
    фото: ['photo', 'photos', 'album', 'альбом'],
    фотограф: ['photo', 'photos'],
    сообществ: ['group', 'groups', 'сообществ'],
    групп: ['group', 'groups'],
    группе: ['group', 'groups'],
    друзья: ['friends', 'friend', 'друз'],
    друг: ['friends', 'friend'],
    стен: ['wall', 'стен'],
    стена: ['wall'],
    пост: ['wall', 'post', 'запис'],
    запис: ['wall', 'post', 'запис'],
    лайк: ['likes', 'like', 'лайк'],
    сообщен: ['messages', 'message', 'сообщен'],
    письм: ['messages', 'message'],
    видео: ['video', 'видео'],
    документ: ['docs', 'document', 'документ'],
    опрос: ['polls', 'poll', 'опрос'],
    голосован: ['polls', 'poll'],
    магазин: ['market', 'магазин', 'товар'],
    товар: ['market', 'товар'],
    реклам: ['ads', 'ad ', 'реклам'],
    пользовател: ['users', 'user', 'пользовател'],
    юзер: ['users', 'user'],
    коммент: ['comment', 'коммент'],
    подписчик: ['subscri', 'follower'],
    подписк: ['subscri', 'follow'],
    уведомлен: ['notification'],
    истории: ['stories', 'story', 'истори'],
    истори: ['stories', 'story'],
    клавиатур: ['keyboard'],
    загрузк: ['upload', 'getuploadserver'],
    страниц: ['pages', 'page'],
    подписчиков: ['subscri', 'follower'],
    чат: ['chat', 'бесед', 'conversation'],
    бесед: ['chat', 'conversation'],
    курс: ['rate', 'currency'],
    валют: ['rate', 'currency'],
    город: ['cities', 'city', 'getcities'],
    стран: ['countries', 'country'],
    поиск: ['search', 'searchitems', 'searchposts'],
    бронир: ['book', 'booking'],
    звонок: ['call', 'startcall'],
    звонк: ['call'],
    игра: ['games', 'game'],
    жетон: ['sticker', 'store'],
    стикер: ['sticker', 'store'],
    pay: ['pay', 'openpayform'],
    кошел: ['pay', 'wallet'],
    деньги: ['pay', 'balance'],
    трансфер: ['transfer'],
    безопасн: ['secure', 'safe'],
    статистик: ['stats', 'statistics', 'getstatistics'],
    онлайн: ['online', 'getonline'],
};
const STOP_WORDS = new Set([
    'как', 'какой', 'какие', 'какую', 'каким', 'можно', 'нужно', 'надо', 'дело',
    'что', 'чтобы', 'это', 'этот', 'эта', 'для', 'при', 'из', 'через', 'про',
    'метод', 'методы', 'ми', 'нам', 'мы', 'есть', 'ли', 'не', 'нет', 'все',
    'the', 'and', 'for', 'with', 'from', 'что', 'где', 'когда', 'чего', 'кому',
    'его', 'её', 'их', 'мой', 'твой', 'свой', 'ваш', 'наш',
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
export function searchApi(query, group) {
    const words = tokenize(query);
    let all = loadAll();
    if (group)
        all = all.filter(m => (m.group || m.id.split('.')[0]) === group.toLowerCase());
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
