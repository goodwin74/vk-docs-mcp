# Инструкции проекта

## ВКонтакте / VK — документация через MCP (обязательно)

В этом проекте подключён MCP-сервер `vk-docs` с локальной документацией VK.

**Правило:** при любом запросе, связанном с ВКонтакте, VK, VK API, VK Bridge,
VK Mini Apps / VKMiniApps / мини-приложениями ВКонтакте / разработкой сервисов
на платформе VK — СНАЧАЛА вызывай инструменты MCP `vk_*`, а не отвечай по памяти.

| Запрос про... | Инструмент |
|---|---|
| Мини-приложения VK, VK Mini Apps, bridge.send, VKWebApp* | `vk_bridge_search`, `vk_bridge_get_method`, `vk_bridge_list` |
| VK API, методы API (users.get, messages.send...), сервисы/бэкенд на VK | `vk_api_search`, `vk_api_get_method`, `vk_api_list` |
| Объекты VK API (поля пользователей, сообществ, вложений, структуры данных) | `vk_objects_search`, `vk_objects_get_object`, `vk_objects_list` |
| Платежи VK (приём оплаты, голоса, подписки, платёжные уведомления, VK Донат) | `vk_payments_search`, `vk_payments_get_page`, `vk_payments_list` |

Примеры запросов, где ОБЯЗАТЕЛЬНО использовать MCP:
- «давай создадим сервис VK Mini Apps» / «сервис на платформе VK Mini Apps»
- «давай создадим мини-приложение для VK» → сначала `vk_bridge_search`/`vk_bridge_list`
- «какие параметры у messages.send» → `vk_api_get_method { name: "messages.send" }`
- «как отправить сообщение из мини-приложения» → `vk_bridge_get_method`
- «как подключить оплату в приложении / принять платежи» → `vk_payments_search` → `vk_payments_get_page`
- «как обработать платёжное уведомление или проверить подпись sig» → `vk_payments_get_page { id: "payments/notifications/vk" }`

Порядок работы над VK-задачей:
1. Через `vk_bridge_*` / `vk_api_*` / `vk_objects_*` / `vk_payments_*` изучи нужную документацию из локальной базы.
2. Только после получения данных из MCP — пиши код/ответ.
3. Если MCP-инструмент недоступен — прямо сообщи об этом пользователю,
   не подменяй документацию памятью модели.

База локальная и оффлайн (`vk-docs-mcp/data/`): 98 страниц VK Bridge + 452 метода VK API + 44 объекта VK API + 10 статей о платежах.
