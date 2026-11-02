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
            on('task', {
                startTestSite(name: string) {
                    origins[name] ||= startTestSite(
                        `crawler-tests/sites/${name}`
                    )
                    return origins[name]
                },
            })
            return config.e2e?.setupNodeEvents?.(on, cypressConfig)
        },
    },
})
