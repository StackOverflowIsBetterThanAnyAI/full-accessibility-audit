import { addLeadingSlash, removeTrailingSlash } from './url-helper'

export const normalizePath = (path: string) =>
    removeTrailingSlash(addLeadingSlash(path.trim()))

const convertToRegex = (pattern: string) => {
    const regexStr = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
    return new RegExp(`^${regexStr}$`, 'i')
}

// query parameters and hash routes only matter if the pattern contains them
const matchesPattern = (pattern: string, path: string) => {
    const normalizedPattern = normalizePath(pattern)
    const comparedPath = /[?#]/.test(normalizedPattern)
        ? path
        : removeTrailingSlash(path.split(/[?#]/)[0])
    return convertToRegex(normalizedPattern).test(comparedPath)
}

export const isPathExcluded = (excluded: string[], path: string) =>
    excluded.some((pattern) => matchesPattern(pattern, path))
