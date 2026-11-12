# Plugin API v1

Встроенные `builtin.media`, `builtin.audio`, `builtin.transcription` и
`builtin.pinning` включаются независимо через общий менеджер плагинов.
Отключение убирает инструменты, сохраняя данные. Модель Whisper загружается
только по команде пользователя и не переносится политикой синхронизации плагинов.
Байты вложений обслуживаются хостом: обычный доступ к настройкам плагина
не даёт доступа к произвольным файлам заметок.

Рабочий пример находится в `plugins/example/`. Соберите его командой `node scripts/package-plugin.mjs`: получится `artifacts/quick-idea.phosphora`. В настройках выберите один файл `.phosphora`, проверьте разрешения и подтвердите установку. Пакет — ZIP с `manifest.json`, `main.js`, необязательными `style.css` и `assets/`. Отдельные файлы доступны только в режиме разработчика. Код, ресурсы и настройки сохраняются в SQLite и доступны offline.

```js
export async function activate(app) {
  await app.commands.add({
    id: 'hello', name: 'Создать мысль',
    async run() {
      const atom = await app.atoms.create({title: 'Моя мысль'});
      await app.graph.focus(atom.id);
    }
  });
}
```

Manifest: `id`, `name`, `version`, `apiVersion: 1`, `permissions`. Префикс `builtin.` зарезервирован. TypeScript/npm не требуются. Код main.js — ES-модуль с экспортом `activate`. Внешние импорты и сетевые загрузки не разрешены.

Полная типизация: `src/plugins/api.ts`.

Команды получают `run(atomId?, context?)`, где необязательный `context.folderId` — текущая папка представления. Старые команды с одним аргументом совместимы. Дневная запись использует этот контекст для размещения и явного членства в папке, сохраняя контекстную связь вместе с новым атомом. Контекстные действия community-плагинов показываются в меню атома; в общем меню остаются команды и представления.

Настройки manifest поддерживают `boolean`, `text`, `range` (`min`, `max`, `step`, числовой `default`) и `select` (`options: [{value, label}]`, строковый `default`). Требуется разрешение `settings`. Поля проверяются при загрузке плагина. После изменения через панель или `app.settings.set` приходит событие `preferences:plugin-setting` с `{plugin, key}`; значение читается из собственного `app.settings`. Встроенные `builtin.zoom` и `builtin.kanban` используют этот контракт. `app.atoms.setTask(id, taskId, {remove: true})` удаляет одну задачу из Markdown и её metadata, сохраняя остальные строки и историю других задач.

Контракты пяти providers: `src/graph/providers.ts`. Последний включённый provider соответствующего вида становится активным; выключение возвращает предыдущий, включая встроенный. Physics получает тела, связи, настройки, dt и reducedMotion, возвращает тела и energy. Координаты и радиусы — world space; pinned, dragged и boundary контроллер дополнительно защищает от перемещения. Layout возвращает позицию нового атома. Clustering возвращает визуальную проекцию; link reduction — подмножество существующих Links; node weight — радиусы по ID. Встроенный `builtin.graph` использует эти же контракты и выполняет вычисления в graph Worker.

### Инструменты карты

`app.graph.registerMapTool({id, name, kind})` требует разрешение `graph` и возвращает disposer. В community-плагине регистрацию нужно ожидать через `await`. Поддерживаемые `kind`:

- `ambient-lens`: линзы «Сейчас» и «Архив» сохраняют всю карту, приглушая и обесцвечивая остальные атомы. Фильтрация и оформление не изменяют данные или координаты.
- `lasso`: удержание пустого места 550 мс, затем обведение одним пальцем. Отпускание без движения создаёт атом в этой точке. На компьютере также работает Shift + обведение. Второй палец отменяет лассо и начинает pinch. После обведения выделение остаётся на карте без меню. Удержание любого выделенного атома с движением переносит всю выборку, а отпускание без движения открывает обычное меню атома с действиями над всей выборкой. Также работает правый клик; пустое место и Escape снимают выделение.

Несколько регистраций одного вида совместимы: инструмент действует, пока остаётся хотя бы одна регистрация. Выключение плагина автоматически снимает его регистрации. Контракт декларативный: обработчики указателя остаются в приложении и не вызывают RPC во время движения пальца. Встроенные `builtin.ambient` и `builtin.lasso` используют этот публичный API; по умолчанию оба выключены.

