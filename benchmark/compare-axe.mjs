import { writeFileSync } from 'fs'
import { join } from 'path'
import {
    changedRulesTable,
    compareRules,
    readResults,
    resultsPath,
    SUMMARY_KEYS,
} from './benchmark-results.mjs'

const full = readResults('act-benchmark', 'npm run benchmark')
const axeOnly = readResults('act-benchmark-axe', 'npm run benchmark:axe')

const signed = (value) => (value > 0 ? `+${value}` : `${value}`)

let report = `# W3C ACT Benchmark: full audit vs. axe-core only\n\n`
report += `| | axe-core only | Full audit | Difference |\n| --- | --- | --- | --- |\n`
for (const key of SUMMARY_KEYS) {
    const before = axeOnly.summary[key]
    const after = full.summary[key]
    const difference =
        typeof before === 'number' && typeof after === 'number'
            ? signed(Number((after - before).toFixed(4)))
            : '-'
    report += `| ${key} | ${before ?? '-'} | ${after ?? '-'} | ${difference} |\n`
}

const { onlyFull, changed } = compareRules(full, axeOnly)

report += `\n## ACT rules only covered by the full audit (${onlyFull.length})\n\n`
report += `${onlyFull.map(({ ruleId, rule }) => `- ${ruleId} - ${rule.ruleName}: TP ${rule.TP}, FP ${rule.FP}, TN ${rule.TN}, FN ${rule.FN}`).join('\n') || '-'}\n`
report += `\n## ACT rules with different outcomes (${changed.length})\n\n`
report += `Each cell shows axe-core only → full audit.\n\n`
report += `${changedRulesTable(changed)}\n`

writeFileSync(join(resultsPath, 'act-benchmark-vs-axe.md'), report)
console.log(report)
