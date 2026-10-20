/** Remembers the last project or manuscript you had open, so its tab can reopen it. */
export type Section = 'projects' | 'manuscripts'
const key = (s: Section) => `tm-last-${s}`

export function rememberOpen(s: Section, id: string) { try { localStorage.setItem(key(s), id) } catch { /* ignore */ } }
export function forgetOpen(s: Section) { try { localStorage.removeItem(key(s)) } catch { /* ignore */ } }
export function lastOpen(s: Section): string | null { try { return localStorage.getItem(key(s)) } catch { return null } }

/** The page you were on before the current one (set by the app shell after each navigation). */
let prev = ''
export const previousPath = () => prev
export const setPreviousPath = (p: string) => { prev = p }
