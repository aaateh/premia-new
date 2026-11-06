<?php
/**
 * Настройки формы «Заявка на партнёрство».
 *
 * Секреты (пароль SMTP и серверный ключ SmartCaptcha) лежат в config.local.php —
 * он не коммитится в git. Публичный ключ капчи задаётся в index.html.
 */
declare(strict_types=1);

$config = [
    // Куда приходит заявка — тот же ящик, что и у формы на smmconfa.ru.
    'to' => 'info@smmconfa.ru',

    // Тема письма: меняем домен, по которому пришла заявка.
    'subject' => 'Суровая премия — Заявка на партнёрство',
    'source' => 'premiya-site',

    // Отправитель: рабочий ящик на SMTP Beget.
    'from_email' => 'smmconfa@messengerconf.ru',
    'from_name' => 'Суровая премия',

    'smtp_host' => 'smtp.beget.com',
    'smtp_port' => 465,
    'smtp_secure' => 'ssl',
    'smtp_user' => 'smmconfa@messengerconf.ru',
    'smtp_password' => '',

    // Серверный ключ Яндекс SmartCaptcha.
    'captcha_secret' => '',
    'captcha_verify_url' => 'https://smartcaptcha.yandexcloud.net/validate',
];

$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
    $overrides = require $local;
    if (is_array($overrides)) {
        $config = array_replace($config, $overrides);
    }
}

return $config;
