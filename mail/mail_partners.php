<?php
/**
 * Обработчик формы «Заявка на партнёрство».
 *
 * Принимает POST с полями формы, проверяет Яндекс SmartCaptcha и отправляет
 * письмо на тот же ящик, что и форма на smmconfa.ru (info@smmconfa.ru).
 *
 * Ответы:
 *   {"status":"OK"}                 — письмо отправлено;
 *   {"status":"ERROR","message":…}  — ошибка;
 *   captcha                         — капча не пройдена (как в smmconfa.ru).
 */
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

// Ответ всегда JSON: предупреждения не должны попадать в тело ответа.
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED);

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/mail_template.php';
require_once __DIR__ . '/src/Exception.php';
require_once __DIR__ . '/src/PHPMailer.php';
require_once __DIR__ . '/src/SMTP.php';

header('X-Content-Type-Options: nosniff');

/**
 * Отправляет JSON-ответ и завершает обработку.
 */
function pf_respond(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Ответ для непройденной капчи — в формате, который понимает фронтенд.
 */
function pf_captcha_response(): void
{
    http_response_code(200);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'captcha';
    exit;
}

/**
 * Читает и очищает текстовое поле формы.
 */
function pf_field(string $key, int $max): string
{
    $value = $_POST[$key] ?? '';
    if (!is_string($value)) {
        return '';
    }

    $value = trim($value);
    $value = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value) ?? '';
    $value = preg_replace('/\s{2,}/u', ' ', $value) ?? '';

    return function_exists('mb_substr')
        ? mb_substr($value, 0, $max, 'UTF-8')
        : substr($value, 0, $max);
}

/**
 * Проверяет токен Яндекс SmartCaptcha на сервере.
 */
function pf_check_captcha(string $token, array $config): bool
{
    if ($token === '' || $config['captcha_secret'] === '') {
        return false;
    }

    if (!function_exists('curl_init')) {
        error_log('partners-form: расширение curl не установлено');
        return false;
    }

    $url = $config['captcha_verify_url'] . '?' . http_build_query([
        'secret' => $config['captcha_secret'],
        'token' => $token,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 5,
    ]);

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) {
        error_log('partners-form: SmartCaptcha вернула HTTP ' . $httpCode);
        return false;
    }

    $data = json_decode((string) $response, true);

    return is_array($data) && ($data['status'] ?? '') === 'ok';
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    pf_respond(['status' => 'ERROR', 'message' => 'Метод не поддерживается'], 405);
}

// Ловушка для спам-ботов: поле скрыто от людей.
if (trim((string) ($_POST['company_fax'] ?? '')) !== '') {
    pf_respond(['status' => 'OK']);
}

$name = pf_field('name', 120);
$phone = pf_field('phone', 40);
$email = pf_field('email', 190);
$org = pf_field('org', 200);
$budget = pf_field('budget', 120);
$website = pf_field('company_website', 300);
$telegram = pf_field('telegram_contact', 120);
$theme = pf_field('theme', 120);
$access = !empty($_POST['access']);

if ($name === '' || $phone === '' || $email === '' || $org === '' || $budget === '' || !$access) {
    pf_respond(['status' => 'ERROR', 'message' => 'Заполните обязательные поля'], 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    pf_respond(['status' => 'ERROR', 'message' => 'Проверьте адрес e-mail'], 422);
}

$phoneDigits = preg_replace('/\D+/', '', $phone) ?? '';
if (strlen($phoneDigits) < 10) {
    pf_respond(['status' => 'ERROR', 'message' => 'Проверьте номер телефона'], 422);
}

$token = isset($_POST['smart-token']) && is_string($_POST['smart-token'])
    ? trim($_POST['smart-token'])
    : '';

if (!pf_check_captcha($token, $config)) {
    pf_captcha_response();
}

$message = pf_build_email_html('Заявка на партнёрство', [
    'Источник' => $config['source'],
    'Кнопка' => $theme !== '' ? $theme : 'Стать партнёром',
    'Имя' => $name,
    'Телефон' => $phone,
    'E-mail' => $email,
    'Организация' => $org,
    'Бюджет' => $budget,
    'Сайт компании' => $website,
    'Контакт в Telegram' => $telegram,
]);

if ($config['smtp_password'] === '') {
    error_log('partners-form: не задан smtp_password в config.local.php');
    pf_respond(['status' => 'ERROR', 'message' => 'Отправка не настроена'], 500);
}

$mail = new PHPMailer(true);
$mail->CharSet = 'UTF-8';
$mail->Timeout = 15;
$mail->isSMTP();
$mail->Host = $config['smtp_host'];
$mail->SMTPAuth = true;
$mail->Username = $config['smtp_user'];
$mail->Password = $config['smtp_password'];
$mail->SMTPSecure = $config['smtp_secure'];
$mail->Port = (int) $config['smtp_port'];

$mail->setFrom($config['from_email'], $config['from_name']);
$mail->addAddress($config['to']);
$mail->addReplyTo($email, $name);

$mail->Subject = $config['subject'];
$mail->msgHTML($message);

try {
    $sent = $mail->send();
} catch (\Exception $error) {
    $sent = false;
    error_log('partners-form: PHPMailer exception: ' . $error->getMessage());
}

if (!$sent) {
    error_log('partners-form: PHPMailer error: ' . $mail->ErrorInfo);
    pf_respond(['status' => 'ERROR', 'message' => 'Не удалось отправить письмо'], 500);
}

pf_respond(['status' => 'OK']);
