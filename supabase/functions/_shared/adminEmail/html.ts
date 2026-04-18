/** Minimal shared HTML wrapper for admin notifications. */

export function adminEmailShell(title: string, innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e4e4e7;">
    <tr>
      <td style="padding:24px 28px;">
        <p style="margin:0 0 16px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">Sommi admin</p>
        <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#18181b;">${escapeHtml(title)}</h1>
        <div style="color:#3f3f46;">${innerHtml}</div>
      </td>
    </tr>
  </table>
  <p style="max-width:560px;margin:16px auto 0;text-align:center;font-size:12px;color:#a1a1aa;">Automated message — do not reply.</p>
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function kvTable(rows: Array<{ label: string; value: string }>): string {
  const tr = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;color:#71717a;width:38%;vertical-align:top;">${escapeHtml(r.label)}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;color:#18181b;vertical-align:top;">${escapeHtml(r.value)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;">${tr}</table>`;
}
