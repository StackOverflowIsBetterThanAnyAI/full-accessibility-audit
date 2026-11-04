export const waitForNetworkIdle = (maxTimeout = 10000) => {
    const checkInterval = 200
    const idleThreshold = 1000
    let lastResourceCount = 0
    let timeIdle = 0
    let elapsed = 0

    const check = () => {
        cy.window({ log: false }).then((win) => {
            let currentCount: number
            try {
                currentCount =
                    win.performance.getEntriesByType('resource').length
            } catch {
                // the window has left its origin and cannot be read anymore
                return
            }

            if (currentCount === lastResourceCount) {
                timeIdle += checkInterval
            } else {
                timeIdle = 0
                lastResourceCount = currentCount
            }

            elapsed += checkInterval

            if (timeIdle < idleThreshold && elapsed < maxTimeout) {
                cy.wait(checkInterval, { log: false }).then(check)
            }
        })
    }
    check()
}
