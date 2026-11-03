import axe from 'axe-core'
import * as BodyChecks from './auditor-checks-body'
import * as HeadChecks from './auditor-checks-head'
import * as HtmlChecks from './auditor-checks-html'
import { processViolations } from './auditor-helper'
import { waitForNetworkIdle } from './wait-for-network-idle'
import { CustomViolationReturnType, ErrorListType, ViewportType } from './types'
import { applyGlobalStorage } from './apply-storage'
import { isOnOrigin, preventLeavingOrigin } from './prevent-leaving-origin'
import { addLeadingSlash } from './url-helper'

export const runAxeAudit = (
    currentPath: string,
    errorList: ErrorListType[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalStorage?: any
) => {
    const scenarios = [{ name: 'default state', useStorage: false }]

    if (
        globalStorage &&
        globalStorage.data &&
        Object.keys(globalStorage.data).length
    ) {
        scenarios.push({ name: 'injected state', useStorage: true })
    }

    const viewports = [
        { name: 'Mobile' as ViewportType, width: 360, height: 667 },
        { name: 'Desktop' as ViewportType, width: 1280, height: 720 },
    ]

    // errors of the application must not stop the audit
    cy.on('uncaught:exception', (error) => {
        Cypress.log({
            displayName: 'app error',
            message: error.message,
        })
        return false
    })

    cy.wrap(scenarios).each(
        (scenario: { name: string; useStorage: boolean }) => {
            cy.wrap(viewports).each(
                (viewport: {
                    name: ViewportType
                    width: number
                    height: number
                }) => {
                    const securePath = /^https?:\/\//i.test(currentPath)
                        ? currentPath
                        : addLeadingSlash(currentPath)

                    const pageOrigin = new URL(
                        securePath,
                        Cypress.config('baseUrl') || undefined
                    ).origin

                    // cy.visit only changes the hash if the page is already open, but it has to be loaded again
                    if (securePath.includes('#')) {
                        cy.window({ log: false }).then((win) => {
                            win.location.href = 'about:blank'
                        })
                    }

                    cy.viewport(viewport.width, viewport.height)
                    cy.visit(securePath, {
                        onBeforeLoad: (win) => {
                            preventLeavingOrigin(win)
                            if (scenario.useStorage && globalStorage) {
                                applyGlobalStorage(win, globalStorage)
                            }
                        },
                    })

                    waitForNetworkIdle()

                    cy.window({ log: false }).then((win) => {
                        if (!isOnOrigin(win, pageOrigin)) {
                            cy.log(
                                `Skipped ${currentPath}: the page has left its origin`
                            )
                            return
                        }

                        cy.injectAxe()

                        cy.checkA11y(
                            undefined,
                            {
                                runOnly: {
                                    type: 'tag',
                                    values: [
                                        'wcag2a',
                                        'wcag2aa',
                                        'wcag21a',
                                        'wcag21aa',
                                        'wcag22aa',
                                    ],
                                },
                                rules: {
                                    'meta-viewport': { enabled: false },
                                    'meta-refresh': { enabled: false },
                                    'aria-prohibited-attr': { enabled: false },
                                },
                                includedImpacts: [
                                    'critical',
                                    'serious',
                                    'moderate',
                                ],
                            },
                            (violations: axe.Result[]) => {
                                processViolations(
                                    currentPath,
                                    violations,
                                    errorList,
                                    viewport.name,
                                    scenario.name
                                )
                            },
                            true
                        )

                        cy.get('body').then(($body) => {
                            Object.values(BodyChecks).forEach(
                                (checkFunction) => {
                                    if (typeof checkFunction === 'function') {
                                        checkFunction(
                                            $body,
                                            (
                                                violations: CustomViolationReturnType[]
                                            ) =>
                                                processViolations(
                                                    currentPath,
                                                    violations,
                                                    errorList,
                                                    viewport.name,
                                                    scenario.name
                                                )
                                        )
                                    }
                                }
                            )
                        })

                        cy.get('head').then(($head) => {
                            Object.values(HeadChecks).forEach(
                                (checkFunction) => {
                                    if (typeof checkFunction === 'function') {
                                        checkFunction(
                                            $head,
                                            (
                                                violations: CustomViolationReturnType[]
                                            ) => {
                                                processViolations(
                                                    currentPath,
                                                    violations,
                                                    errorList,
                                                    viewport.name,
                                                    scenario.name
                                                )
                                            }
                                        )
                                    }
                                }
                            )
                        })

                        cy.get('html').then(($html) => {
                            Object.values(HtmlChecks).forEach(
                                (checkFunction) => {
                                    if (typeof checkFunction === 'function') {
                                        checkFunction(
                                            $html,
                                            (
                                                violations: CustomViolationReturnType[]
                                            ) => {
                                                processViolations(
                                                    currentPath,
                                                    violations,
                                                    errorList,
                                                    viewport.name,
                                                    scenario.name
                                                )
                                            }
                                        )
                                    }
                                }
                            )
                        })
                    })
                }
            )
        }
    )
}
