<?php
/**
 * Тест: первые два тёмных экрана и шапка из /new/ поверх огня.
 * http://premiya.localhost:8090/php/
 *
 * Огонь показывается только после полной загрузки ролика; на слабом
 * устройстве, при экономии трафика или reduced-motion — просто чёрный фон.
 *
 * Параметры: ?quality=full|1440, ?fire=off — принудительно чёрный фон,
 * ?debug=1 — панель с весом файлов и состоянием загрузки.
 */

declare(strict_types=1);

$config  = require __DIR__ . '/inc/config.php';
$debug   = isset($_GET['debug']);
$fireOff = isset($_GET['fire']) && $_GET['fire'] === 'off';

$quality = isset($_GET['quality']) ? (string) $_GET['quality'] : (string) $config['quality'];
if (!isset($config['desktop'][$quality])) {
    $quality = (string) $config['quality'];
}
$desktop = $config['desktop'][$quality];

$speed = isset($_GET['speed']) ? (float) $_GET['speed'] : (float) $config['rate'];
$speed = max(0.35, min(1.5, $speed));

/** Ссылка на ассет с меткой версии. */
$asset = static function (string $relativePath): string {
    $root = dirname(__DIR__);
    $path = $root . '/' . $relativePath;
    $stamp = is_file($path) ? filemtime($path) : 0;

    return '/' . $relativePath . ($stamp ? '?v=' . $stamp : '');
};

/** Ссылка на файл внутри php/. */
$fireAsset = static function (string $relativePath): string {
    $path = __DIR__ . '/' . $relativePath;
    $stamp = is_file($path) ? filemtime($path) : 0;

    return $relativePath . ($stamp ? '?v=' . $stamp : '');
};

/** Человекочитаемый вес файла. */
$formatBytes = static function (int $bytes): string {
    if ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 1, ',', ' ') . ' МБ';
    }

    return (int) round($bytes / 1024) . ' КБ';
};

$videoPath = __DIR__ . '/' . $desktop['video'];
$videoSize = is_file($videoPath) ? (int) filesize($videoPath) : 0;

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
header("Content-Security-Policy: default-src 'self'; base-uri 'none'; form-action 'none'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'");
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Суровая премия — фон первых экранов</title>
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="<?= htmlspecialchars($config['ground'], ENT_QUOTES) ?>">
    <link rel="icon" href="/favicon.png">
    <link rel="stylesheet" href="<?= htmlspecialchars($asset('css/tokens.css'), ENT_QUOTES) ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars($asset('css/style.css'), ENT_QUOTES) ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars($fireAsset('assets/fire.css'), ENT_QUOTES) ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars($fireAsset('assets/landing.css'), ENT_QUOTES) ?>">
</head>
<body>

<?php if (!$fireOff): ?>
    <div class="fire-scene fire-scene--dim"
         data-fire-scene
         data-wait="full"
         data-rate="<?= htmlspecialchars((string) $speed, ENT_QUOTES) ?>"
         aria-hidden="true">
        <div class="fire-media">
            <video class="fire-video"
                   muted
                   loop
                   playsinline
                   webkit-playsinline
                   preload="auto"
                   disablepictureinpicture
                   disableremoteplayback
                   data-src-desktop="<?= htmlspecialchars($desktop['video'], ENT_QUOTES) ?>"
                   data-src-mobile="<?= htmlspecialchars($config['mobile']['video'], ENT_QUOTES) ?>"></video>
        </div>

        <canvas class="fire-sparks" aria-hidden="true"></canvas>
    </div>
<?php endif; ?>

