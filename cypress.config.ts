/// <reference types="node" />
import { defineConfig } from 'cypress'
import * as fs from 'fs'

export default defineConfig({
    e2e: {
        allowCypressEnv: false,
        screenshotOnRunFailure: false,
        baseUrl: 'http://localhost:5173',
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setupNodeEvents(on, _config) {
            on('task', {
                checkIfFileExists(path: string) {
                    return fs.existsSync(path)
                },
                resolveStatePlaceholders(state: unknown) {
                    return JSON.parse(JSON.stringify(state), (_key, value) =>
                        typeof value === 'string'
                            ? value.replace(
                                  /\{\{\s*env\.([A-Za-z0-9_]+)\s*\}\}/g,
                                  (_match, name: string) => {
                                      const envValue = process.env[name]
                                      if (envValue === undefined) {
                                          throw new Error(
                                              `The environment variable "${name}" used in the state of the sitemap is not set`
                                          )
                                      }
                                      return envValue
                                  }
                              )
                            : value
                    )
                },
            })
        },
    },
})
