import { writeFileSync } from 'node:fs'

const THEMES = {
    light: {
        surface: '#ffffff', card: '#f6f8fa', border: '#d1d9e0', text: '#1f2328', muted: '#59636e',
        accent: '#0969da', accentSoft: '#ddf4ff', chip: '#ffffff', fail: '#d1242f', pass: '#1a7f37',
    },
    dark: {
        surface: '#0d1117', card: '#151b23', border: '#3d444d', text: '#f0f6fc', muted: '#9198a1',
        accent: '#4493f8', accentSoft: '#0d2a4a', chip: '#0d1117', fail: '#f85149', pass: '#3fb950',
    },
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif"
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const W = 820
const X = 24
const CW = W - 2 * X

const render = (theme) => {
    const t = THEMES[theme]
    const out = []
    const text = (x, y, s, o = {}) =>
        out.push(
            `<text x="${x}" y="${y}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} font-size="${o.size || 13}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.mono ? ` font-family="${MONO}"` : ''} fill="${o.fill || t.text}">${o.raw ? s : esc(s)}</text>`
        )
    const box = (x, y, w, h, o = {}) =>
        out.push(
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 8}" fill="${o.fill || t.card}" stroke="${o.stroke || t.border}" stroke-width="${o.sw || 1}"${o.dash ? ' stroke-dasharray="4 3"' : ''}/>`
        )
    const arrow = (y1, y2, label) => {
        const cx = W / 2
        out.push(
            `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2 - 7}" stroke="${t.muted}" stroke-width="2"/>`,
            `<path d="M${cx - 6} ${y2 - 9}L${cx} ${y2}L${cx + 6} ${y2 - 9}Z" fill="${t.muted}"/>`
        )
        if (label) text(cx + 14, (y1 + y2) / 2 + 4, label, { size: 12, fill: t.muted })
    }
    const stage = (n, y, h, title, desc) => {
        box(X, y, CW, h, { rx: 10 })
        out.push(`<circle cx="${X + 26}" cy="${y + 26}" r="13" fill="${t.accent}"/>`)
        text(X + 26, y + 30.5, n, { anchor: 'middle', weight: 700, fill: t.surface })
        text(X + 50, y + 31, title, { size: 15, weight: 600 })
        if (desc) text(X + 50, y + 51, desc, { fill: t.muted })
    }
    const chip = (x, y, w, h, title, lines, o = {}) => {
        box(x, y, w, h, { fill: o.fill || t.chip, stroke: o.stroke || t.border, sw: o.sw })
        text(x + 12, y + 22, title, { weight: 600, fill: o.titleFill || t.text })
        lines.forEach((l, i) => text(x + 12, y + 42 + i * 18, l.s ?? l, { size: 12, fill: t.muted, mono: l.mono }))
    }

    let y = 16

    // 1 app
    stage(1, y, 70, 'Your app starts on the GitHub runner', 'npm ci, then your start_command. The app listens on all interfaces, so the Docker container can reach it.')
    arrow(y + 70, y + 98)
    y += 98

    // 2 configuration
    const h2 = 176
    stage(2, y, h2, 'You configure what is audited', 'Optional file cypress/fixtures/sitemap.json and the secret audit_env')
    {
        const cy = y + 68
        const gap = 12
        const w = (CW - 50 - 16 - 2 * gap) / 3
        const x0 = X + 50
        chip(x0, cy, w, 92, 'Pages', ['only · included · excluded', 'queryParams · maxPages', 'e.g. exclude /logout'])
        chip(x0 + w + gap, cy, w, 92, 'State', ['localStorage · sessionStorage', 'cookies · IndexedDB', 'login, cookie consent, light / dark'])
        chip(x0 + 2 * (w + gap), cy, w, 92, 'Credentials', [{ s: '{{env.AUDIT_TOKEN}}', mono: true }, 'filled from the secret audit_env,', 'never stored in the repository'])
    }
    arrow(y + h2, y + h2 + 28, 'Docker image with Cypress')
    y += h2 + 28

    // 3 crawler
    const h3 = 96
    stage(3, y, h3, 'The crawler finds all relevant pages', 'Starts at the start pages, follows links, hash routes and redirects, always with the state.')
    text(X + 50, y + 75, 'Found pages are stored as urls in sitemap.json. Pages where the state was rejected become warnings.', { size: 12, fill: t.muted })
    arrow(y + h3, y + h3 + 28, 'skipped with skip_crawler: true')
    y += h3 + 28

    // 4 audit matrix
    const h4 = 262
    stage(4, y, h4, 'Every page is audited up to four times', 'Storage is cleared before every page load. Every violation gets a screenshot.')
    {
        const gx = X + 50 + 120
        const gy = y + 92
        const cw = (CW - 50 - 120 - 16 - 12) / 2
        const ch = 64
        text(gx + cw / 2, gy - 12, 'Mobile 360 × 667', { anchor: 'middle', weight: 600 })
        text(gx + cw + 12 + cw / 2, gy - 12, 'Desktop 1280 × 720', { anchor: 'middle', weight: 600 })
        ;[
            ['Default state', 'without the state'],
            ['Injected state', 'only if a state exists'],
        ].forEach(([label, note], r) => {
            const ry = gy + r * (ch + 12)
            text(X + 50, ry + 30, label, { weight: 600 })
            text(X + 50, ry + 48, note, { size: 12, fill: t.muted })
            for (let c = 0; c < 2; c++) {
                const cx = gx + c * (cw + 12)
                box(cx, ry, cw, ch, { fill: t.accentSoft, stroke: t.accent, dash: r === 1 })
                text(cx + cw / 2, ry + 27, 'axe-core: WCAG 2.0, 2.1, 2.2 A + AA', { anchor: 'middle', size: 12 })
                text(cx + cw / 2, ry + 46, '+ own checks for head, body and html', { anchor: 'middle', size: 12 })
            }
        })
        text(X + 50, y + h4 - 16, 'Pages that the server only delivers with the state (e.g. 401 without session) are only audited with it.', { size: 12, fill: t.muted })
    }
    arrow(y + h4, y + h4 + 28)
    y += h4 + 28

    // 5 normalisation
    const h5 = 170
    stage(5, y, h5, 'Findings are collected and normalised', 'Same page + same rule + same DOM element = one finding, listing all environments it occurs in.')
    {
        const cy = y + 68
        const gap = 12
        const w = (CW - 50 - 16 - 2 * gap) / 3
        const x0 = X + 50
        chip(x0, cy, w, 86, 'Issues', ['WCAG level A and AA', 'fail the workflow'], { stroke: t.fail, sw: 1.5, titleFill: t.fail })
        chip(x0 + w + gap, cy, w, 86, 'Hints', ['AAA and best practices,', 'e.g. skipped heading levels'])
        chip(x0 + 2 * (w + gap), cy, w, 86, 'Warnings', ['state probably not accepted,', 'e.g. expired token'])
    }
    arrow(y + h5, y + h5 + 28)
    y += h5 + 28

    // 6 report
    const h6 = 196
    stage(6, y, h6, 'The report is uploaded as a GitHub artifact', 'Artifact full-accessibility-audit, also uploaded when the audit fails')
    {
        const cy = y + 68
        const x0 = X + 50
        const w1 = 300
        box(x0, cy, w1, 108, { fill: t.chip })
        ;['full-accessibility-audit.json', 'full-accessibility-audit.md', 'sitemap.json', 'screenshots/'].forEach((f, i) =>
            text(x0 + 14, cy + 24 + i * 23, f, { size: 12, mono: true })
        )
        const x1 = x0 + w1 + 12
        const w2 = CW - 50 - 16 - w1 - 12
        box(x1, cy, w2, 108, { fill: t.chip })
        text(x1 + 14, cy + 22, 'Every finding contains', { weight: 600 })
        ;['page, WCAG criterion and severity', 'the element as HTML and its exact DOM position', 'how to fix it and a link to the rule', 'all environments where it was found'].forEach((l, i) =>
            text(x1 + 14, cy + 42 + i * 18, `· ${l}`, { size: 12, fill: t.muted })
        )
    }
    y += h6 + 20

    // outcome
    {
        const w = (CW - 12) / 2
        box(X, y, w, 44, { stroke: t.fail, sw: 1.5 })
        text(X + w / 2, y + 27, '✕  Issues found: the workflow fails', { anchor: 'middle', weight: 600, fill: t.fail })
        box(X + w + 12, y, w, 44, { stroke: t.pass, sw: 1.5 })
        text(X + w + 12 + w / 2, y + 27, '✓  No issues: the workflow passes', { anchor: 'middle', weight: 600, fill: t.pass })
    }
    y += 44 + 16

    const H = y
    const title = 'How the Full Accessibility Audit works'
    const desc =
        'Workflow in six steps: 1. your app starts on the GitHub runner. 2. You configure the pages, an optional state (storage, cookies, IndexedDB, e.g. login, cookie consent or light and dark mode) and credentials as placeholders filled from the secret audit_env. 3. A crawler in a Docker image with Cypress finds all relevant pages and stores them in sitemap.json. 4. Every page is audited on mobile (360 by 667) and desktop (1280 by 720), each without and with the injected state, with axe-core for WCAG 2.0 to 2.2 level A and AA plus own checks. 5. Findings are merged per page, rule and DOM element and split into issues (A and AA), hints (AAA and best practices) and warnings. 6. The report is uploaded as the GitHub artifact full-accessibility-audit with a JSON and a Markdown file, the sitemap and screenshots. Each finding lists the element, its DOM position, how to fix it and all environments. Issues fail the workflow, otherwise it passes.'
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">`,
        `<title id="title">${esc(title)}</title>`,
        `<desc id="desc">${esc(desc)}</desc>`,
        `<rect width="${W}" height="${H}" rx="8" fill="${t.surface}"/>`,
        `<g font-family="${FONT}">`,
        ...out,
        '</g>',
        '</svg>',
        '',
    ].join('\n')
}

const dir = new URL('.', import.meta.url)
for (const theme of Object.keys(THEMES)) {
    writeFileSync(new URL(`workflow-${theme}.svg`, dir), render(theme))
}
