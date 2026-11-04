export const formatWCAGTag = (tag: string) => {
    const upperCaseTag = tag.toUpperCase()
    const matchVersion = upperCaseTag.match(/^(WCAG)(\d+)([A]+)$/i)
    const matchSuccessCriterion = upperCaseTag.match(/^(WCAG)(\d+)$/i)

    if (matchVersion) {
        const prefix = matchVersion[1]
        const versionDigits = matchVersion[2]
        const level = matchVersion[3]

        const version =
            versionDigits.length === 1
                ? `${versionDigits}.0`
                : versionDigits.slice(0, -1) + '.' + versionDigits.slice(-1)

        return `${prefix} ${version} ${level}`
    }

    if (matchSuccessCriterion) {
        const successCriterion = matchSuccessCriterion[2]

        let criterion = ''
        for (let i = 0; i < successCriterion.length; i++) {
            criterion += successCriterion.charAt(i)
            if (i < 2 && i < successCriterion.length - 1) {
                criterion += '.'
            }
        }

        return `Success Criterion ${criterion}`
    }

    return tag
}
