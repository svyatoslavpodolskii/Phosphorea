# Phosphorea — kinetic product film

Версия v6 добавляет сцену «Продолжай»: QR, одинаковые эмодзи и двусторонний обмен
между телефоном и компьютером без облачного хранилища. Демонстрационный QR
открывает приложение, не содержит настоящего приглашения или секрета.

## Самостоятельный движок для следующих роликов

Папка `film/` работает отдельно от исходников приложения. В ней есть сцены,
таймлайн, Canvas-движок, музыка и саунд-дизайн, исходные семплы с лицензиями,
иконки, предпросмотр, рендер в MP4 и проверка готового файла. Node.js 22+,
Python 3.10+ и интернет нужны при первой установке зависимостей.

Распакуйте архив, откройте терминал внутри `film` и выполните:

```sh
npm ci
npx playwright install chromium
python -m pip install -r requirements.txt
npm run score
npm run stills
npm run render
npm run verify
```

На Windows, если PowerShell запрещает `npm.ps1`, используйте `npm.cmd` и `npx.cmd`.
`npm run preview` открывает локальный сервер: http://127.0.0.1:4307. Для просмотра
перейдите по адресу в браузере. Пробел запускает и останавливает ролик, нижняя
панель переключает сцены и время.

Для нового тизера редактируйте `timeline.json` и нужные файлы в `shots/`.
Порядок и длительность сцен независимы; 0,6 секунды — один удар текущей музыки.
При удалении музыкальных опорных сцен обновите их ID в `score.py`.
Все результаты попадают в `output/`; они не публикуются в Git.

`npm run archive` создаёт `output/Phosphorea_Video_Engine.zip`: только переносимый
движок, исходники и исходные материалы, без видео, зависимостей и кэшей.

87 seconds · 1080 × 1920 (9:16) · 60 fps · stereo. A single atom grows into a personal
world: thoughts, people, projects, tasks and ideas. Latest product name and
“Обычные” terminology are used rather than the older wording in the brief.

## Deliverables

- `output/Phosphorea_Kinetic_Film_v5_1080x1920_60fps.mp4` — H.264 / AAC master.
- `output/master.wav` — final stereo soundtrack.
- `output/music.wav`, `output/foley.wav` — separate, editable stems.
- `output/contact-1.jpg`, `output/contact-2.jpg` — scene proofs.
- `timeline.json` — shot order and durations.
- `shots/` — independently replaceable scene modules.
- `cue-sheet.json` — music timing and foley anchors.
- `CREDITS.md` — attribution to retain when publishing.

## Preview / render

From the repository root, with existing npm dependencies and Python + numpy,
Pillow, imageio-ffmpeg installed:

```powershell
python film/score.py
node film/render.mjs --stills
python film/contact-sheet.py
node film/render.mjs
```

For interactive scrubbing, serve this directory (`python -m http.server 4307
--directory film`) and open `http://127.0.0.1:4307`. Space starts/pauses playback.

## Editing

Reorder, remove or duplicate entries in `timeline.json`; the player computes
start times from durations. Action titles are separate `title` shots, with no
text overlay on the feature demonstration. A shot's `sourceDuration` retains its internal timing,
so changing `duration` retimes that module without rewriting it. Use durations
in multiples of 0.3 / 0.6 seconds for the musical grid. Regenerate the score and
render after editing. Keep the IDs marking the major musical acts, or update
their mappings in `score.py`. Individual modules can be replaced independently.

This is a vector-directed reconstruction of the actual product, not a screen
recording or a promise that every cinematic transition exists in the app. The
graph → Kanban transition is film staging. No product data
is opened or modified. Graph content is fictional, human-readable demonstration
data. The initial world contains 840 notes across six connected life areas;
the final world expands it to 10,940 notes in compact regions, with additional regions extending
beyond the portrait frame. Its artwork is cached once for a continuous pullback.

The score uses a 100 BPM grid, adding eighths, sixteenths, cello and restrained
percussion as life grows busier. Acoustic tails bridge the rhythmic release
before the large world reveal. Low, staggered soft attacks and long stereo tails
replace the simultaneous logo chord. No voiceover, stock
trailer track, generic crossfade sequence or exposed Markdown typing.

Формат: 1080×1920, 9:16, 60 fps. Основная тема — чёрно-белая контрастная. World — неоднородный граф с циклами, несколькими центрами связности и мостами между областями.
