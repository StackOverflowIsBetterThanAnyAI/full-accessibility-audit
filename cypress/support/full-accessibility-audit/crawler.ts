import {
    applyStateBeforeLoad,
    clearStorage,
    hasState,
    setStateCookies,
} from './apply-state'
import { getLinks } from './get-links'
import { preventLeavingOrigin } from './prevent-leaving-origin'
import { toAbsoluteUrl, toPage } from './page-url'
import { resolvePage } from './resolve-page'
import { isPathExcluded, normalizePath } from './sitemap-patterns'
import { stateWarningMessage } from './state-check'
import {
    PageType,
    SitemapConfigType,
    StateType,
    WarningListType,
} from './types'
import { waitForNetworkIdle } from './wait-for-network-idle'

const DEFAULT_MAX_PAGES = 500

const splitHash = (url: string) => {
    const hashIndex = url.indexOf('#')
    return hashIndex === -1
        ? [url, '']
        : [url.slice(0, hashIndex), url.slice(hashIndex)]
}

export const crawlSite = (
    baseUrl: string,
    sitemapConfig: SitemapConfigType,
    state: StateType | null = null,
    warningList: WarningListType[] = []
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

    // An app that rejects the state (e.g. an expired token) redirects its protected pages to the login,
    // so they would silently disappear from the sitemap. If the page redirects to the same page
    // without the state, the state was probably not accepted.
    const checkStateApplied = (page: PageType, redirectTarget: PageType) => {
        const origin = new URL(baseUrl).origin
        clearStorage(origin)
        cy.visit(toAbsoluteUrl(page.path, baseUrl), {
            failOnStatusCode: false,
            onBeforeLoad: (win) => {
                preventLeavingOrigin(win)
                applyStateBeforeLoad(win, state, false)
            },
        })
        waitForNetworkIdle()
        cy.location('href', { log: false }).then((urlWithoutState) => {
            if (toAppPage(urlWithoutState)?.key !== redirectTarget.key) {
                return
            }
            const message = stateWarningMessage(page.path, redirectTarget.path)
            Cypress.log({ displayName: 'state warning', message })
            warningList.push({
                id: 'state-not-applied',
                path: page.path,
                message,
                requestedLocation: page.path,
                redirectedLocation: redirectTarget.path,
                viewports: [],
            })
        })
        // the next pages are crawled with the state again
        clearStorage(origin)
        setStateCookies(state, baseUrl)
    }

    const crawlPage = (page: PageType) => {
        crawledPages++
        cy.visit(toAbsoluteUrl(page.path, baseUrl), {
            failOnStatusCode: false,
            onBeforeLoad: (win) => {
                preventLeavingOrigin(win)
                applyStateBeforeLoad(win, state, true)
            },
        })

        getLinks().then((links) =>
            links.forEach((link) => enqueue(toAppPage(link)))
        )

        // client side redirects (meta refresh, JavaScript) replace the visited page
        cy.location('href', { log: false }).then((currentUrl) => {
            const currentPage = toAppPage(currentUrl)
            const target = claimRedirectTarget(page, currentPage)
            if (target) {
                auditUrls.add(target.path)
            }
            if (hasState(state) && currentPage && currentPage.key !== page.key) {
                checkStateApplied(page, currentPage)
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
    setStateCookies(state, baseUrl)

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
            const startPages = queue.map((page) => page.path)
            processQueue()

            // an empty sitemap is only valid if there is nothing to crawl, otherwise the app is not reachable
            cy.then(() => {
                if (startPages.length && !auditUrls.size) {
                    throw new Error(
                        `None of the start pages (${startPages.join(', ')}) could be crawled. Check that the app is running at ${baseUrl} and returns an HTML page with a 2xx status code.`
                    )
                }
            })
        })
        .then(() => Array.from(auditUrls))
}
