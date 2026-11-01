# Деплой «Суровой премии»

## Куда заливаем

- Дубль для согласования: **https://marketingawards.ru/new/**
- Каталог на хостинге Beget: `/home/n/natafrj5/marketingawards.ru/public_html/new/`
- Основной сайт `marketingawards.ru` (React-сборка в корне) не трогаем — только `/new/`.

## Что заливать

```
index.html
jury.html
css/tokens.css
css/style.css
css/partners-form.css     (стили формы «Стать партнёром»)
js/                       (если менялся)
js/partners-form.js       (логика формы)
mail/                     (обработчик формы, PHPMailer, config.local.php)
img/                      (rumantsev.jpg, topor.png, characters/*.webp, illustrations/*.webp)
logo.svg                  (если менялся)
fonts/                    (только 5 подключённых файлов Dela / Involve / Golos)
```

Шрифты и `js/` обычно уже лежат на сервере — перед заливкой сверить версии
`?v=` в HTML.

## Как заходить

Доступ — SFTP на Beget, порт 22.

| Параметр | Значение |
|---|---|
| Профиль в ftp-mcp | `marketingawards` |
| Хост | `natafrj5.beget.tech` |
| Пользователь | `natafrj5_opencode16` |
| Пароль | хранится в профиле ftp-mcp, в git не коммитить |
| Каталог | `/home/n/natafrj5/marketingawards.ru/public_html/new` |

Подключение в агенте:

```
ftp_connect({ name: "ma", site: "marketingawards" })
```

Профили `surconf`, `surconf7`, `spbprompt`, `online15` и др. к каталогу
`marketingawards.ru` на запись доступа **не имеют** (Permission denied) —
использовать только профиль `marketingawards`.

Пароли в репозиторий не коммитить. Если нужен локальный файл с доступом —
держать рядом `.env.local` (он в `.gitignore`), в этой заметке — только имя профиля.

Секреты формы (`mail/config.local.php`: пароль SMTP и серверный ключ SmartCaptcha)
тоже не коммитятся, но заливаются на сервер вместе с папкой `mail/`.

## Проверка после заливки

```bash
curl -s https://marketingawards.ru/new/ | grep -E 'style.css\?v=|tokens.css\?v='
curl -s -o /dev/null -w '%{http_code}\n' https://marketingawards.ru/new/jury.html
```

Версии `?v=` должны совпасть с локальными в `index.html` и `jury.html`.
Дополнительно открыть страницу в браузере и проверить консоль и картинки
`img/rumantsev.jpg`, `img/characters/1-web-developer.webp`, `img/illustrations/1-briefcase.webp`.
