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
| `mail/PHPMailerAutoload.php`, `mail/class.*.php` | PHPMailer |

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
