import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { gunzipSync } from 'zlib'

const ARCHIVE_URL =
    'https://codeload.github.com/w3c/wcag-act-rules/tar.gz/refs/heads/main'
const ARCHIVE_FOLDER = 'wcag-act-rules-main/content-assets/wcag-act-rules'

const fixturesPath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const sitePath = join(
    fixturesPath,
    'site',
    'WAI',
    'content-assets',
    'wcag-act-rules'
)
const outputPath = join(fixturesPath, 'testcases.json')

// test cases that cannot be executed reliably inside Cypress
const IGNORED_TESTCASE_IDS = [
    // bc659a Passed Example 1: the redirect leaves the test case page before the audit runs
    '49d79a4e',
    // 0ssw9k Passed Example 3
    'c5f649f9',
]

const rulesArgument = process.argv.find((arg) => arg.startsWith('--rules='))
const selectedRules = rulesArgument
    ? rulesArgument.replace('--rules=', '').split(',').filter(Boolean)
    : []

const response = await fetch(ARCHIVE_URL)
if (!response.ok) {
    throw new Error(
        `Could not download the test cases: ${response.status} ${response.statusText}`
    )
}

const extractFolder = (archive, folder, targetPath) => {
    const readString = (offset, length) =>
        archive
            .subarray(offset, offset + length)
            .toString('utf8')
            .replace(/\0.*$/s, '')

    let offset = 0
    let longName = ''

    while (offset + 512 <= archive.length) {
        const name = readString(offset, 100)
        if (!name) {
            break
        }

        const size = parseInt(readString(offset + 124, 12).trim() || '0', 8)
        const type = readString(offset + 156, 1)
        const prefix = readString(offset + 345, 155)
        const dataOffset = offset + 512
        const data = archive.subarray(dataOffset, dataOffset + size)
        offset = dataOffset + Math.ceil(size / 512) * 512

        if (type === 'x') {
            const pathMatch = data.toString('utf8').match(/\d+ path=([^\n]*)\n/)
            longName = pathMatch ? pathMatch[1] : ''
            continue
        }
        if (type === 'g') {
            continue
        }

        const entryPath = longName || (prefix ? `${prefix}/${name}` : name)
        longName = ''

        if (!entryPath.startsWith(`${folder}/`)) {
            continue
        }

        const relativePath = entryPath.slice(folder.length + 1)
        if (!relativePath || relativePath.split('/').includes('..')) {
            continue
        }

        const outputFile = join(targetPath, ...relativePath.split('/'))
        if (type === '5') {
            mkdirSync(outputFile, { recursive: true })
        } else if (type === '0' || type === '') {
            mkdirSync(dirname(outputFile), { recursive: true })
            writeFileSync(outputFile, data)
        }
    }
}

rmSync(sitePath, { recursive: true, force: true })
mkdirSync(sitePath, { recursive: true })

extractFolder(
    gunzipSync(Buffer.from(await response.arrayBuffer())),
    ARCHIVE_FOLDER,
    sitePath
)

const source = JSON.parse(
    readFileSync(join(sitePath, 'testcases.json'), 'utf8')
)

const testcases = source.testcases.filter((testcase) => {
    if (!testcase.url.endsWith('.html')) {
        return false
    }
    if (IGNORED_TESTCASE_IDS.some((id) => testcase.testcaseId.startsWith(id))) {
        return false
    }
    return !selectedRules.length || selectedRules.includes(testcase.ruleId)
})

writeFileSync(
    outputPath,
    JSON.stringify(
        {
            ...source,
            count: testcases.length,
            fetchedAt: new Date().toISOString(),
            testcases,
        },
        null,
        4
    )
)

console.log(
    `Stored ${testcases.length} of ${source.testcases.length} test cases in ${outputPath}`
)
