import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
    changedRulesTable,
    compareRules,
    formatSummaryValue,
    hasResults,
    readResults,
    SUMMARY_KEYS,
} from './benchmark-results.mjs'

const readmePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'README.md'
)

const replaceSection = (readme, name, content) => {
    const start = `<!-- ${name}:start -->`
    const end = `<!-- ${name}:end -->`
    const startIndex = readme.indexOf(start)
    const endIndex = readme.indexOf(end)
    if (startIndex === -1 || endIndex < startIndex) {
        throw new Error(`README.md does not contain ${start} and ${end}`)
    }
    return `${readme.slice(0, startIndex + start.length)}\n\n${content.trim()}\n\n${readme.slice(endIndex)}`
}

const full = readResults('act-benchmark', 'npm run benchmark')
const { summary } = full

let resultsSection = `| Test cases | Mapped | TP | FP | TN | FN | Precision | Recall | False positive rate |\n`
resultsSection += `| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`
resultsSection += `| ${summary.testcases} | ${summary.mappedTestcases} | ${summary.TP} | ${summary.FP} | ${summary.TN} | ${summary.FN} | ${['precision', 'recall', 'falsePositiveRate'].map((key) => formatSummaryValue(key, summary[key])).join(' | ')} |\n\n`
resultsSection += `${summary.unmappedTestcases} test cases belong to ACT rules without a mapped check, ${summary.erroredTestcases} test cases errored.`

let readme = readFileSync(readmePath, 'utf8')
readme = replaceSection(readme, 'act-benchmark', resultsSection)

if (hasResults('act-benchmark-axe')) {
    const axeOnly = readResults('act-benchmark-axe', 'npm run benchmark:axe')
    const { changed } = compareRules(full, axeOnly)

    let axeSection = `| | axe-core only | Full audit |\n| --- | --- | --- |\n`
    for (const key of SUMMARY_KEYS) {
        axeSection += `| ${key} | ${formatSummaryValue(key, axeOnly.summary[key])} | ${formatSummaryValue(key, summary[key])} |\n`
    }
    axeSection += `\nACT rules with different outcomes (axe-core only → full audit):\n\n`
    axeSection += changedRulesTable(changed)
    readme = replaceSection(readme, 'act-benchmark-axe', axeSection)
}

writeFileSync(readmePath, readme)
console.log(`Updated the benchmark results in ${readmePath}`)
