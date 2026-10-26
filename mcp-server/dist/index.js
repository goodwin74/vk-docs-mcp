#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getBridgeMethod, listBridge, searchBridge } from './loaders/bridge.js';
import { getApiMethod, listApi, searchApi } from './loaders/reference.js';
import { getObject, listObjects, searchObjects } from './loaders/objects.js';
import { getPaymentPage, listPayments, searchPayments } from './loaders/payments.js';
const requiredText = z.string().trim().min(1);
const optionalGroup = z.string().trim().optional();
const requiredTextSchema = { type: 'string', minLength: 1, pattern: '\\S' };
function parseArguments(schema, args) {
    const parsed = schema.safeParse(args === undefined ? {} : args);
    if (!parsed.success) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: ${parsed.error.message}`);
    }
    return parsed.data;
}
function methodResult(method, searchTool, noun = 'Метод', notFoundMsg) {
    if (!method) {
        return { isError: true, content: [{ type: 'text', text: notFoundMsg || `${noun} не найден. Уточните название или найдите его через ${searchTool}.` }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(method, null, 2) }] };
}
const server = new Server({ name: 'vk-docs-mcp', version: '0.3.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'vk_bridge_search',
            description: 'Поиск по документации VK Bridge (Bridge.send) для VK Mini Apps / мини-приложений ВКонтакте. Использовать при вопросах о разработке мини-приложений VK, VKMiniApps, мини-аппа: события, capabilities, вызовы bridge.send.',
            inputSchema: { type: 'object', properties: { query: requiredTextSchema }, required: ['query'] },
        },
        {
            name: 'vk_bridge_get_method',
            description: 'Получить полное описание метода VK Bridge (VKWebApp*) для VK Mini Apps / мини-приложений ВКонтакте. Использовать при вопросах о методах мини-приложений VK: VKWebAppInit, VKWebAppCallAPIMethod, VKWebAppStorageSet и т.д.',
            inputSchema: { type: 'object', properties: { slug: requiredTextSchema }, required: ['slug'] },
        },
        {
            name: 'vk_bridge_list',
            description: 'Список всех методов и событий VK Bridge для VK Mini Apps / мини-приложений ВКонтакте (для навигации по документации мини-аппов).',
            inputSchema: { type: 'object', properties: {} },
        },
        {
            name: 'vk_api_search',
            description: 'Поиск по полной документации VK API Reference (dev.vk.com): методы users.*, groups.*, messages.*, wall.*, photos.* и др. Использовать при вопросах о VK API, ВКонтакте API, разработке сервисов на платформе VK / ВКонтакте, бэкенде для мини-приложений VK.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: requiredTextSchema,
                    group: { type: 'string', description: 'Ограничить группой, например: users, groups, messages, wall, photos' },
                },
                required: ['query'],
            },
        },
        {
            name: 'vk_api_get_method',
            description: 'Получить полное описание метода VK API (параметры, типы, обязательность, результат): напр. users.get, messages.send, wall.post. Использовать при вопросах о методах API ВКонтакте в любом проекте на VK — сервисы, интеграции, мини-приложения VK Mini Apps.',
            inputSchema: { type: 'object', properties: { name: requiredTextSchema }, required: ['name'] },
        },
        {
            name: 'vk_api_list',
            description: 'Список методов VK API Reference по группам (users, groups, messages, wall, photos, market, ads...) — навигация по документации API ВКонтакте.',
            inputSchema: {
                type: 'object',
                properties: { group: { type: 'string', description: 'Группа: users, groups, messages, wall, photos...' } },
            },
        },
        {
            name: 'vk_objects_search',
            description: 'Поиск по объектам VK API (dev.vk.com/ru/reference/objects): структуры данных users_user, groups_group, messages_message, вложения (attachments) и др. Использовать при вопросах о полях и структуре объектов ВКонтакте / VK API: что содержит пользователь, сообщество, запись, сообщение, вложения.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: requiredTextSchema,
                    group: { type: 'string', description: 'Ограничить категорией, например: Основные объекты, Медиаконтент и вложения, Вспомогательные объекты и наборы значений' },
                },
                required: ['query'],
            },
        },
        {
            name: 'vk_objects_get_object',
            description: 'Получить полное описание объекта VK API (поля, типы, вложенные поля): напр. user (пользователь), group (сообщество), post (запись), message (сообщение), attachments-wall (вложения стен). Использовать при вопросах о структуре данных объектов ВКонтакте / VK API, о полях ответа методов.',
            inputSchema: { type: 'object', properties: { id: requiredTextSchema }, required: ['id'] },
        },
        {
            name: 'vk_objects_list',
            description: 'Список всех объектов VK API Reference (user, group, post, message, photo, video, вложения и др.) по категориям — навигация по документации объектов ВКонтакте.',
            inputSchema: {
                type: 'object',
                properties: { group: { type: 'string', description: 'Категория: Основные объекты, Медиаконтент и вложения, Вспомогательные объекты и наборы значений' } },
            },
        },
        {
            name: 'vk_payments_search',
            description: 'Поиск по документации платежей VK / ВКонтакте (dev.vk.ru/ru/api/payments): подключение сервиса к платёжной системе ВКонтакте, продажа виртуальных ценностей и подписок за голоса, платёжные уведомления на сервер, проверка подписи sig, тестирование платежей, VK Донат API. Использовать при вопросах о приёме оплаты, монетизации игр и мини-приложений, донатах, платежах в приложениях VK.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: requiredTextSchema,
                    group: { type: 'string', description: 'Ограничить разделом: payments (платежи виртуальной валютой) или donut (VK Донат API)' },
                },
                required: ['query'],
            },
        },
        {
            name: 'vk_payments_get_page',
            description: 'Получить полную статью документации платежей VK в Markdown (текст, таблицы параметров уведомлений, блоки кода PHP/JavaScript/JSON, директивы :::note): напр. payments/overview (обзор), payments/notifications/vk (обработка платёжных уведомлений и подпись sig), payments/virtual-goods/vk, payments/subscriptions/vk, payments/testing (тестирование), donut/getting-started (VK Донат API). Использовать, когда нужен полный текст статьи о платежах, формате уведомлений или примеры кода обработчиков.',
            inputSchema: { type: 'object', properties: { id: requiredTextSchema }, required: ['id'] },
        },
        {
            name: 'vk_payments_list',
            description: 'Список статей документации по платежам VK (id, заголовки, описания, ссылки): обзор платежей, покупка виртуальных товаров и подписок, типы платёжных уведомлений, тестирование, VK Донат API — навигация по платежной документации ВКонтакте.',
            inputSchema: {
                type: 'object',
                properties: { group: { type: 'string', description: 'Раздел: payments или donut' } },
            },
        },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === 'vk_bridge_search') {
        const { query } = parseArguments(z.object({ query: requiredText }), args);
        const results = searchBridge(query);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    if (name === 'vk_bridge_get_method') {
        const { slug } = parseArguments(z.object({ slug: requiredText }), args);
        const method = getBridgeMethod(slug);
        return methodResult(method, 'vk_bridge_search');
    }
    if (name === 'vk_bridge_list') {
        parseArguments(z.object({}), args);
        const all = listBridge();
        const list = all.map(m => ({ id: m.id, h1: m.h1, title: m.title, group: m.group, url: m.url }));
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    }
    if (name === 'vk_api_search') {
        const { query, group } = parseArguments(z.object({ query: requiredText, group: optionalGroup }), args);
        const results = searchApi(query, group).map(m => ({
            id: m.id, group: m.group, description: m.description, url: m.url,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    if (name === 'vk_api_get_method') {
        const { name: method } = parseArguments(z.object({ name: requiredText }), args);
        const m = getApiMethod(method);
        return methodResult(m, 'vk_api_search');
    }
    if (name === 'vk_api_list') {
        const { group } = parseArguments(z.object({ group: optionalGroup }), args);
        const list = listApi(group).map(m => ({ id: m.id, group: m.group, description: m.description, url: m.url }));
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    }
    if (name === 'vk_objects_search') {
        const { query, group } = parseArguments(z.object({ query: requiredText, group: optionalGroup }), args);
        const results = searchObjects(query, group).map(m => ({
            id: m.id, group: m.group, description: m.description, url: m.url,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    if (name === 'vk_objects_get_object') {
        const { id } = parseArguments(z.object({ id: requiredText }), args);
        const obj = getObject(id);
        return methodResult(obj, 'vk_objects_search', 'Объект');
    }
    if (name === 'vk_objects_list') {
        const { group } = parseArguments(z.object({ group: optionalGroup }), args);
        const list = listObjects(group).map(m => ({ id: m.id, h1: m.h1, group: m.group, description: m.description, url: m.url }));
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    }
    if (name === 'vk_payments_search') {
        const { query, group } = parseArguments(z.object({ query: requiredText, group: optionalGroup }), args);
        const results = searchPayments(query, group).map(d => ({
            id: d.id, group: d.group, h1: d.h1, description: d.description, url: d.url,
            headings: d.headings.slice(0, 10),
            examples: d.examples.length,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    if (name === 'vk_payments_get_page') {
        const { id } = parseArguments(z.object({ id: requiredText }), args);
        const doc = getPaymentPage(id);
        return methodResult(doc, 'vk_payments_search', 'Страница', 'Страница не найдена. Уточните id (например payments/overview, payments/notifications/vk) или найдите её через vk_payments_search.');
    }
    if (name === 'vk_payments_list') {
        const { group } = parseArguments(z.object({ group: optionalGroup }), args);
        const list = listPayments(group).map(d => ({ id: d.id, h1: d.h1, group: d.group, title: d.title, url: d.url }));
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    }
    throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
