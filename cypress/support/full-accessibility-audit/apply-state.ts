import { CookieStateType, IndexedDBStateType, StateType } from './types'

type LegacyGlobalStorageType = {
    type?: 'localStorage' | 'sessionStorage'
    data?: Record<string, unknown>
}

export const toState = (sitemap: {
    state?: StateType | null
    globalStorage?: LegacyGlobalStorageType | null
}): StateType | null => {
    if (sitemap.state) {
        return sitemap.state
    }
    const { globalStorage } = sitemap
    if (globalStorage?.data) {
        return {
            [globalStorage.type === 'sessionStorage'
                ? 'sessionStorage'
                : 'localStorage']: globalStorage.data,
        }
    }
    return null
}

export const hasState = (state?: StateType | null): state is StateType =>
    !!state &&
    (Object.keys(state.localStorage || {}).length > 0 ||
        Object.keys(state.sessionStorage || {}).length > 0 ||
        (state.cookies || []).length > 0 ||
        (state.indexedDB || []).length > 0)

// placeholders like {{env.AUDIT_TOKEN}} are replaced in node, so secrets never have to be stored in the sitemap
export const resolveState = (
    state: StateType | null
): Cypress.Chainable<StateType | null> =>
    hasState(state)
        ? cy.task<StateType | null>('resolveStatePlaceholders', state, {
              log: false,
          })
        : cy.wrap<StateType | null>(null, { log: false })

const logStateError = (message: string) => {
    Cypress.log({ displayName: 'state', message })
}

const fillStorage = (storage: Storage, data: Record<string, unknown> = {}) => {
    Object.entries(data).forEach(([key, value]) => {
        storage.setItem(
            key,
            typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value)
        )
    })
}

// IndexedDB processes requests for the same database in order, so the app only opens it after it has been filled
const fillIndexedDB = (
    win: Cypress.AUTWindow,
    database: IndexedDBStateType
) => {
    const request = win.indexedDB.open(database.database, database.version)
    request.onupgradeneeded = () => {
        database.stores.forEach((store) => {
            const objectStore = request.result.createObjectStore(store.name, {
                keyPath: store.keyPath,
                autoIncrement: store.autoIncrement,
            })
            store.indexes?.forEach((index) =>
                objectStore.createIndex(index.name, index.keyPath, {
                    unique: index.unique,
                    multiEntry: index.multiEntry,
                })
            )
            store.records?.forEach((record) => {
                if (store.keyPath || store.autoIncrement) {
                    objectStore.put(record)
                } else {
                    const { key, value } = record as {
                        key: IDBValidKey
                        value: unknown
                    }
                    objectStore.put(value, key)
                }
            })
        })
    }
    request.onsuccess = () => request.result.close()
    request.onerror = () =>
        logStateError(
            `IndexedDB "${database.database}" could not be filled: ${request.error?.message}`
        )
}

// has to be called in onBeforeLoad, before the scripts of the app run
export const applyStateBeforeLoad = (
    win: Cypress.AUTWindow,
    state: StateType | null,
    useState: boolean
) => {
    if (!state) {
        return
    }

    try {
        state.indexedDB?.forEach((database) => {
            win.indexedDB.deleteDatabase(database.database)
            if (useState) {
                fillIndexedDB(win, database)
            }
        })

        if (useState) {
            fillStorage(win.localStorage, state.localStorage)
            fillStorage(win.sessionStorage, state.sessionStorage)
        }
    } catch (error) {
        logStateError(
            `The state could not be applied: ${(error as Error).message}`
        )
    }
}

// Cypress does not reset IndexedDB, cache storage and service workers between the tests
export const clearStorage = (origin: string) => {
    cy.clearAllCookies({ log: false })
    cy.clearAllLocalStorage({ log: false })
    cy.clearAllSessionStorage({ log: false })
    if (Cypress.browser.family === 'chromium') {
        cy.then(() =>
            Cypress.automation('remote:debugger:protocol', {
                command: 'Storage.clearDataForOrigin',
                params: {
                    origin,
                    storageTypes: 'indexeddb,cache_storage,service_workers',
                },
            })
        )
    }
}

export const setStateCookies = (state: StateType | null, baseUrl: string) => {
    const defaultDomain = new URL(baseUrl).hostname
    state?.cookies?.forEach(({ name, value, ...options }: CookieStateType) => {
        cy.setCookie(name, value, {
            domain: defaultDomain,
            ...options,
            log: false,
        })
    })
}
