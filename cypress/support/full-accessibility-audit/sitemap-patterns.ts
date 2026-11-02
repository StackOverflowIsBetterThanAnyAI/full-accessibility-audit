import { SitemapConfigType } from './types'
import { addLeadingSlash, removeTrailingSlash } from './url-helper'

const convertToRegex = (pattern: string) => {
    let regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    regexStr = regexStr.replace(/\*/g, '.*')
    return new RegExp(`^${regexStr}$`, 'i')
}

export const cleanUpExistingPattern = (pattern: string) => {
    return (
        removeTrailingSlash(
            addLeadingSlash(pattern.replace(/^\*|\*$/g, '').trim())
        ) || '/'
    )
}

export const isPathAllowedForAudit = (
    sitemapConfig: SitemapConfigType,
    path: string
): boolean => {
    const { excluded } = sitemapConfig
    const normalized = removeTrailingSlash(path.trim())

    return !excluded.some((pattern) =>
        convertToRegex(cleanUpExistingPattern(pattern)).test(normalized)
    )
}
