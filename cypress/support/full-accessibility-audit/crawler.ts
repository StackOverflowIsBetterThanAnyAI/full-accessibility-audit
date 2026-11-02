import { getLinks } from './get-links'
import { toAbsoluteUrl, toPage } from './page-url'
import { resolvePage } from './resolve-page'
import {
    cleanUpExistingPattern,
    isPathAllowedForAudit,
} from './sitemap-patterns'
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

    const knownKeys = new Set<string>()
    const auditUrls = new Set<string>()
    const queue: PageType[] = []
    let crawledPages = 0

    const toAppPage = (url: string) => toPage(url, baseUrl, queryParams)

    const enqueue = (page: PageType | null) => {
        if (page && !knownKeys.has(page.key)) {
            knownKeys.add(page.key)
            queue.push(page)
        }
    }

    // a redirect may lead to another page, which must only be handled once
    const claimRedirectTarget = (page: PageType, target: PageType | null) => {
        if (!target) {
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

    const addToAudit = (path: string | undefined) => {
        if (path && isPathAllowedForAudit(sitemapConfig, path)) {
            auditUrls.add(path)
        }
    }

    const crawlPage = (page: PageType) => {
        crawledPages++
        cy.visit(toAbsoluteUrl(page.path, baseUrl), { failOnStatusCode: false })

        getLinks().then((links) =>
            links.forEach((link) => enqueue(toAppPage(link)))
        )

        // client side redirects (meta refresh, JavaScript) replace the visited page
        cy.location('href', { log: false }).then((currentUrl) =>
            addToAudit(claimRedirectTarget(page, toAppPage(currentUrl))?.path)
        )
    }

    const processQueue = () => {
        const page = queue.shift()
        if (!page || crawledPages >= maxPages) {
            return
        }

        const [requestUrl, hash] = splitHash(toAbsoluteUrl(page.path, baseUrl))

        resolvePage(requestUrl).then((finalUrl) => {
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
        })
    }

    // errors of the application must not stop the crawler
    cy.on('uncaught:exception', () => false)

    return cy
        .then(() => {
            if (sitemapConfig.only?.length) {
                sitemapConfig.only.forEach((item) =>
                    auditUrls.add(cleanUpExistingPattern(item))
                )
                return
            }

            sitemapConfig.included?.forEach((item) =>
                addToAudit(cleanUpExistingPattern(item))
            )

            enqueue(toAppPage(toAbsoluteUrl('/', baseUrl)))
            processQueue()
        })
        .then(() => Array.from(auditUrls))
}
