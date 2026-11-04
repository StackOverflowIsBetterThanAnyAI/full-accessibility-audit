import {
    hasState,
    resolveState,
    toState,
} from '../cypress/support/full-accessibility-audit/apply-state'
import { crawlSite } from '../cypress/support/full-accessibility-audit/crawler'
import { isPathExcluded } from '../cypress/support/full-accessibility-audit/sitemap-patterns'
import {
    SitemapConfigType,
    StateType,
} from '../cypress/support/full-accessibility-audit/types'

type TestConfigType = Partial<SitemapConfigType> & Record<string, unknown>

// crawls one of the local test sites and yields the paths of the sitemap
const crawlTestSite = (
    name: string,
    config: TestConfigType = {},
    basePath = ''
) => {
    return cy.task<string>('startTestSite', name).then((origin) =>
        crawlSite(`${origin}${basePath}`, {
            only: [],
            included: [],
            excluded: [],
            ...config,
        } as SitemapConfigType)
    )
}

const expectFound = (urls: string[], paths: string[]) => {
    paths.forEach((path) => {
        expect(urls, `sitemap contains "${path}"`).to.include(path)
    })
}

const expectNotFound = (urls: string[], paths: string[]) => {
    paths.forEach((path) => {
        expect(urls, `sitemap does not contain "${path}"`).not.to.include(path)
    })
}

const expectNotRequested = (name: string, paths: string[]) => {
    cy.task<string[]>('getRequestedPaths', name).then((requestedPaths) => {
        paths.forEach((path) => {
            expect(
                requestedPaths.filter(
                    (requestedPath) =>
                        requestedPath === path ||
                        requestedPath.startsWith(`${path}?`)
                ),
                `"${path}" was never requested`
            ).to.deep.equal([])
        })
    })
}

const expectNoDuplicates = (urls: string[]) => {
    const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index)
    expect(duplicates, 'duplicate paths in sitemap').to.deep.equal([])
}

