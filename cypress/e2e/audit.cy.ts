import {
    resolveState,
    toState,
} from '../support/full-accessibility-audit/apply-state'
import { runAxeAudit } from '../support/full-accessibility-audit/auditor'
import {
    ErrorListType,
    StateType,
} from '../support/full-accessibility-audit/types'

const toCodeBlock = (code: string, language = '') => {
    const longestBackticks = Math.max(
        0,
        ...(code.match(/`+/g) || []).map((backticks) => backticks.length)
    )
    const fence = '`'.repeat(Math.max(3, longestBackticks + 1))
    return `${fence}${language}\n${code}\n${fence}`
}

const formatIssueAsMarkdown = (error: ErrorListType) => {
    const details = error.rawDetails
    if (!details) {
        return toCodeBlock(error.message)
    }

    const failureSummary = details.failureSummary
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) =>
            /^Fix (all|any) of the following:$/.test(line)
                ? `\n**${line}**\n`
                : `- ${line.replace(/^•\s*/, '')}`
        )
        .join('\n')
        .trim()

    return [
        `**Page:** \`${error.path}\` | **${details.tagString}** | **Severity:** ${details.impact}`,
        `${details.help}.`,
        `**Element:**\n\n${toCodeBlock(details.html, 'html')}`,
        `**Exact DOM Position:** \`${details.exactDomLocation}\``,
        failureSummary,
        `**Found on following environments:**\n\n${error.viewports.map((viewport) => `- ${viewport}`).join('\n')}`,
        `**Help:** ${details.helpUrl}`,
    ].join('\n\n')
}

describe('Accessibility Audit', () => {
    const baseUrl = Cypress.config('baseUrl')
    if (!baseUrl) {
        throw new Error('baseUrl is not defined. Please check your config.')
    }
    let sitemap: { urls: string[] } & Parameters<typeof toState>[0]

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        sitemap = require('../fixtures/sitemap.json')
        if (!sitemap.urls || !sitemap.urls.length) {
            sitemap = { urls: [] }
        }
    } catch {
        sitemap = { urls: [] }
    }

    const errorList: ErrorListType[] = []
    let state: StateType | null = null

    before(() => {
        resolveState(toState(sitemap)).then((resolvedState) => {
            state = resolvedState
        })
    })

    sitemap.urls.forEach((path) => {
        it(`Auditing: ${path}`, () => {
            runAxeAudit(path, errorList, state)
        })
    })

    it('--- Accessibility Audit Summary ---', () => {
        const issues = errorList.filter((error) => !error.isHint)
        const hints = errorList.filter((error) => error.isHint)
        const totalIssues = issues.length
        const jsonPath = 'cypress/fixtures/full-accessibility-audit.json'
        const mdPath = 'cypress/fixtures/full-accessibility-audit.md'

        cy.log('----------------------------')
        cy.log(`Amount of checked pages: ${sitemap.urls.length}`)
        cy.log(`Total issues found: ${totalIssues}`)
        cy.log(`Hints (AAA and best practices): ${hints.length}`)
        cy.log('----------------------------')

        if (!sitemap.urls.length) {
            cy.log(
                'No pages to audit. All pages are excluded or the sitemap contains no urls.'
            )
        }

        cy.writeFile(jsonPath, {
            summary: {
                totalCheckedPages: sitemap.urls.length,
                totalIssues: totalIssues,
                totalHints: hints.length,
                timestamp: new Date().toISOString(),
            },
            issues,
            hints,
        })

        let mdContent = `# Full Accessibility Audit \n\n`
        mdContent += `> - **Total issues found:** ${totalIssues}\n`
        mdContent += `> - **Hints (AAA and best practices):** ${hints.length}\n`
        mdContent += `> - **Amount of checked pages:** ${sitemap.urls.length}\n`
        mdContent += `> - **Timestamp:** ${new Date().toLocaleString('de-DE')}\n\n---\n\n`

        if (!sitemap.urls.length) {
            mdContent +=
                `## No pages to audit\n` +
                `All pages are excluded or the sitemap contains no urls.`
        } else if (!totalIssues) {
            mdContent +=
                `## No issues found!\n` +
                `All checked subpages passed the accessibility audit without any issues.\n` +
                `Keep in mind that there may be other accessibility issues not covered by this audit.`
        } else {
            mdContent += `## Found ${totalIssues} issues\n\n`

            issues.forEach((error, index) => {
                mdContent += `### ${index + 1}. [${error.id}]\n\n${formatIssueAsMarkdown(error)}\n\n---\n\n`
            })
        }

        if (hints.length) {
            mdContent +=
                `\n## ${hints.length} hints\n\n` +
                `These findings go beyond level AA (AAA or best practices) and do not fail the audit.\n\n`

            hints.forEach((error, index) => {
                mdContent += `### ${index + 1}. [${error.id}]\n\n${formatIssueAsMarkdown(error)}\n\n---\n\n`
            })
        }

        cy.writeFile(mdPath, mdContent)

        cy.then(() => {
            if (!totalIssues) {
                cy.log(
                    'All checked subpages passed the accessibility audit without any issues.'
                )
                cy.log(
                    'Keep in mind that there may be other accessibility issues not covered by this audit.'
                )
            } else {
                issues.forEach((error, index) => {
                    cy.log(`${index + 1}. ${error.message}`)
                })

                cy.then(() => {
                    const errorMessage = issues
                        .map((err) => err.message)
                        .join(
                            '\n\n--------------------------------------------------------\n\n'
                        )
                    expect(
                        totalIssues,
                        `Found ${totalIssues} issues:\n${errorMessage}\n\n`
                    ).to.equal(0)
                })
            }
        })
    })
})
