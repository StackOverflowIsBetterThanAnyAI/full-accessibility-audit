import axe from 'axe-core'
import $ from 'jquery'
import { createCustomViolation, getReferencedElements } from './auditor-helper'
import { CustomAuditCallback, CustomViolationReturnType } from './types'
import { detectMismatchingLanguage } from './check-language-compatibility'
import {
    GLOBAL_ARIA_ATTRIBUTES,
    PROHIBITED_ARIA_ATTRIBUTES,
} from './wai-aria-roles'

const FOCUSABLE_SELECTOR =
    'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]'

// only alt texts that consist of nothing but a generic word, e.g. "image" or "Bild 3", but not "W3C logo"
const GENERIC_ALT_TEXT =
    /^(an? |the |ein |eine |das )?(graphics?|pictures?|images?|photos?|icons?|logos?|diagrams?|tables?|placeholder|grafik(en)?|abbildung(en)?|bild(er)?|fotos?|symbole?|tabellen?|platzhalter)( ?[0-9]+)?$/i

const FILE_NAME_ALT_TEXT =
    /\.(jpe?g|png|gif|tiff?|raw|svg|webp|avif|bmp|ico|heic)$/i

// a single Han, Kana or Hangul character can be a meaningful word
const LOGOGRAPHIC_CHARACTER =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

const isBadAltText = (altText: string) => {
    if (!altText) {
        return false
    }
    return (
        FILE_NAME_ALT_TEXT.test(altText) ||
        GENERIC_ALT_TEXT.test(altText) ||
        /^[0-9]+$/.test(altText) ||
        /^[^\p{L}\p{N}]+$/u.test(altText) ||
        ([...altText].length === 1 && !LOGOGRAPHIC_CHARACTER.test(altText))
    )
}