describe('Crawler', () => {
    describe('link types', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('links').then((result) => {
                urls = result
            })
        })

        it('finds relative and root-relative links', () => {
            expectFound(urls, ['/', '/about', '/contact'])
        })

        it('treats trailing slashes, index.html, empty hrefs and anchors as the same page', () => {
            expectNotFound(urls, [
                '/about/',
                '/contact/',
                '/index.html',
                '/about#team',
            ])
            expectNoDuplicates(urls)
        })

        it('ignores external links and non-web protocols', () => {
            expectNotFound(urls, [
                'https://example.com/external',
                '/external',
                '/protocol-relative',
                'mailto:info@example.com',
                'tel:+431234567',
                'javascript:void(0)',
                '/file',
            ])
            urls.forEach((url) => {
                expect(url, 'only paths are stored').to.match(/^\//)
            })
        })

        it('ignores downloads and non-HTML files', () => {
            expectNotFound(urls, [
                '/files/report.PDF',
                '/files/archive.zip',
                '/images/logo.png',
                '/feed.xml',
                '/data.json',
                '/brochure.html',
            ])
        })

        it('finds pages with file extensions like .htm and .php', () => {
            expectFound(urls, ['/docs/guide.htm', '/legacy/page.php'])
        })

        it('finds pages with dots in the path', () => {
            expectFound(urls, ['/users/john.doe', '/v1.2'])
        })

        it('finds pages with encoded characters and trims whitespace in hrefs', () => {
            expectFound(urls, ['/%C3%BCber-uns', '/page%20two', '/spaces'])
        })

        it('resolves relative links against the base element', () => {
            expectFound(urls, ['/based', '/sub/target'])
            expectNotFound(urls, ['/target'])
        })

        it('finds links of image maps', () => {
            expectFound(urls, ['/map-target'])
        })

        it('finds links inside the shadow DOM', () => {
            expectFound(urls, ['/shadow'])
        })

        it('finds links that are rendered after the page has loaded', () => {
            expectFound(urls, ['/dynamic'])
        })

        it('follows link chains and terminates on cycles', () => {
            expectFound(urls, ['/deep/1', '/deep/2', '/deep/3'])
        })
    })

    describe('query parameters', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('query', { queryParams: ['tab'] }).then((result) => {
                urls = result
            })
        })

        it('stores pages that only differ in query parameters once, using the first found url', () => {
            // detail pages usually need their parameters, so the first concrete url represents the path
            expectFound(urls, ['/', '/products?id=1', '/search?q=a+b'])
            expectNotFound(urls, ['/products', '/products?id=2', '/?ref=home'])
        })

        it('removes tracking parameters', () => {
            urls.forEach((url) => {
                expect(url).not.to.match(/utm_|fbclid|gclid/)
            })
        })

        it('keeps allowlisted query parameters as separate pages', () => {
            expectFound(urls, ['/list?tab=reviews', '/list?tab=specs'])
            expectNotFound(urls, ['/list', '/list?sort=asc&tab=specs'])
            expectNoDuplicates(urls)
        })
    })

    describe('hash router', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('hash-router').then((result) => {
                urls = result
            })
        })

        it('finds hash routes as separate pages', () => {
            expectFound(urls, ['/', '/#/about', '/#/contact', '/#/team'])
        })

        it('finds hashbang routes', () => {
            expectFound(urls, ['/#!/legacy'])
        })

        it('ignores plain anchors and the root hash route', () => {
            expectNotFound(urls, ['/#content', '/#/'])
            expectNoDuplicates(urls)
        })

        it('treats hash routes with a trailing slash as the same page', () => {
            expectNotFound(urls, ['/#/about/'])
        })
    })

    describe('base path', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('base-path', {}, '/app').then((result) => {
                urls = result
            })
        })

        it('stores paths relative to the base path', () => {
            expectFound(urls, ['/', '/inner', '/inner2'])
            expectNotFound(urls, ['/app', '/app/inner', '/app/inner2'])
        })

        it('does not leave the base path', () => {
            expectNotFound(urls, [
                '/outside',
                '/outside-only',
                '/application',
                '/../outside',
            ])
            expectNoDuplicates(urls)
        })
    })

    describe('base path with trailing slash', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('base-path', {}, '/app/').then((result) => {
                urls = result
            })
        })

        it('yields the same paths as without the trailing slash', () => {
            expect([...urls].sort()).to.deep.equal(['/', '/inner', '/inner2'])
        })
    })

    describe('advanced cases', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('advanced', { queryParams: ['page'] }).then(
                (result) => {
                    urls = result
                }
            )
        })

        it('treats absolute urls of the same origin as internal, also in uppercase', () => {
            expectFound(urls, ['/absolute', '/uppercase-origin'])
        })

        it('ignores other ports, schemes and hosts', () => {
            expectNotFound(urls, [
                '/other-port',
                '/other-scheme',
                '/other-host',
            ])
            urls.forEach((url) => {
                expect(url, 'no javascript urls').not.to.match(/alert/)
            })
        })

        it('normalizes dot segments and double slashes', () => {
            expectFound(urls, [
                '/dot-segments',
                '/single-dot',
                '/docs/double-slash',
            ])
            expectNotFound(urls, [
                '/folder-a/../dot-segments',
                '/./single-dot',
                '/docs//double-slash',
            ])
        })

        it('treats different cases of percent encoding as the same page', () => {
            expectFound(urls, ['/%C3%A4rger'])
            expectNotFound(urls, ['/%c3%a4rger'])
            expectNoDuplicates(urls)
        })

        it('treats index files as the directory', () => {
            expectFound(urls, ['/section'])
            expectNotFound(urls, ['/index.htm', '/section/index.php'])
        })

        it('finds pages with uppercase file extensions', () => {
            expectFound(urls, ['/Page.HTML'])
        })

        it('follows links regardless of target and rel attributes', () => {
            expectFound(urls, ['/new-tab', '/no-follow'])
        })

        it('treats hash-only links as the same page', () => {
            expectNotFound(urls, ['/#', '/#!'])
        })

        it('resolves relative query links and keeps allowlisted parameters', () => {
            expectFound(urls, ['/?page=2'])
            expectNotFound(urls, ['/?page=2&utm_source=x'])
        })

        it('finds links inside SVG graphics, also with xlink:href', () => {
            expectFound(urls, ['/svg-link', '/svg-xlink'])
        })

        it('finds links inside same-origin iframes without storing the frame document', () => {
            expectFound(urls, ['/frame-target'])
            expectNotFound(urls, ['/frame'])
        })

        it('continues crawling pages with uncaught errors of the application', () => {
            expectFound(urls, ['/throws', '/after-error'])
        })

        it('stores the target of client side redirects instead of the redirecting page', () => {
            expectFound(urls, ['/meta-target', '/js-target'])
            expectNotFound(urls, ['/meta-refresh', '/js-redirect'])
        })

        it('stays on pages that redirect to another origin and keeps crawling their links', () => {
            expectFound(urls, [
                '/external-meta-refresh',
                '/external-js-redirect',
                '/after-external-meta',
                '/after-external-js',
            ])
        })

        it('waits for links that are rendered after a slow fetch request', () => {
            expectFound(urls, ['/fetched', '/fetch-target'])
        })

        it('treats server redirects to the trailing slash as the same page', () => {
            expectFound(urls, ['/folder'])
            expectNotFound(urls, ['/folder/'])
        })

        it('skips redirect loops', () => {
            expectNotFound(urls, ['/loop-a', '/loop-b'])
        })

        it('skips XHTML pages, because Cypress can only visit text/html documents', () => {
            expectNotFound(urls, ['/xhtml', '/xhtml-target'])
        })
    })

    describe('errors and redirects', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('errors').then((result) => {
                urls = result
            })
        })

        it('continues crawling after broken pages', () => {
            expectFound(urls, ['/', '/after-errors'])
        })

        it('does not store pages with error status codes', () => {
            expectNotFound(urls, ['/missing', '/server-error'])
        })

        it('stores the target of redirects instead of the original path', () => {
            expectFound(urls, ['/new-page', '/from-redirect'])
            expectNotFound(urls, ['/redirect-old'])
        })

        it('ignores redirects to other origins and non-HTML responses', () => {
            expectNotFound(urls, ['/to-external', '/image-link'])
        })
    })

    describe('unreachable app', () => {
        it('fails if none of the start pages can be crawled', () => {
            cy.on('fail', (error) => {
                expect(error.message).to.contain(
                    'None of the start pages (/) could be crawled'
                )
            })
            crawlTestSite('errors', {}, '/server-error').then(() => {
                throw new Error('the crawler did not fail')
            })
        })
    })

    describe('limits', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('limits', { maxPages: 10 }).then((result) => {
                urls = result
            })
        })

        it('stops after the configured maximum amount of pages', () => {
            expect(urls).to.have.length(10)
            expectFound(urls, ['/', '/page/1'])
        })
    })

    describe('excluded patterns', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('patterns', {
                queryParams: ['sort', 'print'],
                excluded: [
                    '/admin/*',
                    '/logout',
                    '/blog/*/2024',
                    '/private',
                    '/shop?print=*',
                    '/docs#/private',
                    '/team/',
                ],
            }).then((result) => {
                urls = result
            })
        })

        it('excludes subpages with a trailing wildcard, but not the parent page', () => {
            expectFound(urls, ['/admin', '/administration'])
            expectNotFound(urls, ['/admin/users', '/admin/users/edit'])
        })

        it('does not visit excluded pages', () => {
            expectNotRequested('patterns', [
                '/admin/users',
                '/admin/users/edit',
                '/logout',
            ])
        })

        it('does not follow links of excluded pages', () => {
            expectNotFound(urls, ['/admin-only-target'])
            expectNotRequested('patterns', ['/admin-only-target'])
        })

        it('excludes all query parameters of an excluded path', () => {
            expectNotFound(urls, ['/logout', '/logout?redirect=1'])
        })

        it('supports wildcards in the middle of a pattern', () => {
            expectFound(urls, ['/blog', '/blog/post-1'])
            expectNotFound(urls, ['/blog/archive/2024'])
        })

        it('matches patterns case-insensitively', () => {
            expectNotFound(urls, ['/Private'])
        })

        it('matches query parameters and hash routes contained in the pattern', () => {
            expectFound(urls, ['/shop?sort=price', '/docs#/intro'])
            expectNotFound(urls, ['/shop?print=1', '/docs#/private'])
        })

        it('ignores trailing slashes of patterns', () => {
            expectNotFound(urls, ['/team'])
        })

        it('does not follow redirects to excluded pages', () => {
            expectNotFound(urls, ['/redirect-to-admin', '/admin/secret'])
            expectNotRequested('patterns', ['/admin/secret'])
        })
    })

    describe('included pages', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('patterns', {
                included: [
                    '/hidden',
                    'about/',
                    '/missing-included',
                    '/admin/users',
                    '/blog/*',
                ],
                excluded: ['/admin/*'],
            }).then((result) => {
                urls = result
            })
        })

        it('adds pages that are not linked from the start page', () => {
            expectFound(urls, ['/hidden'])
        })

        it('crawls the links of included pages', () => {
            expectFound(urls, ['/hidden-child'])
        })

        it('normalizes included paths', () => {
            expectFound(urls, ['/about'])
            expectNotFound(urls, ['about/', '/about/'])
            expectNoDuplicates(urls)
        })

        it('does not add included pages that do not exist', () => {
            expectNotFound(urls, ['/missing-included'])
        })

        it('gives excluded patterns priority over included pages', () => {
            expectNotFound(urls, ['/admin/users', '/admin-only-target'])
            expectNotRequested('patterns', ['/admin/users'])
        })

        it('ignores wildcards in included pages', () => {
            expectNotFound(urls, ['/blog/*', '/blog/'])
        })
    })

    describe('only', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('patterns', {
                only: ['/about', 'hidden/', '/admin/users'],
                included: ['/blog'],
                excluded: ['/admin/*'],
            }).then((result) => {
                urls = result
            })
        })

        it('audits exactly the configured pages without crawling', () => {
            expect(urls).to.deep.equal(['/about', '/hidden'])
            cy.task<string[]>('getRequestedPaths', 'patterns').then(
                (requestedPaths) => {
                    expect(requestedPaths, 'requested pages').to.deep.equal([])
                }
            )
        })
    })

    describe('excluding everything', () => {
        let urls: string[] = []

        before(() => {
            crawlTestSite('patterns', { excluded: ['*'] }).then((result) => {
                urls = result
            })
        })

        it('yields an empty sitemap without visiting any page', () => {
            expect(urls).to.deep.equal([])
            expectNotRequested('patterns', ['/'])
        })
    })

    describe('injected state', () => {
        const state: StateType = {
            localStorage: {
                token: '{{env.CRAWLER_TEST_TOKEN}}',
                settings: { theme: 'dark' },
            },
            sessionStorage: { session: 'session-value' },
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
        const statePages = [
            '/local.html',
            '/object.html',
            '/session.html',
            '/cookie.html',
            '/indexeddb.html',
            '/server.html',
        ]

        it('finds no protected pages without state', () => {
            crawlTestSite('state').then((urls) => {
                expectFound(urls, ['/'])
                expectNotFound(urls, statePages)
            })
        })

        it('finds the pages that require local storage, session storage, cookies and IndexedDB', () => {
            cy.task<string>('startTestSite', 'state').then((origin) =>
                resolveState(state)
                    .then((resolvedState) =>
                        crawlSite(
                            origin,
                            { only: [], included: [], excluded: [] },
                            resolvedState
                        )
                    )
                    .then((urls) => expectFound(urls, statePages))
            )
        })

        it('replaces placeholders with environment variables', () => {
            resolveState(state).then((resolvedState) => {
                expect(resolvedState?.localStorage?.token).to.equal(
                    'local-secret'
                )
                expect(resolvedState?.cookies).to.deep.equal(state.cookies)
            })
        })

        it('converts the legacy globalStorage', () => {
            expect(
                toState({
                    globalStorage: {
                        type: 'sessionStorage',
                        data: { token: 'abc' },
                    },
                })
            ).to.deep.equal({ sessionStorage: { token: 'abc' } })
            expect(hasState(toState({ globalStorage: null }))).to.equal(false)
        })
    })
})

