<?php
/**
 * Пример локальных секретов. Скопируйте в config.local.php и заполните.
 * config.local.php не коммитится в git и загружается на сервер рядом с config.php.
 */
return [
    // Пароль ящика smmconfa@messengerconf.ru на smtp.beget.com.
    'smtp_password' => '',

    // Серверный ключ Яндекс SmartCaptcha (начинается с ysc2_).
    'captcha_secret' => '',
];
