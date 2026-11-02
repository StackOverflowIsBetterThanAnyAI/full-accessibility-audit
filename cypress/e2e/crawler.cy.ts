import { crawlSite } from '../support/full-accessibility-audit/crawler'
import { SitemapConfigType } from '../support/full-accessibility-audit/types'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let globalStorageData: any = null

    it('Crawls all pages based on config', () => {
        cy.task<boolean>('checkIfFileExists', sitemapPath).then((exists) => {
            if (exists) {
                cy.readFile(sitemapPath).then((existingSitemap) => {
                    if (existingSitemap && existingSitemap.config) {
                        sitemapConfig = existingSitemap.config
                        globalStorageData =
                            existingSitemap.globalStorage || null
                    }
                })
            }
        })

        cy.then(() => crawlSite(baseUrl, sitemapConfig)).then((urls) => {
            cy.writeFile(sitemapPath, {
                config: sitemapConfig,
                globalStorage: globalStorageData,
                urls,
                generatedAt: new Date().toISOString(),
            })
        })
    })
})
