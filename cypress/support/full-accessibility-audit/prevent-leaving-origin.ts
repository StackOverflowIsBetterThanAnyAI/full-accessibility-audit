type NavigateEventType = Event & {
    cancelable: boolean
    destination: { url: string }
}

// a page that redirects to another origin (meta refresh, JavaScript) could not be audited anymore
export const preventLeavingOrigin = (win: Cypress.AUTWindow) => {
    const { navigation } = win as unknown as { navigation?: EventTarget }

    navigation?.addEventListener('navigate', (event) => {
        const { cancelable, destination } = event as NavigateEventType
        const target = new URL(destination.url)

        // Cypress itself navigates to about:blank between tests
        if (
            cancelable &&
            /^https?:$/.test(target.protocol) &&
            target.origin !== win.location.origin
        ) {
            event.preventDefault()
            Cypress.log({
                displayName: 'blocked navigation',
                message: destination.url,
            })
        }
    })
}

export const isOnOrigin = (win: Cypress.AUTWindow, origin: string) => {
    try {
        return win.location.origin === origin
    } catch {
        return false
    }
}
