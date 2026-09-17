import axe from 'axe-core'
import { formatWCAGTag } from './format-wcag-tag'
import {
    CustomViolationReturnType,
    CustomViolationType,
    ViewportType,
    ViolationNodeType,
} from './types'

export const createCustomViolation = (
    data: CustomViolationType & { element: HTMLElement }
): CustomViolationReturnType => {
    const { failureSummary, html, impact, element, ...rest } = data
    return {
        ...rest,
        impact,
        nodes: [
            {
                failureSummary: `Fix all of the following:\n• ${failureSummary.filter((item) => item).join('\n• ')}`,
                html,
                impact,
                target: [],
                element: element,
            } as ViolationNodeType,
        ],
    }
}

const getUniqueSelector = (element: HTMLElement | null): string => {
    if (!element) {
        return 'unknown-element'
    }
    if (element.id) {
        return `#${element.id}`
    }

    const path: string[] = []
    let current: HTMLElement | null = element

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        if (current.id) {
            path.unshift(`#${current.id}`)
            break
        }

        let siblingIndex = 1
        let sibling = current.previousElementSibling

        while (sibling) {
            if (sibling.tagName === current.tagName) {
                siblingIndex++
            }
            sibling = sibling.previousElementSibling
        }

        const tagName = current.tagName.toLowerCase()
        path.unshift(`${tagName}:nth-of-type(${siblingIndex})`)
        current = current.parentElement as HTMLElement | null
    }

    return path.join(' > ')
}

export const processViolations = (
    currentPath: string,
    violations: (CustomViolationReturnType | axe.Result)[],
    errorList: {
        id: string
        message: string
        viewports: string[]
        uniqueKey: string
        rawDetails?: {
            tagString: string
            impact: string
            help: string
            html: string
            exactDomLocation: string
            failureSummary: string
            helpUrl: string
        }
    }[],
    currentViewport: ViewportType,
    stateName: string = 'default state'
) => {
    violations.forEach((violation) => {
        const nodesCount = violation.nodes.length

        const cleanPath =
            currentPath.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'root'
        const cleanViewport = String(currentViewport)
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
        const cleanState = stateName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')

        const screenshotName = `${cleanPath}--${cleanViewport}--${cleanState}--${violation.id}`

        cy.screenshot(screenshotName, { capture: 'viewport' })

        Cypress.log({
            displayName: 'a11y error!',
            message: `${violation.id} on ${nodesCount} Node${nodesCount !== 1 ? 's' : ''}`,
            consoleProps: () => ({
                Command: 'ally error!',
                Id: violation.id,
                Impact: violation.impact,
                Tags: violation.tags,
                Description: violation.description,
                Help: violation.help,
                Helpurl: violation.helpUrl,
                Nodes: violation.nodes,
            }),
        })

        const tagString =
            violation.tags
                .filter((tag: string) => /^wcag/i.test(tag))
                .map((tag: string) => formatWCAGTag(tag))
                .join(', ') || 'no WCAG reference'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        violation.nodes.forEach((node: any) => {
            let exactDomLocation = ''

            if (
                Array.isArray(node.target) &&
                node.target.length &&
                typeof node.target[0] === 'string' &&
                !node.target[0].startsWith('<')
            ) {
                exactDomLocation = node.target.join(' > ')
            } else {
                let rawElement: HTMLElement | null = null

                if (node.element) {
                    rawElement = node.element
                } else if (node.html) {
                    try {
                        rawElement = document.querySelector(node.html)
                    } catch {
                        rawElement = null
                    }
                }

                exactDomLocation = getUniqueSelector(rawElement)
            }

            const fullContext = `${currentViewport} (${stateName})`
            const uniqueKey = `${currentPath}-${violation.id}-${exactDomLocation}`

            const existingError = errorList.find(
                (err) => err.uniqueKey === uniqueKey
            )

            const cleanSummary =
                node.failureSummary?.replace(/\n\s(?!Fix)/g, '\n•') || ''

            if (existingError) {
                if (!existingError.viewports.includes(fullContext)) {
                    existingError.viewports.push(fullContext)
                }

                const details = existingError.rawDetails || {
                    tagString,
                    impact: violation.impact || 'unknown',
                    help: violation.help,
                    html: node.html,
                    exactDomLocation,
                    failureSummary: cleanSummary,
                    helpUrl: violation.helpUrl || '',
                }

                const formattedViewports = existingError.viewports
                    .map((vp) => `• ${vp}`)
                    .join('\n')

                existingError.message =
                    `Issue on [${currentPath}] - [${details.tagString} (${details.impact} severity)]:\n` +
                    `${details.help}.\n\n` +
                    `Element: ${details.html}\n\n` +
                    `Exact DOM Position: ${details.exactDomLocation}\n\n` +
                    `${details.failureSummary}\n\n` +
                    `Found on following environments:\n${formattedViewports}\n\n` +
                    `Help: ${details.helpUrl}`
            } else {
                const formattedMessage =
                    `Issue on [${currentPath}] - [${tagString} (${violation.impact} severity)]:\n` +
                    `${violation.help}.\n\n` +
                    `Element: ${node.html}\n\n` +
                    `Exact DOM Position: ${exactDomLocation}\n\n` +
                    `${cleanSummary}\n\n` +
                    `Found on following environments:\n• ${fullContext}\n\n` +
                    `Help: ${violation.helpUrl}`

                errorList.push({
                    id: violation.id,
                    uniqueKey: uniqueKey,
                    message: formattedMessage,
                    viewports: [fullContext],
                    rawDetails: {
                        tagString,
                        impact: violation.impact || 'unknown',
                        help: violation.help,
                        html: node.html,
                        exactDomLocation,
                        failureSummary: cleanSummary,
                        helpUrl: violation.helpUrl || '',
                    },
                })
            }
        })
    })
}
