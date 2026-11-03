import { createCustomViolation } from './auditor-helper'
import { detectMismatchingLanguage } from './check-language-compatibility'
import { CustomAuditCallback, CustomViolationReturnType } from './types'

export const checkPrimaryLanguageMismatch = (
    $html: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []

    const declaredLang = $html.attr('lang')?.trim().toLowerCase()
    if (!declaredLang) {
        return
    }

    const $body = $html.find('body')
    if (!$body.length) {
        return
    }

    const clone = $body.clone()
    clone.find('[lang]').remove()
    clone.find('script, style, noscript').remove()

    const cleanText = clone.text().replace(/\s+/g, ' ').trim()
    const detectedLang3 = detectMismatchingLanguage(cleanText, declaredLang)
    if (detectedLang3) {
        violations.push(
            createCustomViolation({
                id: 'primary-language-mismatch',
                impact: 'serious',
                description: `The declared language "${declaredLang}" does not match the detected language`,
                help: 'The site appears to be in a different language than specified',
                helpUrl:
                    'https://www.w3.org/WAI/standards-guidelines/act/rules/ucwvc8/proposed/',
                html: $html[0].outerHTML.substring(0, 32) + '...',
                failureSummary: [
                    `Declared lang attribute: "${declaredLang}"`,
                    `Detected language (NLP): "${detectedLang3}"`,
                    'Ensure the "lang" attribute correctly identifies the primary language of the site.',
                ],
                tags: ['wcag2a', 'wcag311'],
                element: $html[0],
            })
        )
    }

    if (violations.length) {
        callback(violations)
    }
}
