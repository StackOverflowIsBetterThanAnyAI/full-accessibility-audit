import { resolveState } from '../cypress/support/full-accessibility-audit/apply-state'
import { runAxeAudit } from '../cypress/support/full-accessibility-audit/auditor'
import {
    ErrorListType,
    StateType,
} from '../cypress/support/full-accessibility-audit/types'

const DEFAULT_CONTEXTS = ['Mobile (default state)', 'Desktop (default state)']
const STATE_CONTEXTS = ['Mobile (injected state)', 'Desktop (injected state)']

const CUSTOM_CHECK_IDS = [
    'document-title-placeholder',
    'contrast-hover-state',
    'contrast-focus-state',
    'invalid-anchor-element',
    'label-for-orphaned',
    'password-paste-blocked',
    'bad-alt-image',
]

// audits a page of the local audit test site
const auditTestPage = (
    path: string,
    errorList: ErrorListType[],
    state: StateType | null = null,
    options: { axeOnly?: boolean } = {}
) =>
    cy
        .task<string>('startTestSite', 'audit')
        .then((origin) =>
            runAxeAudit(`${origin}${path}`, errorList, state, options)
        )

const findIssue = (errorList: ErrorListType[], id: string, location: string) =>
    errorList.find(
        (error) =>
            error.id === id && error.rawDetails?.exactDomLocation === location
    )

const expectContexts = (
    errorList: ErrorListType[],
    id: string,
    location: string,
    contexts: string[]
) => {
    const issue = findIssue(errorList, id, location)
    expect(issue, `${id} on ${location}`).not.to.equal(undefined)
    expect(
        issue?.viewports,
        `contexts of ${id} on ${location}`
    ).to.have.members(contexts)
}

const expectNoIssue = (
    errorList: ErrorListType[],
    id: string,
    location: string
) => {
    expect(findIssue(errorList, id, location), `${id} on ${location}`).to.equal(
        undefined
    )
}

describe('Audit', () => {
    describe('accessible page', () => {
        it('reports no issues and no hints', () => {
            const errorList: ErrorListType[] = []
            auditTestPage('/clean.html', errorList).then(() => {
                expect(
                    errorList.map((error) => error.message),
                    'issues'
                ).to.deep.equal([])
            })
        })
    })

    describe('custom checks', () => {
        const errorList: ErrorListType[] = []

        before(() => {
            auditTestPage('/custom.html', errorList)
        })

        it('reports the violations of the custom checks', () => {
            const ids = errorList.map((error) => error.id)
            CUSTOM_CHECK_IDS.forEach((id) => expect(ids).to.include(id))
        })

        it('reports the contrast in hover and focus state only for the affected element', () => {
            expectContexts(
                errorList,
                'contrast-hover-state',
                '#hover-link',
                DEFAULT_CONTEXTS
            )
            expectContexts(
                errorList,
                'contrast-focus-state',
                '#focus-link',
                DEFAULT_CONTEXTS
            )
            expectNoIssue(errorList, 'contrast-hover-state', '#focus-link')
            expectNoIssue(errorList, 'contrast-focus-state', '#hover-link')
        })

        it('merges the same issue of both viewports into one entry', () => {
            const keys = errorList.map((error) => error.uniqueKey)
            expect(keys).to.deep.equal([...new Set(keys)])
            expectContexts(
                errorList,
                'label-for-orphaned',
                '#orphaned-label',
                DEFAULT_CONTEXTS
            )
        })

        it('runs only axe-core without the custom checks', () => {
            const axeErrorList: ErrorListType[] = []
            auditTestPage('/custom.html', axeErrorList, null, {
                axeOnly: true,
            }).then(() => {
                const ids = axeErrorList.map((error) => error.id)
                CUSTOM_CHECK_IDS.forEach((id) => expect(ids).not.to.include(id))
            })
        })
    })

    describe('static contrast', () => {
        it('reports an element that is always unreadable once per state', () => {
            const errorList: ErrorListType[] = []
            auditTestPage('/static-contrast.html', errorList).then(() => {
                expect(
                    findIssue(errorList, 'color-contrast', '#low-contrast-link')
                ).not.to.equal(undefined)
                expectContexts(
                    errorList,
                    'contrast-hover-state',
                    '#low-contrast-link',
                    DEFAULT_CONTEXTS
                )
                expectContexts(
                    errorList,
                    'contrast-focus-state',
                    '#low-contrast-link',
                    DEFAULT_CONTEXTS
                )
            })
        })
    })

    describe('injected state', () => {
        const state: StateType = {
            localStorage: { token: '{{env.CRAWLER_TEST_TOKEN}}' },
            sessionStorage: { step: '2' },
            cookies: [
                { name: 'consent', value: 'accepted' },
                { name: 'auth', value: 'server-secret', httpOnly: true },
            ],
            indexedDB: [
                {
                    database: 'app',
                    version: 1,
                    stores: [
                        {
                            name: 'users',
                            keyPath: 'id',
                            records: [{ id: 1, name: 'Ada' }],
                        },
                    ],
                },
            ],
        }
        const stateIssues = [
            ['image-alt', '#local-image'],
            ['label', '#session-input'],
            ['button-name', '#cookie-button'],
            ['select-name', '#indexeddb-select'],
        ]

        const auditWithState = (
            errorList: ErrorListType[],
            path = '/state.html'
        ) =>
            resolveState(state).then((resolvedState) =>
                auditTestPage(path, errorList, resolvedState)
            )

        it('audits every page without and with the state', () => {
            const errorList: ErrorListType[] = []
            auditWithState(errorList).then(() => {
                expectContexts(errorList, 'image-alt', '#always-image', [
                    ...DEFAULT_CONTEXTS,
                    ...STATE_CONTEXTS,
                ])
                stateIssues.forEach(([id, location]) =>
                    expectContexts(errorList, id, location, STATE_CONTEXTS)
                )
            })
        })

        // Cypress does not reset IndexedDB between the tests
        it('does not keep the state of the previous page in the default state', () => {
            const errorList: ErrorListType[] = []
            auditWithState(errorList).then(() => {
                stateIssues.forEach(([id, location]) =>
                    expectContexts(errorList, id, location, STATE_CONTEXTS)
                )
            })
        })

        it('skips the default state of pages that the server only delivers with the state', () => {
            const errorList: ErrorListType[] = []
            auditWithState(errorList, '/protected.html').then(() => {
                expectContexts(
                    errorList,
                    'image-alt',
                    '#protected-image',
                    STATE_CONTEXTS
                )
            })
        })

        it('audits only the default state without a state', () => {
            const errorList: ErrorListType[] = []
            auditTestPage('/state.html', errorList).then(() => {
                expectContexts(
                    errorList,
                    'image-alt',
                    '#always-image',
                    DEFAULT_CONTEXTS
                )
                stateIssues.forEach(([id, location]) =>
                    expectNoIssue(errorList, id, location)
                )
            })
        })
    })

    describe('navigation', () => {
        it('loads the page again for every hash route', () => {
            const errorList: ErrorListType[] = []
            auditTestPage('/hash.html', errorList)
            auditTestPage('/hash.html#/broken', errorList).then(() => {
                expectContexts(
                    errorList,
                    'image-alt',
                    '#hash-image',
                    DEFAULT_CONTEXTS
                )
            })
        })

        it('blocks redirects to other origins and ignores errors of the application', () => {
            const errorList: ErrorListType[] = []
            auditTestPage('/leave-origin.html', errorList).then(() => {
                expectContexts(
                    errorList,
                    'image-alt',
                    '#leave-origin-image',
                    DEFAULT_CONTEXTS
                )
            })
        })
    })
})
