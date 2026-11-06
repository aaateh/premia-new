# Деплой «Суровой премии»

## Что где лежит

- **`site/`** — готовый самостоятельный сайт. На хостинг заливается
  **содержимое** этой папки, а не весь репозиторий.
- **`archive/`** — старые версии, эксперименты и исходники. На хостинг
  не попадает.
- **`docs/`** (в корне) — проектные документы, на хостинг не попадает.

## Куда заливаем

Сейчас сайт для согласования живёт на Beget:

- **https://marketingawards.ru/new/**
- Каталог: `/home/n/natafrj5/marketingawards.ru/public_html/new/`
- Основной сайт `marketingawards.ru` (React-сборка в корне) не трогаем.

Новый чистый хостинг: содержимое `site/` заливается в корень домена
(`public_html/`). После переезда адреса документов будут `/docs/oferta`,
`/docs/privacy`, `/docs/consent` — без `/new/`.

## Как заходить на текущий Beget

Доступ — SFTP, порт 22.

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

## Что заливать

Вся папка `site/`:

```
index.html
jury.html
logo.svg
.htaccess
css/                 (10 файлов стилей)
js/                  (10 файлов скриптов)
fonts/               (10 файлов шрифтов + OFL.txt + NOTICE.md)
img/                 (фото, логотип форума, топор, реликвии, жюри)
media/fire/          (ролики 1440 и телефон, постеры)
mail/                (обработчик формы, PHPMailer, config.local.php)
docs/                (постоянные адреса документов → 302 на PDF с Яндекс.Диска)
```

4K-ролик огня в сборку не входит — он лежит в `archive/source-assets/media-4k/`.
На сайте используется 1440 для десктопа и 540 для телефона.

### Требования хостинга

- PHP **8.5**.
- Поддержка `.htaccess` (`mod_rewrite`, `mod_headers`, `mod_expires`).
- В `site/mail/config.local.php` — пароль SMTP и серверный ключ SmartCaptcha.
  Файл в git не коммитится; если его нет, скопировать
  `config.local.example.php` и заполнить.
- Домен нового сайта добавить в список разрешённых доменов SmartCaptcha
  в консоли Яндекса, иначе капча не отрисуется.

Корневой `.htaccess` сборки уже:

- назначает `index.html` главной;
- включает красивые адреса `docs/oferta`, `docs/privacy`, `docs/consent`;
- разрешает PHP только для `mail/mail_partners.php` и документов в `docs/`;
- закрывает `config*.php`, `.md` и служебные файлы;
- задаёт CSP с доменами SmartCaptcha и `media-src 'self' blob:`;
- включает кэш для шрифтов, картинок, видео, CSS и JS.

Секреты формы (`mail/config.local.php`) и пароль хостинга в репозиторий
не коммитить. Если нужен локальный файл с доступом — держать рядом
`.env.local` (он в `.gitignore`).

## Проверка после заливки

```bash
curl -s https://<домен>/ | grep -E 'style.css\?v=|tokens.css\?v='
curl -s -o /dev/null -w '%{http_code}\n' https://<домен>/jury.html
curl -sI https://<домен>/docs/oferta | grep -iE 'HTTP/|location'
```

Версии `?v=` должны совпасть с локальными в `site/index.html` и
`site/jury.html`. Дополнительно открыть страницу в браузере и проверить:

- консоль без ошибок;
- картинки `img/rumantsev.jpg`, `img/jury/rumantsev_dmitriy.jpg`,
  `img/relics-3/1-lantern.webp`;
- огонь на первом экране, прожиг между секциями, жюри на `jury.html`;
- форму «Стать партнёром» — тестовая заявка должна прийти на
  `info@smmconfa.ru`;
- документы в подвале — ответ `302` на PDF с Яндекс.Диска.

## Превью на GitHub Pages

- Адрес: **https://aaateh.github.io/premia-new2/**
- Репозиторий: **https://github.com/aaateh/premia-new2**, ветка `main`, корень `/`.
- Это отдельный репозиторий. Старое превью `aaateh/premia-new` не трогаем.

Публикуется снимок **содержимого `site/`** (а не корня репозитория), без
`mail/`, `archive/`, `.opencode`, `.openchamber`, `opencode.json` и без
4K-ролика. Обновление: пересобрать снимок, закоммитить и запушить в `main`
репозитория `premia-new2`.

Ограничения статического хостинга:

- PHP не выполняется: форма «Стать партнёром» и папка `mail/` на превью
  не отправляют письма.
- Документы `docs/oferta`, `docs/privacy`, `docs/consent` — в снимке вместо
  PHP лежат статические `index.html` с редиректом на Яндекс.Диск.

## Чек-лист запуска на новом домене

- [ ] Залить содержимое `site/` в корень `public_html/`.
- [ ] Включить PHP 8.5 и проверить `.htaccess`.
- [ ] Залить `site/mail/config.local.php` с секретами.
- [ ] Добавить новый домен в SmartCaptcha.
- [ ] Включить HTTPS и проверить редирект с HTTP.
- [ ] Убрать `<meta name="robots" content="noindex, nofollow">` из
      `site/index.html` и `site/jury.html` (сейчас сайт закрыт от индексации).
- [ ] Проверить `?v=`, консоль, огонь, форму и документы.
- [ ] Отправить тестовую заявку и получить письмо.
