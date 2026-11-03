import { francAll } from 'franc'
import { Iso6393To1 } from './franc-map'

const MIN_TEXT_LENGTH = 30
const RELIABLE_TEXT_LENGTH = 100
const MAX_DECLARED_LANGUAGE_SCORE = 0.72

export const checkLanguageCompatibility = (
    declared: string,
    detected3: string
): boolean => {
    const baseDeclared = declared.split('-')[0]
    const detected = Iso6393To1[detected3]
    return detected ? detected === baseDeclared : true
}

export const detectMismatchingLanguage = (
    text: string,
    declared: string
): string | null => {
    if (text.length < MIN_TEXT_LENGTH) {
        return null
    }

    const candidates = francAll(text)
    const [detected] = candidates[0]
    if (detected === 'und' || checkLanguageCompatibility(declared, detected)) {
        return null
    }
    if (text.length >= RELIABLE_TEXT_LENGTH) {
        return detected
    }

    const baseDeclared = declared.split('-')[0]
    const declaredScore =
        candidates.find(
            ([language]) => Iso6393To1[language] === baseDeclared
        )?.[1] ?? 0
    return declaredScore < MAX_DECLARED_LANGUAGE_SCORE ? detected : null
}
