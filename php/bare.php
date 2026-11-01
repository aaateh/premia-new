<?php
/**
 * Полигон: только сцена с огнём, без контента.
 * http://premiya.localhost:8090/php/bare.php
 *
 * Параметры: ?quality=full|1440, ?still=1 — постер, ?debug=1 — панель.
 */

declare(strict_types=1);

$config = require __DIR__ . '/inc/config.php';
$debug  = isset($_GET['debug']);
$still  = isset($_GET['still']);

$quality = isset($_GET['quality']) ? (string) $_GET['quality'] : (string) $config['quality'];
if (!isset($config['desktop'][$quality])) {
    $quality = (string) $config['quality'];
}
$desktop = $config['desktop'][$quality];

$speed = isset($_GET['speed']) ? (float) $_GET['speed'] : (float) $config['rate'];
$speed = max(0.35, min(1.5, $speed));

/** Путь к файлу с меткой версии по времени изменения. */
$asset = static function (string $relativePath): string {
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

$profileSizes = [];
foreach ($config['desktop'] as $key => $profile) {
    $profilePath = __DIR__ . '/' . $profile['video'];
    $profileSizes[$key] = is_file($profilePath) ? (int) filesize($profilePath) : 0;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
header("Content-Security-Policy: default-src 'self'; base-uri 'none'; form-action 'none'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'");
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="<?= htmlspecialchars($config['ground'], ENT_QUOTES) ?>">
    <title>Суровая премия — фон</title>
    <link rel="stylesheet" href="<?= htmlspecialchars($asset('assets/fire.css'), ENT_QUOTES) ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars($asset('assets/bare.css'), ENT_QUOTES) ?>">
</head>
<body>
    <div class="fire-scene<?= $still ? ' is-still' : '' ?>"
         data-fire-scene
         data-still="<?= $still ? '1' : '0' ?>"
         data-rate="<?= htmlspecialchars((string) $speed, ENT_QUOTES) ?>"
         aria-hidden="true">
        <div class="fire-media">
            <picture class="fire-still">
                <source media="(max-width: 600px) and (orientation: portrait)"
                        srcset="<?= htmlspecialchars($config['mobile']['poster'], ENT_QUOTES) ?>">
                <img src="<?= htmlspecialchars($desktop['poster'], ENT_QUOTES) ?>" alt="" fetchpriority="high" decoding="async">
            </picture>

            <video class="fire-video"
                   muted
                   loop
                   playsinline
                   webkit-playsinline
                   preload="metadata"
                   disablepictureinpicture
                   disableremoteplayback
                   data-src-desktop="<?= htmlspecialchars($desktop['video'], ENT_QUOTES) ?>"
                   data-src-mobile="<?= htmlspecialchars($config['mobile']['video'], ENT_QUOTES) ?>"></video>
        </div>

        <canvas class="fire-sparks" aria-hidden="true"></canvas>
    </div>

    <button class="fire-toggle" type="button" data-fire-toggle data-state="paused">
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

<?php if ($debug): ?>
    <aside class="fire-debug">
        <p class="fire-debug__title">Полигон · fire-dense</p>
        <?php foreach ($config['desktop'] as $key => $profile): ?>
            <p><?= (string) $key === $quality ? '→ ' : '' ?><?= htmlspecialchars($profile['label'], ENT_QUOTES) ?>:
                <?= $profile['width'] ?>×<?= $profile['height'] ?> · <?= $formatBytes($profileSizes[$key]) ?></p>
        <?php endforeach; ?>
        <p>Телефон: <?= $config['mobile']['width'] ?>×<?= $config['mobile']['height'] ?> · <?= $formatBytes((int) filesize(__DIR__ . '/' . $config['mobile']['video'])) ?></p>
        <p class="fire-debug__links">
            <a href="?quality=full&amp;debug=1">4K</a>
            <a href="?quality=1440&amp;debug=1">1440</a>
        </p>
    </aside>
<?php endif; ?>

    <script src="<?= htmlspecialchars($asset('assets/background.js'), ENT_QUOTES) ?>" defer></script>
</body>
</html>
