<?php
/**
 * Настройки фона «Суровой премии».
 *
 * Источник — ролики с marketingawards.ru (вариант fire-dense).
 * Хвост ролика (1,25 с на десктопе, 0,5 с на телефоне) плавно перетекает
 * в начало, поэтому петля идёт без рывка.
 *
 *   desktop full: бесшовный цикл из fire-tall-4k-v3.mp4 — 4096×2160, 27 МБ
 *   desktop 1440: тот же цикл в 1440×760 — 3,4 МБ
 *   mobile:       бесшовный цикл из fire-mobile-portrait-v2.mp4 — 540×1080, 476 КБ
 *
 * По умолчанию отдаётся полное качество. Облегчённый вариант —
 * ?quality=1440 (тот же кадр, меньше вес).
 */

declare(strict_types=1);

return [
    // Цвет сцены — тот же, что у оригинала.
    'ground' => '#080607',

    // Качество по умолчанию: full | 1440
    'quality' => 'full',

    'desktop' => [
        'full' => [
            'label'  => 'Полное качество, 4K',
            'video'  => 'assets/fire-desktop-4k-loop.mp4',
            'poster' => 'assets/fire-desktop-poster-4k.jpg',
            'width'  => 4096,
            'height' => 2160,
        ],
        '1440' => [
            'label'  => 'Облегчённый, 1440',
            'video'  => 'assets/fire-desktop-1440-loop.mp4',
            'poster' => 'assets/fire-desktop-poster-1440.jpg',
            'width'  => 1440,
            'height' => 760,
        ],
    ],

    'mobile' => [
        'video'  => 'assets/fire-mobile-540-loop.mp4',
        'poster' => 'assets/fire-mobile-poster-540.jpg',
        'width'  => 540,
        'height' => 1080,
    ],

    // Скорость по умолчанию: 0.70. Меняется бегунком и ?speed=.
    'rate' => 0.7,
];
