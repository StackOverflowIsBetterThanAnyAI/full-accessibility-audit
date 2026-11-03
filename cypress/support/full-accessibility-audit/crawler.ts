import { getLinks } from './get-links'
import { preventLeavingOrigin } from './prevent-leaving-origin'
import { toAbsoluteUrl, toPage } from './page-url'
import { resolvePage } from './resolve-page'
import { isPathExcluded, normalizePath } from './sitemap-patterns'
import { PageType, SitemapConfigType } from './types'

const DEFAULT_MAX_PAGES = 500

const splitHash = (url: string) => {
    const hashIndex = url.indexOf('#')
    return hashIndex === -1
        ? [url, '']
        : [url.slice(0, hashIndex), url.slice(hashIndex)]
}

export const crawlSite = (
    baseUrl: string,
    sitemapConfig: SitemapConfigType
): Cypress.Chainable<string[]> => {
    const queryParams = sitemapConfig.queryParams || []
    const maxPages = sitemapConfig.maxPages || DEFAULT_MAX_PAGES
    const excluded = sitemapConfig.excluded || []

    const knownKeys = new Set<string>()
    const auditUrls = new Set<string>()
    const queue: PageType[] = []
    let crawledPages = 0

    const toAppPage = (url: string) => toPage(url, baseUrl, queryParams)

    const isAllowed = (page: PageType | null): page is PageType =>
        !!page && !isPathExcluded(excluded, page.path)

    const enqueue = (page: PageType | null) => {
        if (isAllowed(page) && !knownKeys.has(page.key)) {
            knownKeys.add(page.key)
            queue.push(page)
        }
    }

    const claimRedirectTarget = (page: PageType, target: PageType | null) => {
        if (!isAllowed(target)) {
            return null
        }
        if (target.key === page.key) {
            return page
        }
        if (knownKeys.has(target.key)) {
            return null
        }
        knownKeys.add(target.key)
        return target
    }

    const toConfiguredPaths = (paths: string[] = []) =>
        paths.map(normalizePath).filter((path) => {
            if (path.includes('*')) {
                cy.log(`Ignored path with wildcard: ${path}`)
                return false
            }
            return !isPathExcluded(excluded, path)
        })

    const crawlPage = (page: PageType) => {
        crawledPages++
        cy.visit(toAbsoluteUrl(page.path, baseUrl), {
            failOnStatusCode: false,
            onBeforeLoad: preventLeavingOrigin,
        })

        getLinks().then((links) =>
            links.forEach((link) => enqueue(toAppPage(link)))
        )

        // client side redirects (meta refresh, JavaScript) replace the visited page
        cy.location('href', { log: false }).then((currentUrl) => {
            const target = claimRedirectTarget(page, toAppPage(currentUrl))
            if (target) {
                auditUrls.add(target.path)
            }
        })
    }

    const processQueue = () => {
        const page = queue.shift()
        if (!page || crawledPages >= maxPages) {
            return
        }

        const [requestUrl, hash] = splitHash(toAbsoluteUrl(page.path, baseUrl))

        resolvePage(requestUrl, (url) => isAllowed(toAppPage(url))).then(
            (finalUrl) => {
                const finalPage =
                    finalUrl === requestUrl
                        ? page
                        : finalUrl &&
                          claimRedirectTarget(page, toAppPage(finalUrl + hash))

                if (finalPage) {
                    crawlPage(finalPage)
                } else {
                    cy.log(`Skipped page: ${page.path}`)
                }
                cy.then(processQueue)
            }
        )
    }

    cy.on('uncaught:exception', () => false)

    return cy
        .then(() => {
            if (sitemapConfig.only?.length) {
                toConfiguredPaths(sitemapConfig.only).forEach((path) =>
                    auditUrls.add(path)
                )
                return
            }

            enqueue(toAppPage(toAbsoluteUrl('/', baseUrl)))
            toConfiguredPaths(sitemapConfig.included).forEach((path) =>
                enqueue(toAppPage(toAbsoluteUrl(path, baseUrl)))
            )
            processQueue()
        })
        .then(() => Array.from(auditUrls))
}
