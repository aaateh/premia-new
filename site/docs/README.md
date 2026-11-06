# Документы премии

Постоянные адреса на сайте:

| Адрес | Документ |
|---|---|
| `/docs/oferta` | Публичная оферта (PDF) |
| `/docs/privacy` | Политика обработки персональных данных (PDF) |
| `/docs/consent` | Согласие на обработку и передачу персональных данных (PDF) |

Те же адреса работают с `.pdf` на конце (через `.htaccess`):
`/docs/oferta.pdf` и т. д.

## Как это работает

`docs/.htaccess` принимает красивый адрес и передаёт его в `docs/index.php`.
Скрипт проверяет документ по белому списку, запрашивает у API Яндекс.Диска
свежую прямую ссылку на PDF и отвечает `302 Found` с этой ссылкой.

Прямые ссылки `downloader.disk.yandex.ru` подписаны и действуют несколько
часов, поэтому их нельзя прописывать в `.htaccess` навсегда. Скрипт берёт
новую при каждом переходе, а постоянными остаются адреса на сайте.

Если API недоступен, скрипт всё равно отвечает `302` — на постоянную
страницу файла в публичной папке Диска. Пользователь не увидит ошибку.

## Файлы

| Файл | Назначение |
|---|---|
| `docs/.htaccess` | Красивые адреса → `index.php` |
| `docs/index.php` | Белый список документов и 302-редирект |
| `docs/oferta/index.php` | Запасной вход `/docs/oferta/` без mod_rewrite |
| `docs/privacy/index.php` | Запасной вход `/docs/privacy/` |
| `docs/consent/index.php` | Запасной вход `/docs/consent/` |
| `docs/README.md` | Эта памятка |

Публичная папка: <https://disk.yandex.ru/d/yL8YoRoXtVvT7w>

## Деплой

Загрузить папку `docs/` в корень сайта (`public_html/docs/`) вместе
с подпапками `oferta/`, `privacy/`, `consent/`. Ссылки в подвале и в форме
согласия относительные (`docs/oferta`, `docs/privacy`, `docs/consent`)
и работают и в корне домена, и в подпапке. `RewriteBase` в `.htaccess`
не задан — правила не зависят от места.

PHP должен быть включён (PHP 8.5). В корневом `.htaccess` сборки PHP
разрешён только для `mail/mail_partners.php` и документов в `docs/`; красивый
адрес `docs/oferta` не содержит `.php`, а внутренняя подстановка
`index.php` выполняется уже внутри `docs/`.

Если хостинг всё же отдаст `403`, проверить, что в корневом `.htaccess`
разрешён `docs/index.php`:

```apache
RewriteRule ^(?:mail/mail_partners|docs/index)\.php$ - [L]
```

## Проверка после заливки

```bash
curl -sI https://<домен>/docs/oferta  | grep -iE 'HTTP/|location'
curl -sI https://<домен>/docs/privacy | grep -iE 'HTTP/|location'
curl -sI https://<домен>/docs/consent | grep -iE 'HTTP/|location'
```

Ожидается `302 Found` и `Location:` на `downloader.disk.yandex.ru`
(или на страницу файла в папке Диска, если API временно недоступен).

## Как обновить документы

Если файл в папке переименован, поправить путь в массиве `DOCUMENTS`
в `docs/index.php`. Адреса на сайте при этом не меняются.
