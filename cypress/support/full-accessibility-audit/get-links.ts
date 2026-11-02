import { waitForElementsToStabilize } from './wait-for-elements-to-stabilize'
import { waitForNetworkIdle } from './wait-for-network-idle'

const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

const getLinkHref = (element: Element) =>
    element.getAttribute('href') ||
    element.getAttributeNS(XLINK_NAMESPACE, 'href')

const getMetaRefreshUrl = (element: Element) => {
    if (element.getAttribute('http-equiv')?.toLowerCase() !== 'refresh') {
        return null
    }
    const match = (element.getAttribute('content') || '').match(
        /url\s*=\s*['"]?([^'"]+)/i
    )
    return match?.[1] || null
}

const getFrameDocument = (element: Element) => {
    // instanceof does not work across windows, therefore the tag name is checked
    if (element.tagName !== 'IFRAME') {
        return null
    }
    try {
        return (element as HTMLIFrameElement).contentDocument
    } catch {
        return null
    }
}

// collects all links of the current page, including image maps, SVG graphics,
// open shadow roots, same-origin iframes and delayed meta refresh redirects
export const getLinks = (): Cypress.Chainable<string[]> => {
    waitForNetworkIdle()
    waitForElementsToStabilize('a[href], area[href]')

    return cy.document({ log: false }).then((doc) => {
        const links = new Set<string>()

        const addLink = (href: string | null, base: string) => {
            if (!href) {
                return
            }
            try {
                links.add(new URL(href.trim(), base).href)
            } catch {
                // ignore invalid urls
            }
        }

        const collect = (root: Document | ShadowRoot) => {
            root.querySelectorAll(
                'a:not([download]), area:not([download])'
            ).forEach((element) =>
                addLink(getLinkHref(element), element.baseURI)
            )
            root.querySelectorAll('meta[http-equiv]').forEach((element) =>
                addLink(getMetaRefreshUrl(element), element.baseURI)
            )
            root.querySelectorAll('*').forEach((element) => {
                if (element.shadowRoot) {
                    collect(element.shadowRoot)
                }
                const frameDocument = getFrameDocument(element)
                if (frameDocument) {
                    collect(frameDocument)
                }
            })
        }

        collect(doc)
        return [...links]
    })
}
