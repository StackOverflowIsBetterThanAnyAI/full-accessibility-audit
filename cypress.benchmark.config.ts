import { defineConfig } from 'cypress'
import config from './cypress.config'
import { startBenchmarkServer } from './benchmark/benchmark-server'

export default defineConfig({
    ...config,
    e2e: {
        ...config.e2e,
        baseUrl: null,
        specPattern: 'benchmark/**/*.cy.ts',
        fixturesFolder: 'benchmark/fixtures',
        screenshotsFolder: 'benchmark/screenshots',
        async setupNodeEvents(on, cypressConfig) {
            const benchmarkOrigin = await startBenchmarkServer(
                'benchmark/fixtures/site'
            )
            on('task', {
                getBenchmarkOrigin() {
                    return benchmarkOrigin
                },
            })
            return config.e2e?.setupNodeEvents?.(on, cypressConfig)
        },
    },
})
