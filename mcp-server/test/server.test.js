import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const entry = resolve(root, 'mcp-server/dist/index.js');

function startServer(t) {
    // When the test runner is sandboxed, keep the server read-only as well.
    const permissions = process.permission ? ['--permission', `--allow-fs-read=${root}`] : [];
    const child = spawn(process.execPath, [...permissions, entry], {
        cwd: tmpdir(),
        env: { PATH: dirname(process.execPath) },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const pending = new Map();
    let nextId = 0;
    let stderr = '';
    let failure;
    const fail = (error) => {
        failure = error;
        for (const request of pending.values()) {
            clearTimeout(request.timer);
            request.reject(error);
        }
        pending.clear();
    };
    child.stderr.setEncoding('utf8').on('data', text => { stderr += text; });
    child.on('error', fail);
    child.on('exit', (code, signal) => fail(new Error(`Server exited (${code ?? signal}): ${stderr}`)));
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
        let response;
        try {
            response = JSON.parse(line);
        } catch {
            fail(new Error(`Non-JSON output on stdout: ${line}`));
            return;
        }
        const request = pending.get(response.id);
        if (request) {
            clearTimeout(request.timer);
            pending.delete(response.id);
            request.resolve(response);
        }
    });
    t.after(async () => {
        lines.close();
        if (child.exitCode === null && child.signalCode === null) {
            const exited = new Promise(resolveExit => child.once('exit', resolveExit));
            child.kill();
            await exited;
        }
    });
    const request = (method, params) => new Promise((resolveResponse, reject) => {
        if (failure) {
            reject(failure);
            return;
        }
        const id = ++nextId;
        const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`Timed out waiting for ${method}: ${stderr}`));
        }, 10000);
        pending.set(id, { resolve: resolveResponse, reject, timer });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
    return {
        request,
        notify: (method) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n'),
        call: (name, args) => request('tools/call', args === undefined ? { name } : { name, arguments: args }),
    };
}

function resultData(response) {
    assert.equal(response.error, undefined);
    assert.notEqual(response.result.isError, true);
    assert.equal(response.result.content[0].type, 'text');
    return JSON.parse(response.result.content[0].text);
}

test('MCP tool calls over stdio', async t => {
    const client = startServer(t);
    const initialized = await client.request('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'vk-docs-mcp-tests', version: '1.0.0' },
    });
    assert.equal(initialized.error, undefined);
    client.notify('notifications/initialized');

    await t.test('advertises all six tools and nonblank required strings', async () => {
        const { result } = await client.request('tools/list', {});
        assert.deepEqual(result.tools.map(tool => tool.name).sort(), [
            'vk_api_get_method', 'vk_api_list', 'vk_api_search',
            'vk_bridge_get_method', 'vk_bridge_list', 'vk_bridge_search',
        ]);
        for (const tool of result.tools) {
            for (const key of tool.inputSchema.required || []) {
                const schema = tool.inputSchema.properties[key];
                assert.equal(schema.minLength, 1);
                assert.equal(new RegExp(schema.pattern).test('   '), false);
                assert.equal(new RegExp(schema.pattern).test('users.get'), true);
            }
        }
    });

    await t.test('optional arguments can be omitted or empty', async () => {
        for (const name of ['vk_api_list', 'vk_bridge_list']) {
            const omitted = resultData(await client.call(name));
            assert.ok(omitted.length > 0);
            assert.deepEqual(resultData(await client.call(name, {})), omitted);
        }
        for (const [name, directory] of [['vk_api_list', 'vk-reference'], ['vk_bridge_list', 'vk-bridge']]) {
            const expectedIds = readdirSync(resolve(root, 'data', directory))
                .filter(file => file.endsWith('.json')).map(file => file.slice(0, -5)).sort();
            assert.deepEqual(resultData(await client.call(name)).map(method => method.id).sort(), expectedIds);
        }
    });

    await t.test('successful searches and lookups retain their data shapes', async () => {
        const bridge = resultData(await client.call('vk_bridge_get_method', { slug: 'VKWebAppInit' }));
        assert.equal(bridge.id, 'vkwebappinit');
        assert.ok(Array.isArray(bridge.params));
        const api = resultData(await client.call('vk_api_get_method', { name: 'users.get' }));
        assert.equal(api.id, 'users.get');
        assert.ok(Array.isArray(api.params));
        assert.ok(resultData(await client.call('vk_bridge_search', { query: 'VKWebAppInit' }))
            .some(method => method.id === 'vkwebappinit'));
        const results = resultData(await client.call('vk_api_search', { query: 'users.get', group: 'users' }));
        assert.ok(results.some(method => method.id === 'users.get'));
        assert.ok(results.every(method => method.group === 'users'));
        assert.deepEqual(Object.keys(results[0]).sort(), ['description', 'group', 'id', 'url']);
    });

    await t.test('trims queries, identifiers and optional groups', async () => {
        const cases = [
            ['vk_bridge_search', { query: ' VKWebAppInit ' }, { query: 'VKWebAppInit' }],
            ['vk_bridge_get_method', { slug: ' VKWebAppInit ' }, { slug: 'VKWebAppInit' }],
            ['vk_api_search', { query: ' users.get ', group: ' users ' }, { query: 'users.get', group: 'users' }],
            ['vk_api_get_method', { name: ' users.get ' }, { name: 'users.get' }],
            ['vk_api_list', { group: ' USERS ' }, { group: 'users' }],
            ['vk_api_list', { group: '   ' }, {}],
        ];
        for (const [name, padded, normal] of cases) {
            assert.deepEqual(resultData(await client.call(name, padded)), resultData(await client.call(name, normal)), name);
        }
    });

    await t.test('invalid arguments and unknown tools have InvalidParams errors', async () => {
        for (const [name, key] of [
            ['vk_bridge_search', 'query'], ['vk_bridge_get_method', 'slug'],
            ['vk_api_search', 'query'], ['vk_api_get_method', 'name'],
        ]) {
            for (const args of [undefined, {}, { [key]: 123 }, { [key]: '' }, { [key]: ' \t\n ' }]) {
                const response = await client.call(name, args);
                assert.equal(response.error?.code, -32602, `${name}: ${JSON.stringify(args)}`);
            }
        }
        assert.equal((await client.call('vk_api_list', { group: 123 })).error?.code, -32602);
        // Malformed MCP envelopes are rejected by the SDK before our handler.
        for (const args of [null, [], 'invalid', 123]) {
            assert.ok((await client.call('vk_api_list', args)).error);
            assert.ok((await client.call('vk_bridge_list', args)).error);
        }
        assert.equal((await client.call('no_such_tool', {})).error?.code, -32602);
        // A bad call must not stop later calls on the same connection.
        assert.ok(resultData(await client.call('vk_bridge_list')).length > 0);
    });

    await t.test('missing methods are tool errors, including path-like identifiers', async () => {
        for (const [name, key, search] of [
            ['vk_bridge_get_method', 'slug', 'vk_bridge_search'],
            ['vk_api_get_method', 'name', 'vk_api_search'],
        ]) {
            for (const missing of ['does-not-exist', '../../package.json']) {
                const response = await client.call(name, { [key]: missing });
                assert.equal(response.error, undefined);
                assert.equal(response.result.isError, true);
                assert.match(response.result.content[0].text, /^Метод не найден/);
                assert.ok(response.result.content[0].text.includes(search));
            }
        }
    });

    await t.test('bridge lookup prefers exact matches and rejects ambiguous fragments', async () => {
        assert.equal(resultData(await client.call('vk_bridge_get_method', { slug: 'vkwebappinit' })).id, 'vkwebappinit');
        assert.equal(resultData(await client.call('vk_bridge_get_method', { slug: 'VKWebAppGetUserInfo' })).id, 'vkwebappgetuserinfo');
        // A unique title fragment still resolves.
        assert.equal(resultData(await client.call('vk_bridge_get_method', { slug: 'Быстрый старт' })).id, 'getting-started');
        // Fragments shared by many pages must not silently pick an arbitrary one.
        for (const slug of ['VKWebAppShow', 'VK Bridge', 'vk']) {
            assert.equal((await client.call('vk_bridge_get_method', { slug })).result.isError, true, slug);
        }
    });
});

