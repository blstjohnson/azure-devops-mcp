# Настройка MCP для Azure DevOps

Эта страница описывает пошаговый процесс выпуска Personal Access Token (PAT) в Azure DevOps Server, настройку MCP с использованием этого PAT, доступные инструменты MCP сервера

## 1. Выдача Personal Access Token (PAT) в Azure DevOps Server

1. **Войдите в Azure DevOps**: Откройте ваш приватный экземпляр Azure DevOps Server по адресу `https://tfs.ekassir.com/eKassirProjectCollection` в браузере и войдите под своей учетной записью.
2. **Перейдите к настройкам пользователя**: В правом верхнем углу экрана нажмите на иконку пользователя и выберите "User settings" (Настройки пользователя).
3. [**Откройте Personal Access Tokens**: В меню "Security" (Безопасность) слева найдите и кликните на "Personal access tokens" (Персональные токены доступа).](https://tfs.ekassir.com/eKassirProjectCollection/_usersSettings/tokens)
4. **Создайте новый токен**: Нажмите кнопку "New Token" (Новый токен).
5. **Настройте токен**:
   * **Name** (Имя): Присвойте токену осмысленное имя (например, "Roo Code Azure DevOps MCP Access").
   * **Organization**: Выберите организацию, для которой будет действовать токен (например, `eKassirProjectCollection`).
   * **Expiration** (Срок действия): Установите срок действия токена. Рекомендуется выбирать кратчайший возможный срок действия, соответствующий вашим потребностям в безопасности (например, 30, 60, 90 дней или "Custom defined").
   * **Scopes** (Области действия): Предоставьте необходимые права для MCP. Для полного доступа к Azure DevOps tools выберите "Full access" (Полный доступ). В противном случае, выберите конкретные области, такие как `Code (Read & Write)`, `Build (Read & Execute)`, `Release (Read & Manage)`, `Work Items (Read, Write, & Manage)`.
6. **Создайте и скопируйте токен**: Нажмите "Create" (Создать). Azure DevOps сгенерирует PAT. **Обязательно скопируйте его сразу!** Токен будет показан только один раз, и его невозможно будет восстановить.

## 2. Настройка MCP с использованием PAT

Для настройки MCP сервера `azure-devops-remote` в файле '.roo/mcp.json' используйте скопированный PAT.

Этот файл нужно положить в проекте, по пути .roo/mcp.json (для проекта) или глобально (в плагине нажать на три точки → Edit Global MCP)
Конфигурация общая, для любых агентских утилит, для конкретного инструмента обратитесь к документации.

Пример конфигурации:

```json
{
  "mcpServers": {
    "azure-devops-remote": {
      "type": "streamable-http",
      "url": "https://mcp-tfs.ekassir.com/mcp/", 
      "headers": {
        "Authorization": "Bearer <YOUR_PAT_HERE>"
      },
      "disabled": false
    }
  }
}
```

**Важные моменты:**

* Замените `<YOUR_PAT_HERE>` на ваш фактический PAT.
* Убедитесь, что 'url' заканчивается слэшем.

## 3. Доступные инструменты MCP сервера (azure-devops-remote)

Для `azure-devops-remote` сервера доступны следующие инструменты:

* `core_list_projects`: Получить список проектов в вашей организации Azure DevOps.
* `build_get_definitions`: Получить список определений сборок для заданного проекта.
* `build_run_build`: Запустить новую сборку для указанного определения.
* `repo_create_pull_request`: Создать новый запрос на вытягивание (pull request).
* `wit_create_work_item`: Создать новый рабочий элемент.
* `wit_update_work_item`: Обновить рабочий элемент по ID.

(Это лишь часть доступных инструментов. Полный список можно найти в документации!)