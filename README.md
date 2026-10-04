# Документация для VKMA (VK Mini Apps) MCP

Локальный MCP-сервер с документацией ВКонтакте для AI агентов (OpenCode и др.)
- **VK Bridge** - 98 страниц (методы `VKWebApp*` для мини-приложений)
- **VK API Reference** - 452 метода (users, groups, messages, wall, photos, market, ads...) в 39 группах

Данные лежат в JSON на диске, сервер работает **оффлайн, быстро и без API-ключей**.

## Установка 

### Шаг 1. Скачать репозиторий в удобную для вас папку

```bash
git clone https://github.com/goodwin74/vk-docs-mcp.git
cd vk-docs-mcp
```

Ноутбук/ПК: нужен [Node.js](https://nodejs.org) 18 или новее (`node -v` в терминале для проверки версии).

### Шаг 2. Установить зависимости

```bash
cd mcp-server
npm install
```

## Подключение (пример для OpenCode)
Найди конфиг OpenCode:

- **Windows:** `%USERPROFILE%\.config\opencode\opencode.jsonc`
- **Linux/macOS:** `~/.config/opencode/opencode.jsonc`

Открой его и добавь секцию `mcp` (если её нет, вставь на верхний уровень):

```json
{
  "mcp": {
    "vk-docs": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/путь/к/vk-docs-mcp/mcp-server/dist/index.js"]
    }
  }
}
```
> ⚠️ В `args` указывай путь **к файлу `dist/index.js`** с абсолютным путём
> (в Windows используй прямые слэши: `C:/Users/you/vk-docs-mcp/...`).
> Если в конфиге уже есть другие ключи (`provider` и т.п.) — не удаляй их,
> просто добавь `"mcp": { ... }` рядом в соответствии с JSON синтаксисом.

Сохрани и перезапусти OpenCode.

## Как пользоваться

В чате просто напиши про VK Bridge\VK Mini Apps, а агент сам вызовет инструменты:

- "... давай будем исопльзовать VK API метод `messages.send`..."
- "Сделай мини-приложение VK: с инициализацией VK Bridge"
- "Давай получим информацию о пользователе через метод VK Bridge VKWebAppGetUserInfo, а друзей через VK API"

Или вызови инструменты явно:

| Инструмент | Аргументы | Что делает |
|---|---|---|
| `vk_bridge_search` | `query` | поиск по VK Bridge |
| `vk_bridge_get_method` | `slug` — напр. `vkwebappinit` | полное описание метода Bridge |
| `vk_bridge_list` | — | все методы Bridge |
| `vk_api_search` | `query`, `group?` | поиск по VK API |
| `vk_api_get_method` | `name` — напр. `users.get` | параметры, типы, результат метода |
| `vk_api_list` | `group?` — напр. `wall` | список методов группы |

### Если возникают проблемы
Если нейросеть в агенте не использует MCP vk-docs, то чтобы модель гарантированно использовала MCP:
Добавь в корень своего проекта `AGENTS.md` (лежит в корне репозитория)

## Обновление документации
Последнее обновление - **04.10.2026**

## Лицензия и дисклеймер

Текст документации принадлежит VK (dev.vk.com && dev.vk.ru). Репозиторий содержит
локальную копию в структурированном виде для удобства AI-ассистентов.
Официальный источник — https://dev.vk.com &&  https://dev.vk.ru

☕ Сказать спасибо > <a href="https://yoomoney.ru/to/41001412274855">Донат</a>

![donate](https://user-images.githubusercontent.com/15101984/143142406-baacd3e3-e4f9-4a2a-b6bc-466b49181307.gif)
