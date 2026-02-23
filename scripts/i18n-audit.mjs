import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist', 'build'].includes(entry.name)) continue
      out.push(...walk(full))
    } else if (full.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components'))]
const i18n = fs.readFileSync(path.join(root, 'lib/i18n.ts'), 'utf8')
const enMatch =
  i18n.match(/const en: TranslationTable = \{([\s\S]*?)\n\}\n\nconst localeOverrides/) ??
  i18n.match(/const en: TranslationTable = \{([\s\S]*?)\n\}\n\nconst commonTranslations/)
const enBlock = enMatch?.[1] ?? ''
const enKeys = new Set([...enBlock.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*"/gm)].map((m) => m[1]))

const tKeys = new Set()
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  for (const m of source.matchAll(/\bt\(\s*['"`]([^'"`]+)['"`]/g)) {
    tKeys.add(m[1])
  }
}

const missing = [...tKeys].filter((k) => !enKeys.has(k)).sort()
console.log(`MISSING_T_KEYS ${missing.length}`)
if (missing.length) {
  for (const key of missing) console.log(key)
}

const likelyPlain = []
const ignoreLiteral = /^(true|false|null|undefined|none|all|asc|desc|available|in-use|maintenance|retired|active|upcoming|completed|new|good|fair|damaged|image|document|building|floor|room|storage|area|admin|manager|member)$/i

for (const file of files) {
  const rel = path.relative(root, file)
  const source = fs.readFileSync(file, 'utf8')

  for (const m of source.matchAll(/>\s*([A-Za-z][^<{]{1,80}?)\s*</g)) {
    const value = m[1].trim()
    if (!value || ignoreLiteral.test(value)) continue
    if (value.includes('{') || value.includes('}')) continue
    likelyPlain.push(`${rel}:JSX:${value}`)
  }

  for (const m of source.matchAll(/(aria-label|placeholder|title|alt)=['"]([A-Za-z][^'"\n]{1,80})['"]/g)) {
    const value = m[2].trim()
    if (!value || ignoreLiteral.test(value)) continue
    likelyPlain.push(`${rel}:ATTR:${m[1]}=${value}`)
  }
}

const uniqueLikelyPlain = [...new Set(likelyPlain)].sort()
console.log(`LIKELY_PLAIN ${uniqueLikelyPlain.length}`)
for (const line of uniqueLikelyPlain) {
  console.log(line)
}