<div class="site">
    <header class="header">
        <div class="wrap header__inner">
            <a class="logo" href="#" aria-label="Суровая премия — на главную">
                <img class="logo__img" src="/logo.svg" alt="Суровая премия" width="230" height="45">
            </a>

            <nav class="nav" id="nav">
                <ul class="nav__list">
                    <li><a href="#about">О премии</a></li>
                    <li><a href="#nominations">Номинации</a></li>
                    <li><a href="#pricing">Стоимость</a></li>
                    <li><a href="#partners">Стать партнёром</a></li>
                    <li><a href="#contacts">Контакты</a></li>
                </ul>
                <a class="btn btn--sm" href="#pricing">Подать заявку</a>
            </nav>

            <a class="btn btn--sm header__cta" href="#pricing">Подать заявку</a>

            <button class="burger" type="button" id="burger" aria-label="Меню" aria-expanded="false" aria-controls="nav">
                <span></span><span></span><span></span>
            </button>
        </div>
    </header>

    <main>
        <!-- Первый экран -->
        <section class="hero" id="top">
            <div class="wrap">
                <h1 class="hero__brand">
                    <img class="hero__logo" src="/logo.svg" alt="" width="230" height="45">
                    <span class="sr-only">Суровая премия</span>
                </h1>

                <p class="hero__sub" data-slogan><span data-slogan-line>Получи свой Оскар</span><br>в маркетинге</p>

                <div class="hero__bottom">
                    <div class="hero__main">
                        <div class="hero__text">
                            <p class="lead">Профессиональная премия в сфере интернет-маркетинга и SMM от команды Сурового Питерского форума.</p>
                            <p class="lead">За каждым сильным кейсом стоят люди. Представьте свой проект экспертному жюри и поборитесь за профессиональное признание результатов вашей работы.</p>
                        </div>
                    </div>

                    <aside class="hero__aside">
                        <div class="hero__cta">
                            <a class="btn" href="#pricing">Подать заявку</a>
                            <a class="btn btn--ghost" href="#nominations">Смотреть номинации</a>
                        </div>

                        <div class="dates-line">
                            <div class="dates-line__label">Приём заявок</div>
                            <div class="dates-line__value">24 октября 2026 — 17 марта 2027</div>
                        </div>
                        <div class="dates-line">
                            <div class="dates-line__label">Церемония награждения</div>
                            <div class="dates-line__value">28 апреля 2027</div>
                        </div>
                    </aside>
                </div>
            </div>
        </section>

        <!-- Второй экран -->
        <section class="section" id="about">
            <div class="wrap">
                <div class="section-head">
                    <span class="eyebrow">О премии</span>
                    <h2>О Суровой премии</h2>
                </div>
                <div class="grid grid--2 about">
                    <div>
                        <p>Суровая премия — профессиональный конкурс для специалистов, агентств и компаний, которые реализуют проекты в интернет-маркетинге и SMM.</p>
                        <p style="margin-top:16px">Здесь можно представить собственную работу как специалиста или конкретный проект команды: рекламную кампанию, контент, комплексный SMM или маркетинг в определённой отрасли.</p>
                    </div>
                    <div>
                        <p>Основа участия — кейс с подтверждёнными результатами. Экспертное жюри рассмотрит представленные работы, сформирует шорт-лист и определит победителей в номинациях.</p>
                    </div>
                </div>
            </div>
        </section>
    </main>
</div>

<?php if (!$fireOff): ?>
    <button class="fire-toggle" type="button" data-fire-toggle data-state="paused" hidden>
        <span class="sr-only" data-fire-label>Пауза фона</span>
        <svg class="fire-icon fire-icon--pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 6v12M15 6v12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        <svg class="fire-icon fire-icon--play" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 6.5 18 12l-9 5.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        </svg>
    </button>

    <div class="fire-speed" data-fire-speed>
        <label for="fire-speed">Скорость огня</label>
        <input id="fire-speed"
               type="range"
               min="0.35"
               max="1.5"
               step="0.05"
               value="<?= htmlspecialchars(number_format($speed, 2, '.', ''), ENT_QUOTES) ?>"
               data-fire-speed-input>
        <output for="fire-speed" data-fire-speed-out><?= htmlspecialchars(number_format($speed, 2, ',', ''), ENT_QUOTES) ?>×</output>
    </div>
<?php endif; ?>

<?php if ($debug): ?>
    <aside class="fire-debug">
        <p class="fire-debug__title">Тест · огонь под шапкой и двумя экранами</p>
        <p>Профиль: <?= htmlspecialchars($desktop['label'], ENT_QUOTES) ?>,
            <?= $desktop['width'] ?>×<?= $desktop['height'] ?> · <?= $formatBytes($videoSize) ?></p>
        <p>Показ огня:
            <span class="fire-debug__status" data-fire-status><?= $fireOff ? 'выключен (?fire=off)' : 'ждём полную загрузку' ?></span></p>
        <p class="fire-debug__links">
            <a href="?debug=1">4K</a>
            <a href="?quality=1440&amp;debug=1">1440</a>
            <a href="?fire=off&amp;debug=1">чёрный фон</a>
        </p>
    </aside>
<?php endif; ?>

<script src="<?= htmlspecialchars($fireAsset('assets/slogan.js'), ENT_QUOTES) ?>" defer></script>
<script src="<?= htmlspecialchars($asset('js/star-border.js'), ENT_QUOTES) ?>"></script>
<script src="<?= htmlspecialchars($asset('js/app.js'), ENT_QUOTES) ?>"></script>
<?php if (!$fireOff): ?>
    <script src="<?= htmlspecialchars($fireAsset('assets/background.js'), ENT_QUOTES) ?>" defer></script>
<?php endif; ?>
</body>
</html>
