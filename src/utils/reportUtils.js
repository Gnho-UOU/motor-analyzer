export function sanitizeFileName(value) {
  const withoutControls = String(value || 'User')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
    .join('')

  return withoutControls
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'User'
}