export const checkBadAltTextImage = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []

    $body.find('img[alt]').each((_, img) => {
        const altText = Cypress.$(img).attr('alt')?.trim() || ''

        if (isBadAltText(altText)) {
            violations.push(
                createCustomViolation({
                    id: 'bad-alt-image',
                    impact: 'serious',
                    description: `The alt text "${altText}" looks like a filename or placeholder`,
                    help: 'Alternative text must be a meaningful replacement for the image content',
                    helpUrl:
                        'https://www.w3.org/WAI/WCAG22/Techniques/failures/F30',
                    html: img.outerHTML,
                    failureSummary: [
                        'Change the alt attribute to describe the purpose of the image.',
                        'Do not use filenames (like .jpg).',
                        'Do not use generic words like "image" or "placeholder".',
                        'Do not use only numbers.',
                        'Do not use only special characters or symbols.',
                        'Do not use only one character.',
                    ],
                    tags: ['wcag2a', 'wcag111'],
                    element: img,
                })
            )
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkAltTextInputImage = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const badLinkLikeAltPatterns = [
        /^click/i,
        /(^|\s)here$/i,
        /(^|\s)here\.{3}$/i,
        /^more$/i,
        /^more\.{3}$/i,
        /^learn more$/i,
        /^learn more\.{3}$/i,
        /^details$/i,
        /^more details$/i,
        /^link$/i,
        /^continue$/i,
        /^continue reading$/i,
        /^read more$/i,
        /^button$/i,
        /^klick/i,
        /(^|\s)hier$/i,
        /(^|\s)hier\.{3}$/i,
        /mehr\.{3}$/i,
        /^mehr erfahren$/i,
        /^mehr erfahren\.{3}$/i,
        /^erfahre mehr$/i,
        /^erfahre mehr\.{3}$/i,
        /^weiter$/i,
        /^weiterlesen$/i,
        /^mehr lesen$/i,
    ]
    const violations: CustomViolationReturnType[] = []

    $body.find('input[type="image"]').each((_, img) => {
        const $img = Cypress.$(img)

        if ($img.is(':hidden')) {
            return
        }

        const alt = $img.attr('alt')
        const altText = alt?.trim() || ''
        const isBadInputAltText =
            isBadAltText(altText) ||
            badLinkLikeAltPatterns.some((pattern) => pattern.test(altText))

        if (isBadInputAltText) {
            violations.push(
                createCustomViolation({
                    id: 'bad-alt-input-image',
                    impact: 'serious',
                    description: `The alt text "${altText}" looks like a filename or placeholder`,
                    help: 'Alternative text must be a meaningful replacement for the image content',
                    helpUrl:
                        'https://www.w3.org/WAI/WCAG22/Techniques/failures/F30',
                    html: img.outerHTML,
                    failureSummary: [
                        'Change the alt attribute to describe the purpose of the image.',
                        'Do not use filenames (like .jpg).',
                        'Do not use generic words like "image" or "placeholder".',
                        'Do not use only numbers.',
                        'Do not use only special characters or symbols.',
                        'Do not use only one character.',
                    ],
                    tags: ['wcag2a', 'wcag111'],
                    element: img,
                })
            )
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkBadFormLabels = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const badLabelPattern = /^[^\p{L}0-9]+$/iu
    const violations: CustomViolationReturnType[] = []

    $body.find('label').each((_, label) => {
        const labelText = Cypress.$(label).text()?.trim() || ''

        const isNoneOrBadLabelText =
            labelText.length <= 1 || badLabelPattern.test(labelText)

        if (isNoneOrBadLabelText) {
            violations.push(
                createCustomViolation({
                    id: 'bad-form-label',
                    impact: 'serious',
                    description: `The label "${labelText}" is uninformative`,
                    help: 'Form labels must clearly describe the purpose of the input field and cannot be empty or consist only of non-alphanumeric characters',
                    helpUrl:
                        'https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html',
                    html: label.outerHTML,
                    failureSummary: [
                        'Provide a meaningful, visible text within the label.',
                        'Do not use only special characters or symbols.',
                        'Do not use only one single character.',
                    ],
                    tags: ['wcag2aa', 'wcag246'],
                    element: label,
                })
            )
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkBadLinkTexts = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []

    const badLinkTextPatterns = [
        /^click/i,
        /(^|\s)here$/i,
        /(^|\s)here\.{3}$/i,
        /^more$/i,
        /^more\.{3}$/i,
        /^learn more$/i,
        /^learn more\.{3}$/i,
        /^details$/i,
        /^more details$/i,
        /^link$/i,
        /^continue$/i,
        /^continue reading$/i,
        /^read more$/i,
        /^button$/i,
        /^klick/i,
        /(^|\s)hier$/i,
        /(^|\s)hier\.{3}$/i,
        /mehr\.{3}$/i,
        /^mehr erfahren$/i,
        /^mehr erfahren\.{3}$/i,
        /^erfahre mehr$/i,
        /^erfahre mehr\.{3}$/i,
        /^weiter$/i,
        /^weiterlesen$/i,
        /^mehr lesen$/i,
    ]

    $body.find('a, button, [role="link"], [role="button"]').each((_, el) => {
        const $el = Cypress.$(el)

        if (
            $el.is(':hidden') ||
            $el.attr('aria-hidden') === 'true' ||
            $el.closest('[hidden]').length
        ) {
            return
        }

        let accessibleName = ''

        const ariaLabel = $el.attr('aria-label')

        if (ariaLabel && ariaLabel.trim().length) {
            accessibleName = ariaLabel.trim()
        } else {
            const imgAltTexts: string[] = []
            $el.find('img[alt]').each((_, img) => {
                const alt = Cypress.$(img).attr('alt')?.trim()
                if (alt) {
                    imgAltTexts.push(alt)
                }
            })

            const elementText = $el.text().trim()
            accessibleName = elementText || imgAltTexts.join(' ')
        }

        if (!accessibleName) {
            return
        }

        const matchesBadLinkText = badLinkTextPatterns.some((regex) =>
            regex.test(accessibleName)
        )

        if (matchesBadLinkText) {
            violations.push(
                createCustomViolation({
                    id: 'bad-link-text',
                    impact: 'moderate',
                    description: `The link or button text "${accessibleName}" is generic and lacks context`,
                    help: 'Ensure that link and button texts clearly describe the destination or action without relying on surrounding context',
                    helpUrl:
                        'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-link-only.html',
                    html:
                        el.outerHTML.substring(0, 64) +
                        (el.outerHTML.length > 64 ? '...' : ''),
                    failureSummary: [
                        `Element <${el.tagName.toLowerCase()}> has the accessible text: "${accessibleName}".`,
                        `Generic phrases are not meaningful when read out of context.`,
                    ],
                    tags: ['wcag2aaa', 'wcag249'],
                    element: el,
                })
            )
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkVideoCaptions = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []
    $body.find('video').each((_, video) => {
        const $video = Cypress.$(video)
        if (
            video.hasAttribute('muted') ||
            $video.is(':hidden') ||
            $video.closest('[aria-hidden="true"]').length
        ) {
            return
        }
        const hasCaptions = $video.find('track[kind="captions"]').length > 0

        if (!hasCaptions) {
            violations.push(
                createCustomViolation({
                    id: 'video-missing-captions',
                    impact: 'serious',
                    description: 'Video is missing captions',
                    help: 'Deaf users need captions to understand the content',
                    helpUrl:
                        'https://www.w3.org/WAI/WCAG22/Techniques/html/H95',
                    html: video.outerHTML,
                    failureSummary: [
                        'Provide a <track kind="captions"> element in the language of the video.',
                    ],
                    tags: ['wcag2a', 'wcag122'],
                    element: video,
                })
            )
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkFieldsetLegend = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []
    $body.find('fieldset').each((_, fieldset) => {
        const $fieldset = Cypress.$(fieldset)
        const legend = $fieldset.find('> legend')
        const firstChild = $fieldset.children().first()

        const hasMultipleLegends = legend.length > 1

        const legendText = legend.text().trim()
        const hasValidLegend =
            legend.length && legendText.length && /\p{L}/u.test(legendText)

        const isLegendFirst = firstChild.is('legend')

        const hasAriaName =
            !!$fieldset.attr('aria-label')?.trim() ||
            getReferencedElements(fieldset, 'aria-labelledby').some((target) =>
                target.textContent?.trim()
            )
        if (!legend.length && hasAriaName) {
            return
        }

        if (!hasValidLegend || !isLegendFirst || hasMultipleLegends) {
            violations.push(
                createCustomViolation({
                    id: 'fieldset-bad-legend',
                    impact: 'serious',
                    description:
                        'Every <fieldset> must have one non-empty <legend> as its first child',
                    help: 'The <legend> element provides the necessary context for grouped form controls',
                    helpUrl:
                        'https://www.w3.org/WAI/WCAG22/Techniques/html/H71',
                    html: fieldset.outerHTML,
                    failureSummary: [
                        'Add a <legend> element with a meaningful text inside the <fieldset>.',
                        'The <legend> element must be the first child of the <fieldset>.',
                        'Use only one <legend> element per <fieldset>.',
                    ],
                    tags: ['wcag2a', 'wcag131'],
                    element: fieldset,
                })
            )
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkHeadingOrder = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []
    const headings = $body.find('h1, h2, h3, h4, h5, h6')

    if (!headings.length) {
        return
    }

    let lastLevel = 0
    headings.each((_, el) => {
        const currentLevel = parseInt(el.tagName.substring(1))

        if (lastLevel !== 0 && currentLevel > lastLevel + 1) {
            violations.push(
                createCustomViolation({
                    id: 'heading-order-jump',
                    impact: 'serious',
                    description: `Heading level skipped: <h${lastLevel}> to <h${currentLevel}>`,
                    help: 'Headings must follow a logical order without skipping levels',
                    helpUrl:
                        'https://www.w3.org/WAI/WCAG22/Techniques/general/G141',
                    html: el.outerHTML,
                    failureSummary: [
                        `Change this heading to <h${lastLevel + 1}> or higher.`,
                    ],
                    tags: ['best-practice'],
                    element: el,
                })
            )
        }
        lastLevel = currentLevel
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkNonEmptyHeading = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []
    $body.find('h1, h2, h3, h4, h5, h6, [role="heading"]').each((_, el) => {
        const $el = Cypress.$(el)

        const role = $el.attr('role')
        const hasAriaLabel = $el.attr('aria-label') !== undefined
        const hasAriaLabelledBy = !!$el.attr('aria-labelledby')

        if (
            (role === 'presentation' || role === 'none') &&
            !hasAriaLabel &&
            !hasAriaLabelledBy
        ) {
            return
        }

        const isHiddenInTree =
            !el.getClientRects().length ||
            $el.css('visibility') === 'hidden' ||
            $el.closest('[aria-hidden="true"]').length > 0
        if (isHiddenInTree) {
            return
        }

        let accessibleName = ''

        if (hasAriaLabelledBy) {
            accessibleName = getReferencedElements(el, 'aria-labelledby')
                .map((target) => target.textContent || '')
                .join(' ')
        } else if (hasAriaLabel) {
            accessibleName = $el.attr('aria-label') || ''
        } else {
            const $clone = $el.clone()
            $clone.find('[aria-hidden="true"]').remove()

            $clone.find('img').each((__, img) => {
                const $img = Cypress.$(img)
                const alt = $img.attr('alt')
                const imgRole = $img.attr('role')
                if (imgRole === 'presentation' || imgRole === 'none') {
                    $img.replaceWith('')
                } else {
                    $img.replaceWith(alt || '')
                }
            })
            accessibleName = $clone.text()
        }

        if (!accessibleName.trim().length) {
            violations.push(
                createCustomViolation({
                    id: 'non-empty-heading',
                    impact: 'serious',
                    description: 'Heading has no accessible name',
                    help: 'Headings must have text or an aria-label to be useful for screen reader users',
                    helpUrl:
                        'https://www.w3.org/WAI/WCAG22/Techniques/general/G130',
                    html: el.outerHTML,
                    failureSummary: [
                        'The heading content is currently programmatically empty.',
                        'Add text content, an aria-label, or descriptive alt-text for images inside the heading.',
                    ],
                    tags: ['wcag2a', 'wcag131'],
                    element: el,
                })
            )
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkAdjacentLinks = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []
    const links = $body.find('a[href]')

    if (links.length < 2) {
        return
    }

    const contextSelector =
        'nav, ul, ol, header, footer, main, aside, form, section, search'

    links.each((index, el) => {
        if (index >= links.length - 1) {
            return
        }

        const currentLink = el as HTMLAnchorElement
        const nextLink = links[index + 1] as HTMLAnchorElement

        if (currentLink.href && currentLink.href === nextLink.href) {
            const range = currentLink.ownerDocument.createRange()
            range.setStartAfter(currentLink)
            range.setEndBefore(nextLink)

            const textBetween = range.toString().trim()

            if (textBetween === '') {
                const currentContext = $(currentLink).closest(contextSelector)
                const nextContext = $(nextLink).closest(contextSelector)

                const hasCurrent = !!currentContext.length
                const hasNext = !!nextContext.length

                const areInDifferentContexts =
                    hasCurrent &&
                    hasNext &&
                    currentContext[0] !== nextContext[0]

                if (!areInDifferentContexts) {
                    violations.push(
                        createCustomViolation({
                            id: 'adjacent-redundant-links',
                            impact: 'serious',
                            description:
                                'Adjacent links to the same destination should be combined',
                            help: 'Combining adjacent image and text links for the same resource improves navigation for screen reader users',
                            helpUrl:
                                'https://www.w3.org/WAI/WCAG22/Techniques/html/H2',
                            html:
                                currentLink.outerHTML +
                                ' ... ' +
                                nextLink.outerHTML,
                            failureSummary: [
                                'Combine these two adjacent links into a single <a> tag.',
                                'Check that every <img> element contained within the <a> element has a null value set for its alt attribute.',
                                'Check that the <a> element contains an <img> element that has either a null alt attribute value or a value that supplements the link text and describes the image.',
                            ],
                            tags: ['best-practice'],
                            element: currentLink,
                        })
                    )
                }
            }
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkConflictDecorativeRole = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []
    $body.find('[role="presentation"], [role="none"]').each((_, el) => {
        const $el = Cypress.$(el)

        const ariaLabel = $el.attr('aria-label')?.trim()
        const ariaLabelledBy = $el.attr('aria-labelledby')?.trim()
        const title = $el.attr('title')?.trim()
        const tabIndex = $el.attr('tabindex')

        const isFocusable = tabIndex !== undefined && parseInt(tabIndex) >= 0
        const hasAccessibleName = !!ariaLabel || !!ariaLabelledBy || !!title

        if (isFocusable || hasAccessibleName) {
            violations.push(
                createCustomViolation({
                    id: 'conflict-decorative-role',
                    impact: 'serious',
                    description:
                        'Element has role="presentation" or "none" but also a text alternative',
                    help: 'Decorative elements should not have an accessible name to avoid confusing assistive technologies',
                    helpUrl:
                        'https://www.w3.org/WAI/standards-guidelines/act/rules/46ca7f/proposed/',
                    html: el.outerHTML,
                    failureSummary: [
                        'Remove the aria-label or aria-labelledby attribute, title, or custom tabindex if the element is purely decorative.',
                        'Or remove the role="presentation"/"none" if the element is actually important.',
                    ],
                    tags: ['wcag2a', 'wcag111'],
                    element: el,
                })
            )
        }
    })

    $body.find('img[alt=""]').each((_, el) => {
        const $el = Cypress.$(el)

        const ariaLabel = $el.attr('aria-label')?.trim()
        const ariaLabelledBy = $el.attr('aria-labelledby')?.trim()
        const role = $el.attr('role')?.trim()

        const hasAltAriaConflict = ariaLabelledBy?.length || ariaLabel?.length

        if (hasAltAriaConflict && !role) {
            violations.push(
                createCustomViolation({
                    id: 'conflict-decorative-role',
                    impact: 'serious',
                    description:
                        'Image has an empty alt attribute but also a text alternative',
                    help: 'Decorative elements should not have an accessible name to avoid confusing assistive technologies',
                    helpUrl:
                        'https://www.w3.org/WAI/standards-guidelines/act/rules/46ca7f/proposed/',
                    html: el.outerHTML,
                    failureSummary: [
                        'Remove aria-label or aria-labelledby if the image is purely decorative.',
                        'Or replace alt="" with a meaningful alt text if the image conveys information.',
                    ],
                    tags: ['wcag2a', 'wcag111'],
                    element: el,
                })
            )
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkProhibitedAria = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aria = require('aria-api')

    $body
        .find('*')
        .filter((_, el) => {
            return el
                .getAttributeNames()
                .some((name) => name.startsWith('aria-'))
        })
        .each((_, el) => {
            const $el = Cypress.$(el)

            if (
                $el.is(':hidden') ||
                $el.attr('aria-hidden') === 'true' ||
                $el.closest('[hidden]').length
            ) {
                return
            }

            const ariaAttributesOnElement = el
                .getAttributeNames()
                .filter((name) => name.startsWith('aria-'))

            const explicitRole = el.getAttribute('role')?.trim().split(/\s+/)[0]
            const isPresentational =
                (explicitRole === 'none' || explicitRole === 'presentation') &&
                !$el.is(FOCUSABLE_SELECTOR) &&
                !ariaAttributesOnElement.some((attr) =>
                    GLOBAL_ARIA_ATTRIBUTES.includes(attr)
                )
            const computedRole = isPresentational
                ? 'presentation'
                : aria.getRole(el) || 'generic'

            ariaAttributesOnElement.forEach((attr) => {
                const isProhibited =
                    PROHIBITED_ARIA_ATTRIBUTES[attr]?.includes(computedRole)
                if (!isProhibited) {
                    return
                }

                violations.push(
                    createCustomViolation({
                        id: 'prohibited-aria-naming',
                        impact: 'serious',
                        description: `The attribute "${attr}" is prohibited on a "${computedRole}" element`,
                        help: `Elements with role "${computedRole}" are purely structural and cannot be given an accessible name or role description`,
                        helpUrl:
                            'https://www.w3.org/WAI/standards-guidelines/act/rules/kb1m8s/proposed/',
                        html:
                            el.outerHTML.substring(0, 64) +
                            (el.outerHTML.length > 64 ? '...' : ''),
                        failureSummary: [
                            `Element <${el.tagName.toLowerCase()}> has the computed ARIA role "${computedRole}".`,
                            `The attribute "${attr}" is explicitly prohibited here because this role cannot be meaningfully announced with it.`,
                        ],
                        tags: ['wcag2a', 'wcag131'],
                        element: el,
                    })
                )
            })
        })

    if (violations.length) {
        callback(violations)
    }
}

export const checkLanguageMismatch = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []

    $body.find('[lang]').each((_, el) => {
        const $el = Cypress.$(el)
        const declaredLang = $el.attr('lang')?.trim().toLowerCase()
        if (!declaredLang) {
            return
        }

        const extraText = []

        if ($el.attr('aria-label')) {
            extraText.push($el.attr('aria-label'))
        }

        $el.find('img[alt]').each((_, img) => {
            const $img = Cypress.$(img)
            if ($img.closest('[lang]').is($el)) {
                extraText.push($img.attr('alt'))
            }
        })

        getReferencedElements(el, 'aria-labelledby').forEach((target) =>
            extraText.push(target.textContent || '')
        )

        const clone = $el.clone()
        clone.find('[lang]').remove()
        clone.find('script, style, noscript').remove()

        const cleanText = (clone.text() + ' ' + extraText.join(' '))
            .replace(/\s+/g, ' ')
            .trim()
        const detectedLang3 = detectMismatchingLanguage(cleanText, declaredLang)
        if (detectedLang3) {
            violations.push(
                createCustomViolation({
                    id: 'language-mismatch',
                    impact: 'moderate',
                    description: `The declared language "${declaredLang}" does not match the detected language`,
                    help: 'The text appears to be in a different language than specified',
                    helpUrl:
                        'https://www.w3.org/WAI/standards-guidelines/act/rules/off6ek/proposed/',
                    html: el.outerHTML,
                    failureSummary: [
                        `Declared lang attribute: "${declaredLang}".`,
                        `Detected language: "${detectedLang3}".`,
                        'Ensure the "lang" attribute correctly identifies the primary language of the text content.',
                    ],
                    tags: ['wcag2aa', 'wcag312'],
                    element: el,
                })
            )
        }
    })

    if (violations.length) {
        callback(violations)
    }
}

type InteractionStateType = 'hover' | 'focus'

const MAX_TRANSITION_WAIT = 1000
const MAX_HOVER_ATTEMPTS = 3

const dispatchMouseMove = (x: number, y: number) =>
    Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchMouseEvent',
        params: { type: 'mouseMoved', x, y },
    })

const moveMouse = (x: number, y: number) =>
    cy.then(() => dispatchMouseMove(x, y))

const getRunnerCoordinates = (el: HTMLElement) => {
    const frame =
        window.top?.document.querySelector<HTMLElement>('iframe.aut-iframe')
    if (!frame?.offsetWidth) {
        return null
    }

    el.scrollIntoView({ block: 'center', inline: 'center' })
    const frameRect = frame.getBoundingClientRect()
    const scale = frameRect.width / frame.offsetWidth
    const rect = el.getBoundingClientRect()

    return {
        x: frameRect.left + (rect.left + rect.width / 2) * scale,
        y: frameRect.top + (rect.top + rect.height / 2) * scale,
    }
}

const hoverElement = (
    el: HTMLElement,
    attempt = 1
): Cypress.Chainable<boolean> => {
    if (Cypress.browser.family !== 'chromium') {
        return cy.wrap(false, { log: false })
    }

    return cy
        .then((): Promise<boolean> => {
            const coordinates = getRunnerCoordinates(el)
            return coordinates
                ? Promise.resolve(
                      dispatchMouseMove(coordinates.x, coordinates.y)
                  ).then(() => el.matches(':hover'))
                : Promise.resolve(false)
        })
        .then((isHovered: boolean): unknown => {
            if (isHovered || attempt >= MAX_HOVER_ATTEMPTS) {
                return isHovered
            }
            cy.wait(100, { log: false })
            return hoverElement(el, attempt + 1)
        }) as Cypress.Chainable<boolean>
}

const waitForTransitions = (el: HTMLElement) => {
    const style = getComputedStyle(el)
    const toMilliseconds = (value: string) =>
        Math.max(
            ...value
                .split(',')
                .map((time) =>
                    time.trim().endsWith('ms')
                        ? parseFloat(time)
                        : parseFloat(time) * 1000
                )
                .filter((time) => !isNaN(time))
        )
    const duration =
        toMilliseconds(style.transitionDuration) +
        toMilliseconds(style.transitionDelay)

    if (duration > 0) {
        cy.wait(Math.min(duration, MAX_TRANSITION_WAIT), { log: false })
    }
}

const getContrastMessage = (violation: axe.Result) =>
    (violation.nodes[0]?.failureSummary || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(
            (line) => line && !/^Fix (all|any) of the following:$/.test(line)
        )
        .join(' ') || 'Element does not have sufficient color contrast.'

const checkContrastInState = (
    el: HTMLElement,
    state: InteractionStateType,
    callback: CustomAuditCallback
) => {
    const stateText = state === 'hover' ? 'hovered' : 'focused via keyboard'

    waitForTransitions(el)
    cy.checkA11y(
        el,
        { runOnly: { type: 'rule', values: ['color-contrast'] } },
        (violations) => {
            if (!violations.length) {
                return
            }
            callback(
                violations.map((violation) =>
                    createCustomViolation({
                        id: `contrast-${state}-state`,
                        impact: 'serious',
                        description: `Elements must maintain sufficient contrast ratio in ${state} state`,
                        help: `Elements must maintain sufficient contrast ratio when ${stateText}`,
                        helpUrl:
                            'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
                        html: el.outerHTML,
                        failureSummary: [
                            getContrastMessage(violation),
                            `Increase the color contrast of text and interactive elements to at least 4.5:1 for normal text and 3:1 for large text when ${stateText}.`,
                        ],
                        tags: ['wcag2aa', 'wcag143'],
                        element: el,
                    })
                )
            )
        },
        true
    )
}

export const checkDynamicContrast = (
    _$body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const selector =
        'a[href]:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex^="-"]):not([disabled])'

    cy.get('body', { log: false }).then(($body) => {
        const $visibleElements = $body
            .find(selector)
            .filter((_, el) => !Cypress.$(el).is(':hidden'))

        $visibleElements.each((_, el) => {
            cy.then(() => {
                if (!Cypress.dom.isAttached(el)) {
                    return
                }
                hoverElement(el).then((isHovered) => {
                    if (isHovered && Cypress.dom.isAttached(el)) {
                        checkContrastInState(el, 'hover', callback)
                    }
                })
                moveMouse(0, 0)
            })

            cy.then(() => {
                if (!Cypress.dom.isAttached(el)) {
                    return
                }
                el.focus()
                checkContrastInState(el, 'focus', callback)
                cy.then(() => el.blur())
            })
        })
    })
}

export const checkPasswordPasteBlocked = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []

    $body.find('input[type="password"]').each((_, el) => {
        const input = el as HTMLInputElement
        const $input = Cypress.$(input)

        if (
            input.disabled ||
            input.readOnly ||
            $input.is(':hidden') ||
            $input.closest('[aria-hidden="true"], [hidden]').length
        ) {
            return
        }

        const autocomplete = (input.getAttribute('autocomplete') || '')
            .trim()
            .toLowerCase()
        if (autocomplete.split(/\s+/).includes('new-password')) {
            return
        }

        const win = input.ownerDocument.defaultView
        if (!win) {
            return
        }

        let pasteEvent: Event
        try {
            const clipboardData = new win.DataTransfer()
            clipboardData.setData('text/plain', 'audit-paste-check')
            pasteEvent = new win.ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                composed: true,
                clipboardData,
            })
        } catch {
            pasteEvent = new win.Event('paste', {
                bubbles: true,
                cancelable: true,
                composed: true,
            })
        }

        const isPasteAllowed = input.dispatchEvent(pasteEvent)
        if (isPasteAllowed) {
            return
        }

        violations.push(
            createCustomViolation({
                id: 'password-paste-blocked',
                impact: 'serious',
                description: 'Pasting into the password field is blocked',
                help: 'Users must be able to paste passwords, e.g. from a password manager, instead of having to remember and transcribe them',
                helpUrl:
                    'https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html',
                html: input.outerHTML,
                failureSummary: [
                    'A "paste" event on this password field was cancelled by the page (preventDefault).',
                    'Remove the paste restriction so that password managers and copy & paste can be used.',
                ],
                tags: ['wcag22aa', 'wcag338'],
                element: input,
            })
        )
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkOrphanedLabelFor = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []

    const labelableSelector =
        'button, input:not([type="hidden"]), meter, output, progress, select, textarea'

    $body.find('label[for]').each((_, el) => {
        const label = el as HTMLLabelElement
        const $label = Cypress.$(label)
        const targetId = label.getAttribute('for') || ''

        if (
            !targetId.trim() ||
            $label.is(':hidden') ||
            $label.closest('[aria-hidden="true"], [hidden]').length
        ) {
            return
        }

        const root = label.getRootNode() as Document | ShadowRoot
        const target = root.getElementById(targetId)

        const isLabelable =
            !!target &&
            (target.matches(labelableSelector) || target.tagName.includes('-'))

        if (isLabelable) {
            return
        }

        const labelId = label.id
        const isReferencedByAria =
            !!labelId &&
            Array.from(root.querySelectorAll('[aria-labelledby]')).some(
                (referencing) =>
                    (referencing.getAttribute('aria-labelledby') || '')
                        .split(/\s+/)
                        .includes(labelId)
            )

        if (isReferencedByAria) {
            return
        }

        violations.push(
            createCustomViolation({
                id: 'label-for-orphaned',
                impact: 'serious',
                description: target
                    ? `The label points to the element with id "${targetId}", which is not a form control`
                    : `The label points to the id "${targetId}", which does not exist`,
                help: 'Visible labels must be programmatically associated with their form control',
                helpUrl: 'https://www.w3.org/WAI/WCAG22/Techniques/html/H44',
                html: label.outerHTML,
                failureSummary: [
                    target
                        ? `The element with id "${targetId}" is a <${target.tagName.toLowerCase()}>, which cannot be labelled.`
                        : `No element with id "${targetId}" exists on the page.`,
                    'Set the "for" attribute to the id of the input, select or textarea this label describes.',
                ],
                tags: ['wcag2a', 'wcag131'],
                element: label,
            })
        )
    })

    if (violations.length) {
        callback(violations)
    }
}

export const checkInvalidAnchorElements = (
    $body: JQuery<HTMLElement>,
    callback: CustomAuditCallback
) => {
    const violations: CustomViolationReturnType[] = []

    $body.find('a').each((_, el) => {
        const $el = Cypress.$(el)

        if (
            $el.is(':hidden') ||
            $el.attr('aria-hidden') === 'true' ||
            $el.closest('[hidden]').length
        ) {
            return
        }

        const href = $el.attr('href')
        if (href !== undefined && href.trim().length) {
            return
        }

        const tabindexAttr = $el.attr('tabindex')
        const tabindex =
            tabindexAttr !== undefined ? parseInt(tabindexAttr, 10) : NaN

        if (!isNaN(tabindex) && tabindex >= 0) {
            return
        }

        violations.push(
            createCustomViolation({
                id: 'invalid-anchor-element',
                impact: 'serious',
                description:
                    '<a> elements must have a valid "href" attribute or a keyboard-accessible "tabindex"',
                help: 'Missing "href" attributes remove the element from the keyboard focus flow and strip its semantic role',
                helpUrl:
                    'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
                html:
                    el.outerHTML.substring(0, 64) +
                    (el.outerHTML.length > 64 ? '...' : ''),
                failureSummary: [
                    `The element <${el.tagName.toLowerCase()}> acts as a placeholder link because it lacks an "href" attribute.`,
                    'Without "href" or an explicit "tabindex", this element is completely inaccessible to keyboard users.',
                ],
                tags: ['wcag2a', 'wcag211'],
                element: el,
            })
        )
    })

    if (violations.length) {
        callback(violations)
    }
}
