import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const benchmarkPath = dirname(fileURLToPath(import.meta.url))
const baselinePath = join(benchmarkPath, 'baseline.json')
const resultsPath = join(benchmarkPath, 'results', 'act-benchmark.json')
const testcasesPath = join(benchmarkPath, 'fixtures', 'testcases.json')

const CORRECT_OUTCOMES = ['TP', 'TN']

const readJson = (path, hint) => {
    if (!existsSync(path)) {
        throw new Error(`${path} does not exist. ${hint}`)
    }
    return JSON.parse(readFileSync(path, 'utf8'))
}

const results = readJson(resultsPath, 'Run "npm run benchmark" first.')

if (process.argv.includes('--update')) {
    const outcomes = Object.fromEntries(
        results.results
            .map((result) => [
                result.testcaseId,
                {
                    ruleId: result.ruleId,
                    testcaseTitle: result.testcaseTitle,
                    outcome: result.outcome,
                },
            ])
            .sort(([a], [b]) => a.localeCompare(b))
    )
    writeFileSync(
        baselinePath,
        `${JSON.stringify({ summary: results.summary, outcomes }, null, 4)}\n`
    )
    console.log(
        `Stored the outcomes of ${results.results.length} test cases in ${baselinePath}`
    )
    process.exit(0)
}

const baseline = readJson(
    baselinePath,
    'Run "npm run benchmark:update-baseline" first.'
)
const testcases = readJson(
    testcasesPath,
    'Run "npm run benchmark:fetch" first.'
)

const availableIds = new Set(testcases.testcases.map((tc) => tc.testcaseId))
const currentResults = new Map(
    results.results.map((result) => [result.testcaseId, result])
)

const regressions = []
const improvements = []
const missing = []
const removedUpstream = []

Object.entries(baseline.outcomes).forEach(([testcaseId, expected]) => {
    const label = `${expected.ruleId} - ${expected.testcaseTitle}`
    if (!availableIds.has(testcaseId)) {
        removedUpstream.push(label)
        return
    }

    const current = currentResults.get(testcaseId)
    if (!current) {
        missing.push(label)
        return
    }
    if (current.outcome === expected.outcome) {
        return
    }

    const change = `${label}: ${expected.outcome} -> ${current.outcome} (${current.url})`
    if (
        CORRECT_OUTCOMES.includes(current.outcome) &&
        !CORRECT_OUTCOMES.includes(expected.outcome)
    ) {
        improvements.push(change)
    } else {
        regressions.push(change)
    }
})

const newTestcases = results.results
    .filter((result) => !baseline.outcomes[result.testcaseId])
    .map(
        (result) =>
            `${result.ruleId} - ${result.testcaseTitle}: ${result.outcome} (${result.url})`
    )

const section = (title, entries) =>
    entries.length
        ? `\n### ${title} (${entries.length})\n\n${entries.map((entry) => `- ${entry}`).join('\n')}\n`
        : ''

const isFailed = regressions.length > 0 || missing.length > 0
const { summary } = results
const expectedSummary = baseline.summary

let report = `## W3C ACT Benchmark: ${isFailed ? 'regressions found' : 'no regressions'}\n\n`
report += `| | Baseline | Current |\n| --- | --- | --- |\n`
for (const key of [
    'testcases',
    'TP',
    'FP',
    'TN',
    'FN',
    'unmappedTestcases',
    'erroredTestcases',
]) {
    report += `| ${key} | ${expectedSummary[key] ?? '-'} | ${summary[key] ?? '-'} |\n`
}
report += section('Regressions', regressions)
report += section('Test cases without result', missing)
report += section(
    'Improvements (run "npm run benchmark:update-baseline" to keep them)',
    improvements
)
report += section('New W3C test cases', newTestcases)
report += section('Test cases removed by the W3C', removedUpstream)

console.log(report)
if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
}

process.exit(isFailed ? 1 : 0)
