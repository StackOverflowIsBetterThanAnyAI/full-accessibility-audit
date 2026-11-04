import {
    resolveState,
    toState,
} from '../support/full-accessibility-audit/apply-state'
import { crawlSite } from '../support/full-accessibility-audit/crawler'
import {
    SitemapConfigType,
    StateType,
} from '../support/full-accessibility-audit/types'

describe('Crawler: Discovery Phase', () => {
    const baseUrl = Cypress.config('baseUrl')
    const sitemapPath = 'cypress/fixtures/sitemap.json'

    if (!baseUrl) {
        throw new Error('baseUrl is not defined. Please check your config.')
    }

    let sitemapConfig: SitemapConfigType = {
        only: [],
        included: [],
        excluded: [],
    }
    let state: StateType | null = null

    it('Crawls all pages based on config', () => {
        cy.task<boolean>('checkIfFileExists', sitemapPath).then((exists) => {
            if (exists) {
                cy.readFile(sitemapPath).then((existingSitemap) => {
                    if (existingSitemap && existingSitemap.config) {
                        sitemapConfig = existingSitemap.config
                    }
                    if (existingSitemap) {
                        state = toState(existingSitemap)
                    }
                })
            }
        })

        cy.then(() => resolveState(state))
            .then((resolvedState) =>
                crawlSite(baseUrl, sitemapConfig, resolvedState)
            )
            .then((urls) => {
                // the state is stored with its placeholders, never with the resolved secrets
                cy.writeFile(sitemapPath, {
                    config: sitemapConfig,
                    state,
                    urls,
                    generatedAt: new Date().toISOString(),
                })
            })
    })
})
