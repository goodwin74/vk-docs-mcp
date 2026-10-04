#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getBridgeMethod, listBridge, searchBridge } from './loaders/bridge.js';
import { getApiMethod, listApi, searchApi } from './loaders/reference.js';
const server = new Server({ name: 'vk-docs-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'vk_bridge_search',
            description: 'Поиск по документации VK Bridge (Bridge.send) для VK Mini Apps / мини-приложений ВКонтакте. Использовать при вопросах о разработке мини-приложений VK, VKMiniApps, мини-аппа: события, capabilities, вызовы bridge.send.',
            inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        },
        {
            name: 'vk_bridge_get_method',
            description: 'Получить полное описание метода VK Bridge (VKWebApp*) для VK Mini Apps / мини-приложений ВКонтакте. Использовать при вопросах о методах мини-приложений VK: VKWebAppInit, VKWebAppCallAPIMethod, VKWebAppStorageSet и т.д.',
            inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
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
                    query: { type: 'string' },
                    group: { type: 'string', description: 'Ограничить группой, например: users, groups, messages, wall, photos' },
                },
                required: ['query'],
            },
        },
        {
            name: 'vk_api_get_method',
            description: 'Получить полное описание метода VK API (параметры, типы, обязательность, результат): напр. users.get, messages.send, wall.post. Использовать при вопросах о методах API ВКонтакте в любом проекте на VK — сервисы, интеграции, мини-приложения VK Mini Apps.',
            inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        },
        {
            name: 'vk_api_list',
            description: 'Список методов VK API Reference по группам (users, groups, messages, wall, photos, market, ads...) — навигация по документации API ВКонтакте.',
            inputSchema: {
                type: 'object',
                properties: { group: { type: 'string', description: 'Группа: users, groups, messages, wall, photos...' } },
            },
        },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === 'vk_bridge_search') {
        const { query } = z.object({ query: z.string() }).parse(args);
        const results = searchBridge(query);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    if (name === 'vk_bridge_get_method') {
        const { slug } = z.object({ slug: z.string() }).parse(args);
        const method = getBridgeMethod(slug);
        return { content: [{ type: 'text', text: method ? JSON.stringify(method, null, 2) : 'Метод не найден' }] };
    }
    if (name === 'vk_bridge_list') {
        const all = listBridge();
        const list = all.map(m => ({ id: m.id, h1: m.h1, title: m.title, group: m.group, url: m.url }));
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    }
    if (name === 'vk_api_search') {
        const { query, group } = z.object({ query: z.string(), group: z.string().optional() }).parse(args);
        const results = searchApi(query, group).map(m => ({
            id: m.id, group: m.group, description: m.description, url: m.url,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    if (name === 'vk_api_get_method') {
        const { name: method } = z.object({ name: z.string() }).parse(args);
        const m = getApiMethod(method);
        return { content: [{ type: 'text', text: m ? JSON.stringify(m, null, 2) : 'Метод не найден' }] };
    }
    if (name === 'vk_api_list') {
        const { group } = z.object({ group: z.string().optional() }).parse(args);
        const list = listApi(group).map(m => ({ id: m.id, group: m.group, description: m.description, url: m.url }));
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    }
    throw new Error(`Unknown tool: ${name}`);
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
