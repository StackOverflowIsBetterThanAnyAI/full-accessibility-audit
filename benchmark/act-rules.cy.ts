import axe from 'axe-core'
import { runAxeAudit } from '../cypress/support/full-accessibility-audit/auditor'
import {
    ErrorListType,
    W3CActTestCaseType,
} from '../cypress/support/full-accessibility-audit/types'
import { toLocalTestcaseUrl } from './benchmark-url'

type OutcomeType = 'TP' | 'FP' | 'TN' | 'FN'

type BenchmarkResultType = {
    ruleId: string
    ruleName: string
    testcaseTitle: string
    url: string
    expected: string
    outcome: OutcomeType | 'unmapped'
    mappedIds: string[]
    detectedIds: string[]
}

Cypress.Commands.overwrite('screenshot', () => {})

describe('System Benchmark: W3C ACT Rules Validation', () => {
    let benchmarkData: { testcases: W3CActTestCaseType[] }
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        benchmarkData = require('./fixtures/testcases.json')
    } catch {
        throw new Error(
            'No test cases found. Run "npm run benchmark:fetch" first.'
        )
    }

    const customActMapping: Record<string, string[]> = {
        '23a2a8': ['bad-alt-image'],
        qt1vmo: ['bad-alt-image'],
        '59796f': ['bad-alt-input-image'],
        '46ca7f': ['conflict-decorative-role'],
        bc659a: ['meta-refresh-delay-a'],
        bisz58: ['meta-refresh-delay-aaa'],
        b4f0c3: ['meta-valid-viewport'],
        ffd0e9: ['non-empty-heading'],
        '2t702h': ['details-summary-name'],
        kb1m8s: ['prohibited-aria-naming'],
        off6ek: ['language-mismatch'],
        ucwvc8: ['primary-language-mismatch'],
        '2ee8b8': ['label-in-name'],
        bc4a75: ['list-invalid-structure'],
    }

    const actToRuleIds: Record<string, string[]> = {}

    axe.getRules().forEach((rule) => {
        if (rule?.actIds && Array.isArray(rule.actIds)) {
            rule.actIds.forEach((id: string) => {
                actToRuleIds[id] = [...(actToRuleIds[id] || []), rule.ruleId]
            })
        }
    })

    Object.entries(customActMapping).forEach(([actId, ruleIds]) => {
        actToRuleIds[actId] = [...(actToRuleIds[actId] || []), ...ruleIds]
    })

    const results: BenchmarkResultType[] = []
    let benchmarkOrigin = ''

    before(() => {
        cy.task<string>('getBenchmarkOrigin').then((origin) => {
            benchmarkOrigin = origin
        })
    })

    const totalTestcases = benchmarkData.testcases.length

    benchmarkData.testcases.forEach((tc, index) => {
        it(`[${index + 1}/${totalTestcases}] Benchmark ${tc.ruleId} - ${tc.testcaseTitle}`, () => {
            const errorList: ErrorListType[] = []
            const mappedIds = actToRuleIds[tc.ruleId] || []

            runAxeAudit(toLocalTestcaseUrl(benchmarkOrigin, tc.url), errorList)

            cy.then(() => {
                const detectedIds = [
                    ...new Set(errorList.map((error) => error.id)),
                ]
                const targetIssueFound = detectedIds.some((id) =>
                    mappedIds.includes(id)
                )
                const expectsFailure = tc.expected === 'failed'

                let outcome: BenchmarkResultType['outcome'] = 'unmapped'
                if (mappedIds.length) {
                    if (expectsFailure) {
                        outcome = targetIssueFound ? 'TP' : 'FN'
                    } else {
                        outcome = targetIssueFound ? 'FP' : 'TN'
                    }
                }

                results.push({
                    ruleId: tc.ruleId,
                    ruleName: tc.ruleName,
                    testcaseTitle: tc.testcaseTitle,
                    url: tc.url,
                    expected: tc.expected,
                    outcome,
                    mappedIds,
                    detectedIds,
                })

                const contextInfo = `
                    --- Diagnosis ---
                    ACT Rule ID: ${tc.ruleId}
                    Expected Rule IDs: ${mappedIds.join(', ') || 'not mapped'}
                    Expected Outcome: ${tc.expected}
                    Detected IDs: [${detectedIds.join(', ')}]
                    ----------------
                `

                if (outcome === 'FN') {
                    throw new Error(
                        `Expected rule "${mappedIds.join(', ')}" but only found [${detectedIds.join(', ')}].\n${contextInfo}`
                    )
                }
                if (outcome === 'FP') {
                    throw new Error(
                        `False positive: Rule "${mappedIds.join(', ')}" triggered.\n${contextInfo}`
                    )
                }
                if (outcome === 'unmapped' && expectsFailure) {
                    throw new Error(
                        `ACT rule expected a failure but no rule is mapped to it.\n${contextInfo}`
                    )
                }
            })
        })
    })

    after(() => {
        const rules: Record<
            string,
            { ruleName: string } & Record<OutcomeType | 'unmapped', number>
        > = {}

        results.forEach((result) => {
            rules[result.ruleId] ||= {
                ruleName: result.ruleName,
                TP: 0,
                FP: 0,
                TN: 0,
                FN: 0,
                unmapped: 0,
            }
            rules[result.ruleId][result.outcome]++
        })

        const count = (outcome: OutcomeType | 'unmapped') =>
            results.filter((result) => result.outcome === outcome).length
        const ratio = (value: number, total: number) =>
            total ? Number((value / total).toFixed(4)) : null

        const [tp, fp, tn, fn] = [
            count('TP'),
            count('FP'),
            count('TN'),
            count('FN'),
        ]
        const summary = {
            testcases: results.length,
            mappedTestcases: tp + fp + tn + fn,
            unmappedTestcases: count('unmapped'),
            TP: tp,
            FP: fp,
            TN: tn,
            FN: fn,
            precision: ratio(tp, tp + fp),
            recall: ratio(tp, tp + fn),
            falsePositiveRate: ratio(fp, fp + tn),
            timestamp: new Date().toISOString(),
        }

        let mdContent = `# W3C ACT Benchmark\n\n`
        mdContent += `> - **Test cases:** ${summary.testcases} (${summary.unmappedTestcases} without mapped rule)\n`
        mdContent += `> - **TP / FP / TN / FN:** ${tp} / ${fp} / ${tn} / ${fn}\n`
        mdContent += `> - **Precision:** ${summary.precision ?? '-'}\n`
        mdContent += `> - **Recall:** ${summary.recall ?? '-'}\n`
        mdContent += `> - **False positive rate:** ${summary.falsePositiveRate ?? '-'}\n\n`
        mdContent += `| ACT Rule | Name | TP | FP | TN | FN | unmapped |\n`
        mdContent += `| --- | --- | --- | --- | --- | --- | --- |\n`
        Object.entries(rules)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([ruleId, rule]) => {
                mdContent += `| ${ruleId} | ${rule.ruleName} | ${rule.TP} | ${rule.FP} | ${rule.TN} | ${rule.FN} | ${rule.unmapped} |\n`
            })

        cy.writeFile('benchmark/results/act-benchmark.json', {
            summary,
            rules,
            results,
        })
        cy.writeFile('benchmark/results/act-benchmark.md', mdContent)
    })
})
