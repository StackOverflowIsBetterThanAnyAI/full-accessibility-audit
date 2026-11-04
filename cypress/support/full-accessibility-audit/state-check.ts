import { ViewportType, WarningListType } from './types'
import { removeTrailingSlash } from './url-helper'

// hash routes like #/about are separate pages, anchors like #section are not
const isHashRoute = (hash: string) => /^#!?\//.test(hash)

export const stateWarningMessage = (path: string, redirectedLocation: string) =>
    `${path} redirected to ${redirectedLocation} with the injected state, just like without it. ` +
    `The state might be invalid or expired (e.g. an outdated token), so the page was probably not audited with the state.`

// the location of a page without its origin, comparable regardless of trailing slashes and anchors
export const toComparableLocation = (url: URL | Location): string => {
    const pathname = removeTrailingSlash(url.pathname) || '/'
    const hash = isHashRoute(url.hash) ? removeTrailingSlash(url.hash) : ''
    return `${pathname}${url.search}${hash}`
}

// Apps often redirect to their login when the injected state is invalid or expired (e.g. a JWT),
// so the page would only be audited in its logged-out version without any notice.
// That is the case, if the page leaves the requested url with the state and ends up
// at the same location as without the state.
export const checkStateApplied = (
    path: string,
    requestedLocation: string,
    defaultLocations: Partial<Record<ViewportType, string>>,
    stateLocations: Partial<Record<ViewportType, string>>,
    warningList: WarningListType[]
) => {
    const viewports = (Object.keys(stateLocations) as ViewportType[]).filter(
        (viewport) => {
            const stateLocation = stateLocations[viewport]
            return (
                stateLocation !== requestedLocation &&
                stateLocation === defaultLocations[viewport]
            )
        }
    )

    if (!viewports.length) {
        return
    }

    const redirectedLocation = stateLocations[viewports[0]]
    const message = stateWarningMessage(path, redirectedLocation || '')

    Cypress.log({ displayName: 'state warning', message })
    warningList.push({
        id: 'state-not-applied',
        path,
        message,
        requestedLocation,
        redirectedLocation: redirectedLocation || '',
        viewports,
    })
}
