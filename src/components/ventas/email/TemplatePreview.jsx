import { useMemo } from 'react'

function renderBlockToHtml(block) {
  if (!block) return ''

  switch (block.type) {
    case 'header':
      return `
        <tr><td style="padding:24px 32px;text-align:center;">
          <h2 style="margin:0;font-size:22px;font-weight:700;color:#1a1a1a;">${escHtml(block.content)}</h2>
        </td></tr>`

    case 'text':
      return `
        <tr><td style="padding:8px 32px;">
          <p style="margin:0;font-size:14px;line-height:1.7;color:#333333;white-space:pre-wrap;">${escHtml(block.content)}</p>
        </td></tr>`

    case 'cta':
      return `
        <tr><td style="padding:16px 32px;text-align:center;">
          <a href="${escAttr(block.url || '#')}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;padding:10px 28px;background:#2ee59d;color:#000000;
                    font-weight:600;font-size:14px;border-radius:6px;text-decoration:none;">
            ${escHtml(block.content || 'Click aquí')}
          </a>
        </td></tr>`

    case 'image':
      return `
        <tr><td style="padding:8px 32px;text-align:center;">
          <img src="${escAttr(block.content)}" alt="" style="max-width:100%;border-radius:6px;display:block;margin:0 auto;" />
        </td></tr>`

    case 'divider':
      return `
        <tr><td style="padding:16px 32px;">
          <hr style="border:none;border-top:1px solid #e0e0e0;margin:0;" />
        </td></tr>`

    case 'footer':
      return `
        <tr><td style="padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#999999;line-height:1.5;">${escHtml(block.content)}</p>
        </td></tr>`

    default:
      return ''
  }
}

function escHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>')
}

function escAttr(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default function TemplatePreview({ blocks = [], subject = '' }) {
  const srcdoc = useMemo(() => {
    const bodyContent = blocks.map(renderBlockToHtml).join('')

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f5f7;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;
                    box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        ${bodyContent || '<tr><td style="padding:48px 32px;text-align:center;color:#999;font-size:14px;">Sin contenido</td></tr>'}
      </table>
    </td></tr>
  </table>
</body>
</html>`
  }, [blocks, subject])

  return (
    <iframe
      title="Vista previa email"
      srcDoc={srcdoc}
      sandbox="allow-same-origin"
      style={{
        width: '100%',
        minHeight: 400,
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: '#ffffff',
      }}
    />
  )
}