test('README OpenCode examples match the 1.x and 2.x config layouts', () => {
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    const examples = [...readme.matchAll(/```json\s*([\s\S]*?)```/g)].map(match => JSON.parse(match[1]));
    const opencode = examples.filter(example => example.mcp);
    assert.equal(opencode.length, 2);
    const [v1, v2] = opencode;
    // 1.x: servers directly under mcp.
    assert.equal(v1.mcp.servers, undefined);
    assert.equal(v1.mcp['vk-docs'].type, 'local');
    assert.equal(v1.mcp['vk-docs'].command[0], 'node');
    // 2.x: servers under mcp.servers; `enabled` was replaced by `disabled`.
    assert.deepEqual(Object.keys(v2.mcp), ['servers']);
    const server = v2.mcp.servers['vk-docs'];
    assert.equal(server.type, 'local');
    assert.deepEqual(server.command, v1.mcp['vk-docs'].command);
    assert.equal(server.enabled, undefined);
    assert.notEqual(server.disabled, true);
    assert.ok(readme.includes(`opencode mcp add vk-docs -- node "${server.command[1]}"`));
});

test('README Codex and Claude Code examples use the same stdio entry point', () => {
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    const examples = [...readme.matchAll(/```json\s*([\s\S]*?)```/g)].map(match => JSON.parse(match[1]));
    const expectedPath = examples.find(example => example.mcp).mcp['vk-docs'].command[1];
    const claude = examples.find(example => example.mcpServers).mcpServers['vk-docs'];
    assert.deepEqual(claude, { type: 'stdio', command: 'node', args: [expectedPath] });
    // Check the documented minimal TOML shape without adding a parser dependency.
    const toml = readme.match(/```toml\s*([\s\S]*?)```/)[1];
    assert.match(toml, /^\[mcp_servers\.vk-docs\]\r?\ncommand = "node"\r?\n/);
    assert.deepEqual(JSON.parse(toml.match(/^args = (.+)$/m)[1]), [expectedPath]);
    assert.ok(readme.includes(`codex mcp add vk-docs -- node "${expectedPath}"`));
    assert.ok(readme.includes(`claude mcp add --transport stdio --scope local vk-docs -- node "${expectedPath}"`));
});
