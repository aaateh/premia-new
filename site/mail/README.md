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

- PHP **8.5**.
- Корневой `.htaccess` сборки уже разрешает PHP только для `mail/mail_partners.php`
  и документов в `docs/`; остальные `.php` закрыты.
- В CSP (там же в `.htaccess`) разрешены `https://smartcaptcha.yandexcloud.net`
  и `https://smartcaptcha.cloud.yandex.ru`.
- На новом домене нужно добавить его в список разрешённых доменов SmartCaptcha
  в консоли Яндекса, иначе капча не отрисуется.

## Отправка

- Получатель: `info@smmconfa.ru` — тот же ящик, что у формы на smmconfa.ru.
- Тема: `Суровая премия — Заявка на партнёрство`.
- Отправитель: `smmconfa@messengerconf.ru`, SMTP Beget.
- В письме есть источник `premiya-site` и кнопка, с которой пришла заявка.

## Капча

- Яндекс SmartCaptcha, та же капча, что на smmconfa.ru.
- Публичный ключ — в `data-sitekey` у `#pf-captcha` в `index.html`.
- Серверный ключ — в `mail/config.local.php`.
- Перед заливкой на новый домен проверить, что домен добавлен в список
  разрешённых в консоли SmartCaptcha.

## Деплой

1. Залить содержимое папки `site/` в корень сайта (`public_html/`).
2. `mail/config.local.php` заливается вместе с папкой, но в git не коммитится.
   Если его нет — скопировать `config.local.example.php` и заполнить секреты.
3. Проверить `?v=` у CSS/JS и открыть форму на новом адресе.
4. Отправить тестовую заявку и убедиться, что письмо пришло на `info@smmconfa.ru`.
