# Форма «Стать партнёром»

Форма встроена в главную страницу `index.html`:
- ссылка **«Стать партнёром»** в шапке;
- кнопка **«Обсудить партнёрство»** в разделе «Партнёры».

Обе открывают одно модальное окно `#partner-form` с заголовком «Стать партнёром».

## Файлы

| Файл | Назначение |
|---|---|
| `index.html` | разметка модального окна и кнопок |
| `css/partners-form.css` | стили формы |
| `js/partners-form.js` | открытие/закрытие, маска телефона, валидация, отправка |
| `mail/mail_partners.php` | обработчик: проверка капчи и отправка письма |
| `mail/config.php` | получатель, тема, отправитель, SMTP |
| `mail/config.local.php` | секреты (в `.gitignore`), загружается на сервер рядом с `config.php` |
| `mail/src/PHPMailer.php`, `mail/src/SMTP.php`, `mail/src/Exception.php` | PHPMailer 7 (PHP 8.5) |
| `mail/PHPMailer-LICENSE.txt` | лицензия PHPMailer |

## Требования хостинга

- PHP **8.5** (выбран в настройках сайта Beget).
- В корневом `.htaccess` сайта разрешены PHP и POST только для `/new/mail/`,
  а в CSP добавлены `https://smartcaptcha.yandexcloud.net` и
  `https://smartcaptcha.cloud.yandex.ru` (script/connect/frame/img).

### Корневой `.htaccess`

В `/public_html/.htaccess` сайта добавлены исключения только для `/new/mail/`:

```apache
RewriteCond %{REQUEST_URI} !^/new/mail/
RewriteRule "\.(?:php[0-9]?|phtml|pht|phar|cgi)(?:/|$)" - [F,L,NC]

RewriteCond %{REQUEST_URI} !^/new/mail/
RewriteCond %{REQUEST_METHOD} !^(GET|HEAD|OPTIONS)$ [NC]
RewriteRule ^ - [F,L]
```

В CSP добавлены `https://smartcaptcha.yandexcloud.net` и
`https://smartcaptcha.cloud.yandex.ru` в `script-src`, `connect-src`,
`frame-src` и `img-src`.

## Отправка

- Получатель: `info@smmconfa.ru` — тот же ящик, что у формы на smmconfa.ru.
- Тема: `marketingawards.ru — Заявка на партнёрство`.
- Отправитель: `smmconfa@messengerconf.ru`, SMTP Beget.
- В письме есть источник `marketingawards.ru/new` и кнопка, с которой пришла заявка.

## Капча

- Яндекс SmartCaptcha, та же капча, что на smmconfa.ru.
- Домен `marketingawards.ru` добавлен в список разрешённых.
- Публичный ключ — в `data-sitekey` у `#pf-captcha` в `index.html`.
- Серверный ключ — в `mail/config.local.php`.

## Деплой

1. Залить `index.html`, `css/partners-form.css`, `js/partners-form.js` и папку `mail/` в `/new/`.
2. `mail/config.local.php` заливается вместе с папкой, но в git не коммитится.
3. Проверить `?v=` у CSS/JS и открыть форму на `https://marketingawards.ru/new/`.
4. Отправить тестовую заявку и убедиться, что письмо пришло на `info@smmconfa.ru`.
