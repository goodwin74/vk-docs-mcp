#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getBridgeMethod, listBridge, searchBridge } from './loaders/bridge.js';
import { getApiMethod, listApi, searchApi } from './loaders/reference.js';
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
function methodResult(method, searchTool) {
    if (!method) {
        return { isError: true, content: [{ type: 'text', text: `Метод не найден. Уточните название или найдите его через ${searchTool}.` }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(method, null, 2) }] };
}
const server = new Server({ name: 'vk-docs-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });
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
