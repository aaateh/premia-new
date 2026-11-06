<?php
/**
 * HTML-шаблон письма с заявкой на партнёрство.
 *
 * @param string $title Заголовок внутри письма.
 * @param array  $rows  Ассоциативный массив [метка => значение].
 * @return string HTML письма.
 */
declare(strict_types=1);

function pf_build_email_html(string $title, array $rows): string
{
    $rowsHtml = '';
    foreach ($rows as $label => $value) {
        $text = ($value !== '' && $value !== null)
            ? htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            : '—';

        $rowsHtml .= '<tr>'
            . '<td style="padding:10px 12px;border-bottom:1px solid #DDD9D2;color:#4A4D48;font-size:14px;line-height:1.45;white-space:nowrap;vertical-align:top;">'
            . htmlspecialchars($label, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '</td>'
            . '<td style="padding:10px 12px;border-bottom:1px solid #DDD9D2;color:#25292E;font-size:14px;line-height:1.45;">'
            . $text
            . '</td>'
            . '</tr>';
    }

    return '<!DOCTYPE html>'
        . '<html lang="ru">'
        . '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:0;background-color:#ECE9E3;font-family:Arial,Helvetica,sans-serif;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECE9E3;padding:30px 12px;">'
        . '<tr><td align="center">'
        . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#F5F2EC;border:1px solid #B4B0A9;">'

        // Шапка
        . '<tr>'
        . '<td style="background-color:#080607;padding:24px 30px;">'
        . '<div style="color:#F5F0EB;font-size:20px;font-weight:700;letter-spacing:0.4px;">Суровая премия</div>'
        . '<div style="color:#F56624;font-size:12px;margin-top:5px;letter-spacing:0.06em;">премия в сфере интернет-маркетинга и SMM</div>'
        . '</td>'
        . '</tr>'
        . '<tr><td style="height:3px;background-color:#F56624;font-size:0;line-height:0;">&nbsp;</td></tr>'

        // Заголовок
        . '<tr>'
        . '<td style="padding:24px 30px 10px;">'
        . '<div style="color:#25292E;font-size:17px;font-weight:700;">' . htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</div>'
        . '</td>'
        . '</tr>'

        // Таблица данных
        . '<tr>'
        . '<td style="padding:0 30px 24px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
        . $rowsHtml
        . '</table>'
        . '</td>'
        . '</tr>'

        // Футер
        . '<tr>'
        . '<td style="background-color:#ECE9E3;padding:18px 30px;border-top:1px solid #D2CEC7;">'
        . '<div style="color:#4A4D48;font-size:11px;line-height:1.55;">'
        . 'Письмо сформировано автоматически с сайта «Суровая премия».<br>'
        . 'Если вы получили его по ошибке, просто проигнорируйте.'
        . '</div>'
        . '</td>'
        . '</tr>'

        . '</table>'
        . '</td></tr>'
        . '</table>'
        . '</body>'
        . '</html>';
}
