export const toLocalTestcaseUrl = (origin: string, url: string) => {
    const { pathname, search } = new URL(url)
    return `${origin}${pathname}${search}`
}
