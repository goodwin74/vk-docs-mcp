# Документация для VKMA (VK Mini Apps) MCP

Локальный MCP-сервер с документацией ВКонтакте для AI-агентов, включая OpenCode, Codex и Claude Code:

- **VK Bridge:** 98 страниц о методах и событиях мини-приложений
- **VK API Reference:** 452 метода в 39 группах

После установки сервер читает JSON-файлы с диска, работает офлайн и не обращается к VK API. Токены и API-ключи VK не нужны. Подключение модели в AI-клиенте настраивается отдельно.

## Быстрый старт

### 1. Подготовить окружение

Нужны [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org/en/download) и npm. Рекомендуется актуальный патч **Node.js 24 LTS**. Минимальная версия — Node.js 20 (поле `engines` в `package.json`); Node.js 18 не подходит. Для новой установки выбирайте [поддерживаемую LTS-ветку](https://nodejs.org/en/about/previous-releases).

Проверьте в терминале:

```sh
git --version
node --version
npm --version
```

Для скачивания репозитория и зависимостей нужен интернет. Команды ниже выполняются построчно в терминале macOS/Linux, PowerShell или cmd на Windows.

### 2. Скачать и установить

Откройте терминал в папке, где хотите хранить сервер:

```sh
git clone https://github.com/goodwin74/vk-docs-mcp.git
cd vk-docs-mcp/mcp-server
npm ci --ignore-scripts
npm test
```

[`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci/) устанавливает зависимости по lock-файлу, не меняя его; `--ignore-scripts` отключает установочные скрипты. Все тесты должны пройти: они проверяют stdio-соединение, список и вызовы шести инструментов, аргументы, ошибки и конфигурацию ниже. Доступ к VK для тестов не нужен.

Автотесты stdio проходят в CI на Linux (Node.js 22 и 24), Windows и macOS (Node.js 24). Настройки клиентов ниже сверены с официальной документацией; подключение через интерфейсы OpenCode, Codex и Claude Code отдельно не проверялось. Наличие записи в конфигурации ещё не подтверждает вызов инструментов.

Важные файлы репозитория:

```text
data/vk-bridge/                # JSON-документация Bridge
data/vk-reference/             # JSON-документация VK API
mcp-server/dist/index.js       # точка входа; рядом dist/loaders/
mcp-server/package.json        # зависимости и npm-команды
mcp-server/package-lock.json   # зафиксированные версии
mcp-server/test/server.test.js # проверки MCP
```

Готовый `dist/` уже включён в репозиторий. **Сборка не нужна:** сейчас в репозитории нет TypeScript-исходников и `tsconfig.json`, хотя скрипт `build` указан в `package.json`. Не используйте `npm run build` для установки.

Сохраняйте `data/` и `mcp-server/` вместе в этой структуре: копирования одного `index.js` недостаточно.

### 3. Проверить ручной запуск

Из той же папки `mcp-server`:

```sh
node dist/index.js
```

Если процесс остаётся запущенным и ничего не печатает, это нормально: сервер ждёт MCP-запросы через stdio. Веб-страницы и HTTP-порта нет. Остановите проверку сочетанием **Ctrl+C**. Дальше выбранный AI-клиент сам запустит сервер; отдельный терминал не нужен.

## Подключение к OpenCode

Используйте установленный OpenCode с настроенной моделью. Откройте существующий `opencode.json` или `opencode.jsonc`. Если конфигурации ещё нет, создайте один из этих файлов:

- **Для одного проекта:** `opencode.json` в корне проекта, с которым работает OpenCode
- **Для всех проектов, macOS/Linux:** `~/.config/opencode/opencode.json`
- **Для всех проектов, Windows:** `%USERPROFILE%\.config\opencode\opencode.json`

JSON и JSONC поддерживаются; расположение и приоритеты описаны в [документации конфигурации](https://opencode.ai/docs/config/). При использовании WSL устанавливайте сервер в той же среде, где запущен OpenCode, и используйте Linux-пути.

### Для версии OpenCode 1.x
Добавьте `vk-docs` внутрь объекта `mcp` верхнего уровня. **Сохраните остальные настройки и MCP-серверы**; если `mcp` уже есть, добавьте запись в него, не создавая второй ключ `mcp`.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "vk-docs": {
      "type": "local",
      "command": ["node", "C:/Users/you/tools/vk-docs-mcp/mcp-server/dist/index.js"],
      "enabled": true
    }
  }
}
```

### Для версии OpenCode 2.x

Если `mcp` и `servers` уже есть, добавьте `vk-docs` в `servers` , не создавая второй ключ `mcp` и `servers`.

```json
"mcp": {
    "servers": {
      "vk-docs": {
        "type": "local",
        "command": ["node", "C:/Users/you/tools/vk-docs-mcp/mcp-server/dist/index.js"],
        "codemode": true
      }
    }
  }
```

Замените второй элемент массива `command` своим **абсолютным путём к файлу**, например:

- Windows: `C:/Users/you/tools/vk-docs-mcp/mcp-server/dist/index.js`
- macOS: `/Users/you/tools/vk-docs-mcp/mcp-server/dist/index.js`
- Linux: `/home/you/tools/vk-docs-mcp/mcp-server/dist/index.js`

В Windows удобно использовать `/`; обратные слэши в JSON нужно удваивать: `C:\\Users\\you\\...`. Путь с пробелами остаётся одним элементом массива; дополнительные кавычки внутри строки не нужны. Вставляйте полный путь, без `~` или `%USERPROFILE%`.

Чтобы получить свой путь как готовую JSON-строку, выполните из `mcp-server`: `node -p "JSON.stringify(require('node:path').resolve('dist/index.js'))"`. Вставьте результат вместе с кавычками вместо второго элемента `command`. Сервер находит `data/` относительно своего файла, поэтому настройка рабочей папки не требуется.

### Проверить подключение

Сохраните конфигурацию и полностью перезапустите OpenCode. Если установлен CLI, выполните из рабочего проекта:

```sh
opencode mcp list
```

Команда показывает [настроенные серверы и состояние подключения](https://opencode.ai/docs/cli/). Убедитесь, что `vk-docs` подключён, затем попросите агента:

> Используй MCP vk-docs: вызови vk_bridge_get_method со slug vkwebappinit и vk_api_get_method с name users.get. Покажи параметры из полученной документации.

Проверьте, что агент действительно вызвал инструменты и получил данные. Пересказ по памяти сам по себе не подтверждает подключение.

## Подключение к Codex

Нужен установленный и настроенный [Codex CLI](https://developers.openai.com/codex/cli/). После общего быстрого старта выше выберите **один** способ настройки.

### Через CLI (для пользователя)

Замените путь своим абсолютным путём к `dist/index.js`:

```sh
codex mcp add vk-docs -- node "C:/Users/you/tools/vk-docs-mcp/mcp-server/dist/index.js"
```

Для macOS используйте `/Users/you/tools/vk-docs-mcp/mcp-server/dist/index.js`, для Linux — `/home/you/tools/vk-docs-mcp/mcp-server/dist/index.js`. Кавычки сохраняют путь с пробелами одним аргументом. Команда добавляет пользовательскую настройку; проектный вариант задаётся файлом ниже.

### Через TOML (альтернатива CLI)

Добавьте секцию в `~/.codex/config.toml` (Windows: `%USERPROFILE%\.codex\config.toml`) либо в `.codex/config.toml` рабочего проекта. Проектная конфигурация загружается только для доверенных проектов. Сохраните остальные секции; уже существующую `mcp_servers.vk-docs` измените, не дублируйте.

```toml
[mcp_servers.vk-docs]
command = "node"
args = ["C:/Users/you/tools/vk-docs-mcp/mcp-server/dist/index.js"]
```

В TOML-примере используйте `/` и полный путь, без `~` или переменных оболочки. В отличие от OpenCode, `command` — строка, а путь находится в `args`.

### Проверить подключение

```sh
codex mcp list
codex mcp get vk-docs
```

Эти команды показывают конфигурацию. Откройте новую сессию `codex`, проверьте активный сервер через `/mcp` и выполните запрос с двумя инструментами из раздела OpenCode выше. Для этого stdio-сервера `codex mcp login` не нужен.

Источник: [MCP в Codex](https://developers.openai.com/codex/mcp).

## Подключение к Claude Code

Нужен установленный и настроенный [Claude Code](https://code.claude.com/docs/en/setup). Используйте тот же сервер из быстрого старта.

### Через CLI (рекомендуется)

Из корня проекта, в котором работаете, выполните с собственным абсолютным путём:

```sh
claude mcp add --transport stdio --scope local vk-docs -- node "C:/Users/you/tools/vk-docs-mcp/mcp-server/dist/index.js"
```

На macOS/Linux подставьте соответствующий путь из раздела Codex. Все параметры клиента стоят **перед `--`**, команда сервера — после него.

Выберите область настройки:

- `--scope local`: только текущий проект, лично для вас; запись в `~/.claude.json`
- `--scope user`: все ваши проекты; запись в `~/.claude.json`
- `--scope project`: файл `.mcp.json` в корне рабочего проекта, пригодный для совместного использования

Для другой области замените `local` в команде; не регистрируйте один сервер во всех областях. При совпадении имени приоритет: local → project → user.

### Через JSON (альтернатива для project)

В существующий `.mcp.json` добавьте `vk-docs` в `mcpServers`, сохранив остальные записи. Если файла нет:

```json
{
  "mcpServers": {
    "vk-docs": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/Users/you/tools/vk-docs-mcp/mcp-server/dist/index.js"]
    }
  }
}
```

Замените путь; правила JSON-экранирования те же, что в OpenCode. Личный абсолютный путь не переносим на компьютеры коллег: согласуйте расположение сервера перед публикацией `.mcp.json`.

### Проверить подключение

```sh
claude mcp list
claude mcp get vk-docs
```

Запустите новую сессию `claude`. Для project-настройки подтвердите доверие к проекту и серверу, если клиент запросит. Проверьте `/mcp` и выполните запрос с двумя инструментами выше.

Источник: [MCP в Claude Code](https://code.claude.com/docs/en/mcp).

## Инструменты

Сервер предоставляет шесть инструментов; клиент может показывать их с префиксом имени сервера.

| Инструмент | Аргументы | Назначение |
|---|---|---|
| `vk_bridge_search` | `query`, например `VKWebAppInit` | Поиск по Bridge |
| `vk_bridge_get_method` | `slug`, например `vkwebappinit` | Полное описание Bridge-метода |
| `vk_bridge_list` | Без аргументов или `{}` | Список страниц Bridge |
| `vk_api_search` | `query`, необязательный `group` | Поиск по VK API |
| `vk_api_get_method` | `name`, например `users.get` | Параметры и результат API-метода |
| `vk_api_list` | Необязательный `group`, например `wall` | Все методы или выбранная группа |

`query`, `slug` и `name` должны быть непустыми строками. Для API используйте полное имя метода, например `messages.send`.

### Подсказка агенту (необязательно)

Чтобы напоминать агенту обращаться к документации, **добавьте** короткое правило в существующий `AGENTS.md` проекта для OpenCode/Codex или в `CLAUDE.md` для Claude Code. Если файла нет, создайте его. Не заменяйте существующие инструкции целиком; [AGENTS.md](AGENTS.md) этого репозитория можно использовать как образец.

```text
Для задач по VK API, VK Bridge и VK Mini Apps сначала используй подходящие
инструменты MCP vk-docs. Если они недоступны, сообщи об этом явно.
```

Это инструкция для модели, а не установка или проверка работоспособности сервера. См. [OpenCode rules](https://opencode.ai/docs/rules/), [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md/) и [Claude Code memory](https://code.claude.com/docs/en/memory).

## Если что-то не работает

- **`node` или `npm` не найден:** проверьте установку Node.js, затем заново откройте терминал и AI-клиент. Если `node` работает только в терминале, выполните `node -p "JSON.stringify(process.execPath)"` и вставьте полученную JSON-строку вместо `"node"`: в первом элементе `command` OpenCode или в строке `command` Codex/Claude Code (для TOML удобно заменить `\\` на `/`).
- **PowerShell блокирует `npm.ps1`:** используйте `npm.cmd ci --ignore-scripts` и `npm.cmd test` или терминал cmd. Политику выполнения PowerShell менять не нужно.
- **`ENOENT ... package.json`:** выполняйте npm-команды в `vk-docs-mcp/mcp-server`, не в корне репозитория.
- **`ERR_MODULE_NOT_FOUND` для SDK/Zod:** выполните `npm ci --ignore-scripts` в `mcp-server`. Если не найден `dist/index.js`, проверьте абсолютный путь и полноту скачанного репозитория.
- **`npm ci` сообщает о несовместимой версии Node.js или lock-файле:** проверьте версию Node.js и что `package.json` и `package-lock.json` взяты из одной версии репозитория. Не удаляйте lock-файл ради обхода ошибки.
- **OpenCode не видит сервер:** проверьте синтаксис JSON, вложенность `mcp.vk-docs`, абсолютный путь и `enabled`. Конфигурация проекта может переопределить глобальную. Перезапустите OpenCode и повторите `opencode mcp list`.
- **Codex не видит сервер:** проверьте `mcp_servers.vk-docs`, путь и доверие к проекту для `.codex/config.toml`; откройте новую сессию и проверьте `/mcp`.
- **Claude Code не видит сервер:** проверьте область настройки и рабочий проект, `mcpServers.vk-docs`, затем `claude mcp get vk-docs`. Ожидающее подтверждение project-сервера завершите в интерактивной сессии.
- **WSL или разные окружения:** Node.js, зависимости и сервер должны быть доступны в среде запуска клиента; в WSL используйте Linux-пути.
- **Сервер подключён, но списки пусты:** проверьте наличие JSON-файлов в `data/vk-bridge/` и `data/vk-reference/` рядом с `mcp-server/`, затем перезапустите клиент. Один пустой результат поиска ещё не означает поломку: попробуйте `vk_bridge_list` или `vk_api_list` без фильтра.
- **Агент не вызывает инструменты:** попросите вызвать конкретный инструмент, как в примере выше, и проверьте, что инструменты `vk-docs` не отключены в настройках клиента или агента.

## Обновление

Дата обновления данных, указанная в репозитории: **04.10.2026**. Это локальная копия документации; сервер не скачивает новые страницы автоматически.

Закройте использующие сервер AI-клиенты и остановите ручной запуск сервера. В корне `vk-docs-mcp` проверьте локальные изменения:

```sh
git status --short
```

Локальные зависимости в `mcp-server/node_modules/` исключены через `.gitignore` и не должны попадать в коммиты. Если вывод не пуст, сначала сохраните свои изменения и новые файлы отдельно или в своём коммите. При чистой рабочей копии обновите текущую отслеживаемую ветку:

```sh
git pull --ff-only
cd mcp-server
npm ci --ignore-scripts
npm test
```

Если Git отказывается от fast-forward или тесты не проходят, остановитесь и разберите ошибку, не используя принудительный сброс. После успешной проверки перезапустите AI-клиент: сервер держит данные в памяти. Если папку репозитория перенесли, обновите путь в конфигурации клиента (`command` или `args`).

## Лицензия и дисклеймер

Текст документации принадлежит VK (dev.vk.com && dev.vk.ru). Репозиторий содержит
локальную копию в структурированном виде для удобства AI-ассистентов.
Официальный источник — https://dev.vk.com &&  https://dev.vk.ru

☕ Сказать спасибо > <a href="https://yoomoney.ru/to/41001412274855">Донат</a>

![donate](https://user-images.githubusercontent.com/15101984/143142406-baacd3e3-e4f9-4a2a-b6bc-466b49181307.gif)
