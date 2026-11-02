const MAX_REDIRECTS = 10

// follows redirects within the origin and yields the final url, or null if it is no reachable HTML page
export const resolvePage = (
    url: string,
    redirects = 0
): Cypress.Chainable<string | null> => {
    // returning a chainable from then() yields its subject, which TypeScript cannot infer
    return cy
        .request({
            url,
            failOnStatusCode: false,
            followRedirect: false,
            log: false,
        })
        .then((response): unknown => {
            if (response.status >= 300 && response.status < 400) {
                const location =
                    response.redirectedToUrl || response.headers.location
                if (!location || redirects >= MAX_REDIRECTS) {
                    return null
                }

                const target = new URL(String(location), url)
                if (target.origin !== new URL(url).origin) {
                    return null
                }
                return resolvePage(target.href, redirects + 1)
            }

            // cy.visit only supports text/html, other documents (e.g. XHTML) cannot be audited
            const contentType = String(response.headers['content-type'] || '')
            const isHtml = !contentType || /text\/html/i.test(contentType)

            return response.status >= 200 && response.status < 300 && isHtml
                ? url
                : null
        }) as Cypress.Chainable<string | null>
}
