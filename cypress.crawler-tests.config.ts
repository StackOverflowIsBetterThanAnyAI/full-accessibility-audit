import { defineConfig } from 'cypress'
import config from './cypress.config'
import { startTestSite } from './crawler-tests/test-site-server'

export default defineConfig({
    ...config,
    e2e: {
        ...config.e2e,
        baseUrl: null,
        specPattern: 'crawler-tests/**/*.cy.ts',
        screenshotsFolder: 'crawler-tests/screenshots',
        setupNodeEvents(on, cypressConfig) {
            const origins: Record<string, Promise<string>> = {}
            const requestedPaths: Record<string, string[]> = {}
            on('task', {
                startTestSite(name: string) {
                    requestedPaths[name] = []
                    origins[name] ||= startTestSite(
                        `crawler-tests/sites/${name}`,
                        (path) => requestedPaths[name].push(path)
                    )
                    return origins[name]
                },
                getRequestedPaths(name: string) {
                    return requestedPaths[name] || []
                },
            })
            return config.e2e?.setupNodeEvents?.(on, cypressConfig)
        },
    },
})