describe('Sitemap patterns', () => {
    const cases: [pattern: string, path: string, excluded: boolean][] = [
        ['/admin/*', '/admin', false],
        ['/admin/*', '/admin/users', true],
        ['/admin/*', '/admin/users/edit', true],
        ['/admin*', '/admin', true],
        ['/admin*', '/administration', true],
        ['/admin', '/administration', false],
        ['/admin', '/admin?tab=1', true],
        ['/admin', '/admin#/users', true],
        ['/admin/', '/admin', true],
        [' admin ', '/admin', true],
        ['/Admin', '/admin', true],
        ['/blog/*/2024', '/blog/archive/2024', true],
        ['/blog/*/2024', '/blog/archive/2025', false],
        ['/shop?print=*', '/shop?print=1', true],
        ['/shop?print=*', '/shop?sort=price', false],
        ['/shop?print=*', '/shop', false],
        ['/docs#/private', '/docs#/private', true],
        ['/docs#/private', '/docs#/intro', false],
        ['/v1.2', '/v1x2', false],
        ['/c++', '/c++', true],
        ['/(group)', '/(group)', true],
        ['/', '/', true],
        ['/', '/about', false],
        ['*', '/', true],
        ['*', '/any/page?with=query', true],
    ]

    cases.forEach(([pattern, path, excluded]) => {
        it(`"${pattern}" ${excluded ? 'excludes' : 'does not exclude'} "${path}"`, () => {
            expect(isPathExcluded([pattern], path)).to.equal(excluded)
        })
    })

    it('excludes nothing without patterns', () => {
        expect(isPathExcluded([], '/admin')).to.equal(false)
    })
})
