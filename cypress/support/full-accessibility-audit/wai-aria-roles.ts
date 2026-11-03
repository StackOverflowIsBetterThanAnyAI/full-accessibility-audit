export const GLOBAL_ARIA_ATTRIBUTES = [
    'aria-atomic',
    'aria-busy',
    'aria-controls',
    'aria-current',
    'aria-describedby',
    'aria-details',
    'aria-disabled',
    'aria-dropeffect',
    'aria-errormessage',
    'aria-flowto',
    'aria-grabbed',
    'aria-haspopup',
    'aria-hidden',
    'aria-invalid',
    'aria-keyshortcuts',
    'aria-label',
    'aria-labelledby',
    'aria-live',
    'aria-owns',
    'aria-relevant',
    'aria-roledescription',
]

const NAMING_PROHIBITED_ROLES = [
    'caption',
    'code',
    'deletion',
    'emphasis',
    'generic',
    'insertion',
    'paragraph',
    'presentation',
    'strong',
    'subscript',
    'superscript',
]

const ROLE_DESCRIPTION_PROHIBITED_ROLES = ['generic', 'presentation']

export const PROHIBITED_ARIA_ATTRIBUTES: Record<string, string[]> = {
    'aria-label': NAMING_PROHIBITED_ROLES,
    'aria-labelledby': NAMING_PROHIBITED_ROLES,
    'aria-braillelabel': NAMING_PROHIBITED_ROLES,
    'aria-roledescription': ROLE_DESCRIPTION_PROHIBITED_ROLES,
    'aria-brailleroledescription': ROLE_DESCRIPTION_PROHIBITED_ROLES,
}
