import { NON_HTML_EXTENSIONS } from './non-html-extensions'
import { PageType } from './types'
import { removeTrailingSlash } from './url-helper'

const TRACKING_PARAMETER =
    /^(utm_.*|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|_ga|_gl|yclid|igshid)$/i

const getBasePath = (baseUrl: string) =>
    removeTrailingSlash(new URL(baseUrl).pathname).replace(/^\/$/, '')

const isInsideBasePath = (pathname: string, basePath: string) =>
    !basePath || pathname === basePath || pathname.startsWith(`${basePath}/`)

const normalizePathname = (pathname: string) =>
    pathname
        .replace(/\/{2,}/g, '/')
        .replace(/%[0-9a-f]{2}/gi, (encoded) => encoded.toUpperCase())

const hasNonHtmlExtension = (pathname: string) => {
    const lastSegment = pathname.split('/').pop() || ''
    const extension = lastSegment.includes('.')
        ? lastSegment.split('.').pop()!.toLowerCase()
        : ''
    return NON_HTML_EXTENSIONS.has(extension)
}

const toQuery = (parameters: [string, string][]) =>
    parameters.length ? `?${new URLSearchParams(parameters).toString()}` : ''

const getHashRoute = (hash: string) =>
    /^#!?\/./.test(hash) ? hash.replace(/(.)\/$/, '$1') : ''

// converts a link into a page of the application, or null if the link does not lead to one
export const toPage = (
    link: string,
    baseUrl: string,
    queryParams: string[] = []
): PageType | null => {
    let url: URL
    try {
        url = new URL(link, baseUrl)
    } catch {
        return null
    }

    const basePath = getBasePath(baseUrl)
    const pathname = normalizePathname(url.pathname)

    if (
        !/^https?:$/.test(url.protocol) ||
        url.origin !== new URL(baseUrl).origin ||
        !isInsideBasePath(pathname, basePath) ||
        hasNonHtmlExtension(pathname)
    ) {
        return null
    }

    const relativePath =
        removeTrailingSlash(
            pathname
                .slice(basePath.length)
                .replace(/\/index\.(html?|php)$/i, '/')
        ) || '/'

    const parameters = [...url.searchParams].filter(
        ([name]) => !TRACKING_PARAMETER.test(name)
    )
    const keyParameters = parameters
        .filter(([name]) => queryParams.includes(name))
        .sort(([a, valueA], [b, valueB]) =>
            a === b ? valueA.localeCompare(valueB) : a.localeCompare(b)
        )
    const hashRoute = getHashRoute(url.hash)

    return {
        key: `${relativePath}${toQuery(keyParameters)}${hashRoute}`,
        path: `${relativePath}${toQuery(parameters)}${hashRoute}`,
    }
}

export const toAbsoluteUrl = (path: string, baseUrl: string) =>
    `${new URL(baseUrl).origin}${getBasePath(baseUrl)}${path}`
