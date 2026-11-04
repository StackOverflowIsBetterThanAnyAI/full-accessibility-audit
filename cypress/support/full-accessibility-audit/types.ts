type ImpactType = 'serious' | 'critical' | 'moderate'
type TagType =
    | 'wcag2a'
    | 'wcag2aa'
    | 'wcag21a'
    | 'wcag21aa'
    | 'wcag22aa'
    | 'wcag2aaa'
    | 'best-practice'
    | `wcag${number}`

export type CustomViolationType = {
    description: string
    failureSummary: string[]
    help: string
    helpUrl: string
    html: string
    id: string
    impact: ImpactType
    tags: TagType[]
}

export type CustomViolationReturnType = {
    id: string
    impact: ImpactType
    description: string
    help: string
    helpUrl: string
    nodes: ViolationNodeType[]
    tags: TagType[]
}

export type CustomAuditCallback = (
    violations: CustomViolationReturnType[]
) => void

export type ErrorListType = {
    id: string
    path?: string
    isHint?: boolean
    message: string
    viewports: ViewportType[]
    uniqueKey: string
    rawDetails?: {
        tagString: string
        impact: string
        help: string
        html: string
        exactDomLocation: string
        failureSummary: string
        helpUrl: string
    }
}

export type W3CActTestCaseType = {
    ruleId: string
    ruleName: string
    ruleAccessibilityRequirements: {
        [key: string]: {
            title: string
            forConformance: boolean
            failed: string
            passed: string
            inapplicable: string
        }
    }
    expected: string
    testcaseId: string
    testcaseTitle: string
    relativePath: string
    url: string
    rulePage: string
    approved: boolean
}

export type ViolationNodeType = {
    failureSummary: string
    html: string
    impact: ImpactType
    target: []
    element: HTMLElement
}

export type ViewportType = 'Mobile' | 'Desktop'

export type SitemapConfigType = {
    only: string[]
    included: string[]
    excluded: string[]
    queryParams?: string[]
    maxPages?: number
}

export type CookieStateType = { name: string; value: string } & Partial<
    Pick<
        Cypress.SetCookieOptions,
        'domain' | 'path' | 'secure' | 'httpOnly' | 'expiry' | 'sameSite'
    >
>

export type IndexedDBStateType = {
    database: string
    version?: number
    stores: {
        name: string
        keyPath?: string | string[]
        autoIncrement?: boolean
        indexes?: {
            name: string
            keyPath: string | string[]
            unique?: boolean
            multiEntry?: boolean
        }[]
        records?: unknown[]
    }[]
}

export type StateType = {
    localStorage?: Record<string, unknown>
    sessionStorage?: Record<string, unknown>
    cookies?: CookieStateType[]
    indexedDB?: IndexedDBStateType[]
}

export type PageType = {
    key: string
    path: string
}
