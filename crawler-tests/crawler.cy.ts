import { crawlSite } from '../cypress/support/full-accessibility-audit/crawler'
import { SitemapConfigType } from '../cypress/support/full-accessibility-audit/types'

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
})
