import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

export const resultsPath = join(
    dirname(fileURLToPath(import.meta.url)),
    'results'
)

export const OUTCOMES = ['TP', 'FP', 'TN', 'FN', 'unmapped', 'error']
export const SUMMARY_KEYS = [
    'testcases',
    'mappedTestcases',
    'unmappedTestcases',
    'erroredTestcases',
    'TP',
    'FP',
    'TN',
    'FN',
    'precision',
    'recall',
    'falsePositiveRate',
]
const RATIO_KEYS = ['precision', 'recall', 'falsePositiveRate']

export const hasResults = (name) =>
    existsSync(join(resultsPath, `${name}.json`))

export const readResults = (name, command) => {
    const path = join(resultsPath, `${name}.json`)
    if (!existsSync(path)) {
        throw new Error(`${path} does not exist. Run "${command}" first.`)
    }
    return JSON.parse(readFileSync(path, 'utf8'))
}

export const formatSummaryValue = (key, value) =>
    RATIO_KEYS.includes(key) && typeof value === 'number'
        ? `${(value * 100).toFixed(2)} %`
        : (value ?? '-')

const emptyRule = (ruleName) => ({
    ruleName,
    ...Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])),
})
const isCovered = (rule) => rule.TP + rule.FP + rule.TN + rule.FN > 0

export const compareRules = (full, axeOnly) => {
    const ruleIds = [
        ...new Set([...Object.keys(full.rules), ...Object.keys(axeOnly.rules)]),
    ].sort()

    const onlyFull = []
    const changed = []

    ruleIds.forEach((ruleId) => {
        const fullRule =
            full.rules[ruleId] || emptyRule(axeOnly.rules[ruleId].ruleName)
        const axeRule = axeOnly.rules[ruleId] || emptyRule(fullRule.ruleName)

        if (isCovered(fullRule) && !isCovered(axeRule)) {
            onlyFull.push({ ruleId, rule: fullRule })
        }
        if (
            OUTCOMES.some((outcome) => fullRule[outcome] !== axeRule[outcome])
        ) {
            changed.push({ ruleId, fullRule, axeRule })
        }
    })

    return { onlyFull, changed }
}

export const markdownTable = (header, rows) => {
    const widths = header.map((_, column) =>
        Math.max(
            3,
            ...[header, ...rows].map((row) => String(row[column]).length)
        )
    )
    const toRow = (cells) =>
        `| ${cells.map((cell, column) => String(cell).padEnd(widths[column])).join(' | ')} |`
    return [
        toRow(header),
        toRow(widths.map((width) => '-'.repeat(width))),
        ...rows.map(toRow),
    ].join('\n')
}

export const changedRulesTable = (changed) =>
    markdownTable(
        ['ACT Rule', 'Name', ...OUTCOMES],
        changed.map(({ ruleId, fullRule, axeRule }) => [
            ruleId,
            fullRule.ruleName,
            ...OUTCOMES.map(
                (outcome) => `${axeRule[outcome]} → ${fullRule[outcome]}`
            ),
        ])
    )
