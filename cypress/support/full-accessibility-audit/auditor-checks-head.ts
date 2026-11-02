import { createCustomViolation } from './auditor-helper'
import { CustomAuditCallback, CustomViolationReturnType } from './types'

export const checkFirstValidMetaRefresh = (
    $head: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []

    let firstValidElement: HTMLElement | null = null
    let detectedDelay = -1

    $head.find('meta[http-equiv="refresh"]').each((_, el) => {
        if (firstValidElement) {
            return
        }

        const content = el.getAttribute('content')?.trim() || ''

        const match = content.match(/^\s*(\d+)(?:\s*;|\s*$)/)

        if (match) {
            firstValidElement = el
            detectedDelay = parseInt(match[1], 10)
        }
    })

    if (detectedDelay > 0 && detectedDelay <= 72000) {
        violations.push(
            createCustomViolation({
                id: 'meta-refresh-delay-a',
                impact: 'serious',
                description: `The first valid meta refresh has a delay of ${detectedDelay} seconds`,
                help: 'The meta element should not be used for delayed redirecting or refreshing',
                html: (firstValidElement! as HTMLElement).outerHTML,
                helpUrl:
                    'https://www.w3.org/WAI/standards-guidelines/act/rules/bc659a/proposed/',
                failureSummary: [
                    'The delay specified in <meta http-equiv="refresh"> must either be 0 or larger than 72,000 seconds.',
                    'To pass level A: Use a server-side redirect or set the delay to 0.',
                    'To pass level AAA: Avoid any automatic refresh entirely.',
                ],
                tags: ['wcag2a', 'wcag221'],
                element: firstValidElement!,
            })
        )
    }

    if (detectedDelay > 0) {
        violations.push(
            createCustomViolation({
                id: 'meta-refresh-delay-aaa',
                impact: 'serious',
                description: `The first valid meta refresh has a delay of ${detectedDelay} seconds`,
                help: 'The meta element must not be used for delayed redirecting or refreshing',
                html: (firstValidElement! as HTMLElement).outerHTML,
                helpUrl:
                    'https://www.w3.org/WAI/standards-guidelines/act/rules/bisz58/proposed/',
                failureSummary: [
                    'The delay specified in <meta http-equiv="refresh"> must not exceed the 0-second limit.',
                    'To pass level A: Use a server-side redirect or set the delay to 0.',
                    'To pass level AAA: Avoid any automatic refresh entirely.',
                ],
                tags: ['wcag2aa', 'wcag224'],
                element: firstValidElement!,
            })
        )
    }

    if (violations.length) {
        callback(violations)
    }
}

export const checkPlaceholderDocumentTitle = (
    $head: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const placeholderTitles = [
        'vite app',
        'vite + ts',
        'vite + react',
        'vite + react + ts',
        'vite + vue',
        'vite + vue + ts',
        'vite + svelte',
        'vite + svelte + ts',
        'vite + preact',
        'vite + preact + ts',
        'vite + solid',
        'vite + solid + ts',
        'vite + lit',
        'vite + lit + ts',
        'vite + qwik',
        'react app',
        'create next app',
        'svelte app',
        'ionic app',
        'document',
        'untitled',
        'untitled document',
    ]

    const title = ($head[0]?.ownerDocument?.title || '')
        .replace(/\s+/g, ' ')
        .trim()

    if (!title || !placeholderTitles.includes(title.toLowerCase())) {
        return
    }

    const $title = $head.find('title').first()
    const element = $title.length ? $title[0] : $head[0]

    callback([
        createCustomViolation({
            id: 'document-title-placeholder',
            impact: 'serious',
            description: `The page title "${title}" is the default title of a project template`,
            help: 'The page title must describe the topic or purpose of the page',
            helpUrl:
                'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html',
            html: element.outerHTML,
            failureSummary: [
                `The document title is "${title}".`,
                'Replace the default template title with a title that describes the page.',
            ],
            tags: ['wcag2a', 'wcag242'],
            element,
        }),
    ])
}

export const checkValidMetaViewport = (
    $head: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []

    let isValidMaximumScale = true
    let isValidUserScalable = true

    let maxScaleMatch: RegExpMatchArray | null = null
    let userScalableMatch: RegExpMatchArray | null = null

    const viewport = $head.find('meta[name="viewport"]')

    viewport.each((_, el) => {
        const content = el.getAttribute('content')?.trim() || ''
        if (!content.length) {
            return
        }

        maxScaleMatch = content.match(/maximum-scale\s*=\s*([^,\s]+)/i)
        userScalableMatch = content.match(/user-scalable\s*=\s*([^,\s]+)/i)

        if (maxScaleMatch) {
            const val = maxScaleMatch[1].toLowerCase()
            const num = parseFloat(val)
            const isThisTagValid =
                !val ||
                (!isNaN(num) && (num < 0 || num >= 2)) ||
                ['device-width', 'device-height'].includes(val)
            if (!isThisTagValid) {
                isValidMaximumScale = false
            }
        }

        if (userScalableMatch) {
            const val = userScalableMatch[1].toLowerCase()
            const num = parseFloat(val)
            const isThisTagValid =
                !val ||
                (!isNaN(num) && (num < -1 || num > 1)) ||
                ['device-width', 'device-height', 'yes'].includes(val)
            if (!isThisTagValid) {
                isValidUserScalable = false
            }
        }
    })

    if (!isValidMaximumScale || !isValidUserScalable) {
        violations.push(
            createCustomViolation({
                id: 'meta-valid-viewport',
                impact: 'serious',
                description:
                    'The viewport meta tag prevents zooming in on the page',
                help: 'Users with visual impairments must be able to zoom in on text to at least 200%',
                helpUrl:
                    'https://www.w3.org/WAI/standards-guidelines/act/rules/b4f0c3/proposed/',
                html: viewport[0].outerHTML,
                failureSummary: [
                    !isValidMaximumScale && maxScaleMatch
                        ? `The maximum-scale attribute "${maxScaleMatch[1]}" must be a number less than 0 or greater than or equal to 2, or "device-width" or "device-height".`
                        : '',
                    !isValidUserScalable && userScalableMatch
                        ? `The user-scalable attribute "${userScalableMatch[1]}" must be a number outside the range of -1 and +1, or "device-width" or "device-height" or "yes".`
                        : '',
                ],
                tags: ['wcag2aa', 'wcag144'],
                element: viewport[0],
            })
        )
    }

    if (violations.length) {
        callback(violations)
    }
}