### Структурная модель и связанная физика

`app.graph.registerStructuralProvider({id, name, description, physicsId, defaults, arrange})` требует `graph`. `physicsId` — локальный ID зарегистрированного PhysicsProvider этого пакета (либо полный `plugin.id:providerId`). Модель появляется в настройках карты. Выбор связывает её раскладку с указанной физикой; отдельно зарегистрированный непарный PhysicsProvider по-прежнему может заменить физику. Если все модели выключены, сохранённая карта остаётся доступной без симуляции.

`arrange({data, settings, intent, locked})` возвращает `{positions: [{id,x,y}], skeleton: [linkId]}`. Нужна ровно одна конечная позиция для каждого входного Atom; skeleton содержит только существующие Links. `intent` — `resume` при открытии сохранённой карты либо `reflow` при перестройке. При resume координаты не перезаписываются. `locked` перечисляет закреплённые и устойчивые ручные позиции: их координаты должны совпадать со входными. Результат, нарушающий контракт, отклоняется до изменения мира. Камера и перетаскивание не запускают arrange; одиночное добавление использует инкрементальное размещение. Поздний ответ после ручного переноса не применяется.

Bundled `builtin.branch`, `builtin.molecule`, `builtin.compact` используют тот же API. Вычисления раскладки, адаптация к опорам и физика выполняются в Worker. Декларативные поля `manifest.settings` (`boolean`/`text`) доступны на отдельной странице плагина при разрешении `settings`; значения хранятся в пространстве имён плагина.

| Раздел | Методы | Разрешение |
|---|---|---|
| atoms | list, get, search | atoms.read |
| atoms | create, update, setState, delete | atoms.write |
| atoms | registerDraftPolicy | atoms.read + atoms.write + links.read + links.write |
| links | list | links.read |
| links | create, delete | links.write |
| events | on | atoms.read / links.read / graph / settings по событию |
| commands | add | ui |
| types | register | ui |
| graph | focus, registerMapTool, registerStructuralProvider, registerLayout, registerPhysicsProvider, registerLayoutProvider, registerClusteringProvider, registerLinkReductionProvider, registerNodeWeightProvider | graph |

Инкрементальный `LayoutProvider.place` получает `{data, parent?, atom?, targets?}`.
Необязательные `atom` и `targets` содержат новую заметку и идентификаторы всех
намеченных соседей после подготовки draft policies. Старые провайдеры, использующие
только `data` и `parent`, совместимы. Результат — конечные `{x, y}`; неконечные
координаты отклоняются до транзакции сохранения. Явно заданная позиция не заменяется.
| ui | notify, registerContextAction | ui |
| views | register | ui |
| storage | get, set | storage |
| settings | get, set | settings |
| assets | list, read | ресурсы собственного пакета |

Регистрации возвращают disposer. Для community-плагинов все вызовы проходят асинхронный RPC: используйте `await`, в том числе для регистрации и получения disposer. Функции команд, событий, раскладки и render исполняются в изолированном Worker. Команде передаётся ID выбранного атома, если он есть. Render возвращает HTML, который санитизируется; скрипты, стили, изображения и активные внешние ресурсы запрещены.

`atoms.create(input, parentId?)` создаёт атом и контекстную связь одной транзакцией. `setState` поддерживает normal, now, paused, archived. `events.on` получает события atom:create, atom:update, atom:delete, link:create, link:delete после успешного сохранения.

### Подготовка сохранения

### Интерактивные представления

`app.views.register({id, name, render, onAction?})` регистрирует HTML-представление. HTML проходит общий sanitizer; скрипты, inline-обработчики и сетевые ресурсы не исполняются. Кнопка `<button data-action="save">` передаёт `onAction('save', values)`, где `values` содержит строки из input/select/textarea с `data-field="key"`. Не используйте `name` как ключ: sanitizer может удалить его для защиты от DOM clobbering. После успешного callback host заново вызывает render. Пока операция выполняется, элементы формы заблокированы; ошибки показываются внутри панели. Регистрация и callback проверяют разрешение `ui`, операции данных используют свои обычные разрешения. Выключение плагина запрещает дальнейшие callbacks. Встроенные ежедневные задачи используют этот же контракт, без доступа к Core или SQL.

