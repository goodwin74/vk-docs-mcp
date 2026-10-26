import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');
const PAY_DIR = path.join(ROOT, 'data/vk-payments');
let cache = null;
function loadAll() {
    if (cache)
        return cache;
    if (!fs.existsSync(PAY_DIR))
        return [];
    const files = fs.readdirSync(PAY_DIR).filter((f) => f.endsWith('.json'));
    cache = files
        .map((f) => {
        try {
            return JSON.parse(fs.readFileSync(path.join(PAY_DIR, f), 'utf8'));
        }
        catch {
            return null;
        }
    })
        .filter((d) => d !== null);
    return cache;
}
// Русские слова из запроса → варианты, встречающиеся в id/тексте статей
const SYNONYMS = {
    платеж: ['payment', 'payments', 'платеж', 'оплат', 'списани'],
    платежи: ['payment', 'payments', 'платеж', 'оплат'],
    оплат: ['payment', 'payments', 'платеж', 'charge', 'покупк'],
    оплата: ['payment', 'charge', 'платеж'],
    покупк: ['purchase', 'buy', 'товар', 'goods', 'заказ', 'order'],
    покупки: ['purchase', 'buy', 'товар', 'goods'],
    товар: ['goods', 'virtual', 'item', 'виртуальн'],
    товаров: ['goods', 'virtual', 'item', 'виртуальн'],
    виртуальн: ['virtual', 'goods', 'голос'],
    голос: ['vote', 'голос', 'валют', 'currency'],
    голоса: ['vote', 'голос', 'валют'],
    валют: ['virtual', 'currency', 'голос'],
    подписк: ['subscription', 'подписк', 'donut'],
    подписок: ['subscription', 'подписк'],
    уведомлен: ['notification', 'notify', 'callback', 'уведомлен', 'get_item', 'order_status'],
    уведомлени: ['notification', 'notify', 'callback'],
    нотификац: ['notification', 'notify'],
    сигнатур: ['sig', 'signature', 'подпис', 'md5'],
    подпис: ['sig', 'signature', 'подпис', 'md5'],
    подпись: ['sig', 'signature', 'подпис', 'md5'],
    сервер: ['server', 'сервер', 'обработчик', 'handler', 'callback'],
    обработк: ['handler', 'обработ', 'handle', 'notification'],
    тест: ['testing', 'test', 'тест'],
    тестирование: ['testing', 'test'],
    донат: ['donut', 'донат'],
    донаты: ['donut', 'донат'],
    donate: ['donut'],
    контент: ['content', 'пост', 'запис'],
    сообществ: ['group', 'community', 'сообществ'],
    сообщества: ['group', 'community'],
    мини: ['mini', 'mini-app', 'мини'],
    приложен: ['app', 'application', 'приложен'],
    игра: ['game', 'games', 'игр'],
    игры: ['game', 'games'],
    заказ: ['order', 'заказ'],
    заказа: ['order', 'заказ'],
    отказ: ['refund', 'возврат', 'cancel'],
    возврат: ['refund', 'возврат'],
    цена: ['price', 'стоимость'],
    стоимость: ['price'],
    ошибка: ['error', 'ошибк', 'error_code'],
    ошибки: ['error', 'ошибк'],
    json: ['json'],
    php: ['php'],
    javascript: ['javascript', 'node'],
    curl: ['curl'],
    запрос: ['request', 'запрос'],
    ответ: ['response', 'ответ'],
    api: ['api'],
    vk: ['vk', 'вконтакте'],
    вконтакте: ['vk'],
    одноклассник: ['ok', 'odnoklassniki'],
    ок: ['ok', 'одноклассник'],
    деньги: ['payment', 'деньг', 'сумм'],
    монетизац: ['monetization', 'монетизац', 'доход'],
    продав: ['продаж', 'sale', 'продажа'],
    продаж: ['продаж', 'sale', 'продажа'],
    продать: ['продаж', 'sale'],
    принять: ['payment', 'прием', 'оплат'],
    прием: ['payment', 'прием', 'оплат'],
    cashier: ['payment', 'касса'],
};
const STOP_WORDS = new Set([
    'как', 'какой', 'какие', 'какую', 'каким', 'можно', 'нужно', 'надо', 'дело',
    'что', 'чтобы', 'это', 'этот', 'эта', 'для', 'при', 'из', 'через', 'про',
    'метод', 'методы', 'нам', 'мы', 'есть', 'ли', 'не', 'нет', 'все', 'её',
    'the', 'and', 'for', 'with', 'from', 'где', 'когда', 'чего', 'кому',
    'его', 'их', 'мой', 'твой', 'свой', 'ваш', 'наш', 'страниц', 'статья',
    'сделать', 'подключить', 'подключение', 'использовать', 'какие', 'есть',
]);
function tokenize(query) {
    const words = query.toLowerCase().split(/[^a-zа-яё0-9_]+/).filter(Boolean);
    const out = [];
    for (const w of words) {
        if (w.length < 3 || STOP_WORDS.has(w))
            continue;
        out.push(w);
        const syn = synonymsFor(w);
        if (syn)
            out.push(...syn);
    }
    return [...new Set(out)];
}
// Словоформы (тестовые/тестовый/тест) → общий ключ синонима
function synonymsFor(w) {
    if (SYNONYMS[w])
        return SYNONYMS[w];
    const stem = w.replace(/(ами|ями|ов|ах|ях|ой|ый|ая|ое|ые|ые|ую|ие|ого|ему|ым|ом|ть|ет|ут|ют|ла|ло|ли)$/, '');
    if (stem && SYNONYMS[stem])
        return SYNONYMS[stem];
    // префиксное сравнение: «тестовые» → ключ «тест»
    for (const k of Object.keys(SYNONYMS)) {
        if (k.length >= 4 && (w.startsWith(k) || (w.length >= 4 && k.startsWith(w))))
            return SYNONYMS[k];
    }
    return undefined;
}
export function searchPayments(query, group) {
    const words = tokenize(query);
    let all = loadAll();
    if (group)
        all = all.filter((d) => (d.group || d.id.split('/')[0]) === group.toLowerCase());
    if (!words.length)
        return [];
    const scored = all.map((d) => {
        const id = d.id.toLowerCase();
        const idParts = id.split('/');
        const h1 = (d.h1 || '').toLowerCase();
        const desc = (d.description || '').toLowerCase();
        const text = (d.contentText || '').toLowerCase();
        let score = 0;
        let hits = 0;
        for (const w of words) {
            let hit = false;
            // точное совпадение с заголовком или сегментом id ("overview", "testing", "notifications/vk")
            if (h1 === w || id === w || idParts.includes(w)) {
                score += 70;
                hit = true;
            }
            else if (h1.includes(w)) {
                score += 32;
                hit = true;
            }
            else if (id.includes(w)) {
                score += 25;
                hit = true;
            }
            if (desc.includes(w)) {
                score += 16;
                hit = true;
            }
            else if (text.includes(w)) {
                score += 6;
                hit = true;
            }
            if (hit)
                hits++;
        }
        // порог: хотя бы половина содержательных слов (но не меньше одного)
        const need = Math.max(1, Math.ceil(words.length / 2));
        if (hits < need)
            return null;
        if (hits === words.length)
            score += 25;
        return { d, score };
    }).filter(Boolean);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 15).map((x) => x.d);
}
export function getPaymentPage(key) {
    const raw = key.toLowerCase().trim().replace(/\\/g, '/');
    if (!raw)
        return null;
    const all = loadAll();
    const norm = (s) => s.toLowerCase().replace(/\./g, '/').replace(/\s+/g, '');
    // 1. точное совпадение id ("payments/overview", "payments.overview")
    const byId = all.find((d) => norm(d.id) === norm(raw));
    if (byId)
        return byId;
    // 2. совпадение по хвосту id ("overview", "notifications/vk", "get-item")
    const bySuffix = all.filter((d) => norm(d.id).endsWith('/' + norm(raw)) || norm(d.id) === norm(raw));
    if (bySuffix.length === 1)
        return bySuffix[0];
    // 3. заголовок статьи ("VK Донат API", "Тестирование платежей")
    const byH1 = all.find((d) => (d.h1 || '').toLowerCase().trim() === raw || (d.title || '').toLowerCase().trim() === raw);
    if (byH1)
        return byH1;
    if (bySuffix.length > 1)
        return null;
    // 4. однозначное частичное совпадение, чтобы "донат" или "уведомления" находили страницу
    const partial = all.filter((d) => norm(d.id).includes(norm(raw)) || (d.h1 || '').toLowerCase().includes(raw));
    return partial.length === 1 ? partial[0] : null;
}
export function listPayments(group) {
    const all = loadAll();
    return group
        ? all.filter((d) => (d.group || d.id.split('/')[0]) === group.toLowerCase())
        : all;
}