### Подготовка сохранения атома

`await app.atoms.registerDraftPolicy({id, name, prepare})` добавляет правило, которое выполняется внутри очереди сохранения перед записью Atom. Встроенная обработка Markdown-ссылок использует этот же API. `prepare` получает независимую копию `{atom, before, data, parent, add, remove, rejected}`: новый и прежний Atom, текущую карту, ID родителя, явные добавления/удаления связей и отклонённые цели автосвязей.

Верните `{properties?, add?, remove?}`. Properties объединяются с текущими; `add` содержит `{to, relation, source?}`, `remove` — ID связей редактируемого атома. Пустой объект не меняет данные. Изменение входной копии само по себе ничего не сохраняет. Нельзя изменять ID, координаты или чужие атомы через этот результат. Все эффекты и черновик сохраняются одной транзакцией после успешного завершения всей цепочки. Ошибка правила или выключение плагина во время ожидания оставляет данные без изменений; пользователь может повторить сохранение.

Во время `prepare` можно читать свои настройки, но нельзя вызывать `atoms.create/update/delete/setState`, `links.create/delete`, `storage.set` или `settings.set`: вложенная запись нарушила бы атомарность либо заблокировала очередь. Верните эффекты вместо неё. Правила удаляются при disable/uninstall, сохранённые свойства и связи остаются. На данном этапе это API подготовки обычного сохранения; массовый import и position batches не проходят через него.

Хранилище ограничено пространством имён plugin ID, без доступа к SQL. Выключение удаляет регистрации и обработчики. Сохранённые атомы и данные плагина остаются. Отдельные разрешения network/filesystem/sync пока не поддерживаются: manifest с ними отклоняется.

Изоляция: iframe с opaque origin и sandbox allow-scripts содержит только фиксированный bridge. Community-код запускается в отдельном Worker; CSP запрещает сетевые подключения и внешние ресурсы. Callback ограничен ожиданием 5 секунд, API — 100 вызовов в секунду. Это не замена отдельному security audit. Не выдавайте atoms.write коду, которому не доверяете: это разрешение допускает удаление записей.

## Pause modifier

Atoms expose `paused: boolean` independently of `state` (`normal`, `now`, `archived`). Use `await app.atoms.setPaused(id, true)` to pause and `false` to resume. This method requires `atoms.write`, including in the sandbox. Changing state does not clear pause. Repeated pause is idempotent.

API v1 still accepts legacy `setState(id, 'paused')`, `create` and `update` inputs. Core converts them to the independent modifier. Legacy imports and schema-v3 databases use `phosphora.pauseState` when available; otherwise the original state is unknowable and defaults to `normal`. Migrated atoms expose canonical state plus the boolean. SQLite schema v4, full backups, JSON exports and Markdown frontmatter preserve the modifier; Markdown uses `phosphored_paused` alongside the established compatibility keys.

## Command context and bundled settings

Command callbacks may receive `run(atomId?, {folderId?, position?})`.
`position` is the current camera center in world coordinates (`{x, y}`). It is a
placement hint, not a request to create a relationship. Only pass a parent to
`atoms.create(input, parentId)` when an actual semantic relationship is intended.
The daily command uses folder membership and a free location near this hint;
unrelated selected or nearby notes do not become its parent.

Bundled physics controls now use `builtin.physics` scoped settings. Existing
preferences supply defaults without rewriting them at startup. Changes apply one
field at a time; disabling the plugin stops motion while preserving settings and
stored positions. `builtin.appearance` owns the theme settings screen. Existing
disabled plugin choices survive updates; all available plugins start enabled only
in a new workspace.

## Task operations

`atoms.setTask(atomId, taskId, { checked?, recurrence? })` requires `atoms.write`. Recurrence accepts `daily`, `weekly`, or `null` to stop repeating. Task IDs and completion history are stored in the source atom properties under `phosphora.tasks`; Markdown checkboxes remain editable. Stale revisions reject rather than overwriting concurrent edits.

Atom create/update arguments are cloned at the runtime boundary before entering the write queue. Later changes to the supplied objects do not change the queued operation. Atom return values are independent copies, including task metadata/history. Disabled plugin handles reject subsequent calls.
