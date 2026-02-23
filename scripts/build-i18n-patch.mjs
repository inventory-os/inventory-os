import fs from "node:fs"
import path from "node:path"

const workspace = process.cwd()
const filePath = path.join(workspace, "lib/i18n.ts")
const source = fs.readFileSync(filePath, "utf8")

const targetLocales = ["ga", "hr", "hu", "lt", "lv", "mt", "nl", "pl", "ro", "sk", "sl", "sv"]

function extractObjectAfterMarker(src, marker) {
  const start = src.indexOf(marker)
  if (start === -1) {
    throw new Error(`Marker not found: ${marker}`)
  }

  const objectStart = src.indexOf("{", start + marker.length)
  if (objectStart === -1) {
    throw new Error(`Object start not found for marker: ${marker}`)
  }

  let depth = 0
  let inString = false
  let quote = ""
  let escaped = false

  for (let i = objectStart; i < src.length; i += 1) {
    const ch = src[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === "\\") {
        escaped = true
        continue
      }
      if (ch === quote) {
        inString = false
        quote = ""
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }

    if (ch === "{") {
      depth += 1
    } else if (ch === "}") {
      depth -= 1
      if (depth === 0) {
        return {
          text: src.slice(objectStart, i + 1),
          start: objectStart,
          end: i + 1,
        }
      }
    }
  }

  throw new Error(`Unterminated object for marker: ${marker}`)
}

function findLocaleBlock(src, locale) {
  const marker = `  ${locale}: {`
  const start = src.indexOf(marker)
  if (start === -1) {
    throw new Error(`Locale block start not found for ${locale}`)
  }

  const braceStart = src.indexOf("{", start)
  let depth = 0
  let inString = false
  let quote = ""
  let escaped = false

  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === "\\") {
        escaped = true
        continue
      }
      if (ch === quote) {
        inString = false
        quote = ""
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }

    if (ch === "{") {
      depth += 1
    } else if (ch === "}") {
      depth -= 1
      if (depth === 0) {
        let end = i + 1
        while (end < src.length && /[ \t]/.test(src[end])) {
          end += 1
        }
        if (src[end] === ",") {
          end += 1
        }
        if (src[end] === "\r") {
          end += 1
        }
        if (src[end] === "\n") {
          end += 1
        }

        return {
          text: src.slice(start, end),
          start,
          end,
        }
      }
    }
  }

  throw new Error(`Locale block end not found for ${locale}`)
}

function protectTokens(input) {
  const tokens = []
  let output = input

  const capture = (regex) => {
    output = output.replace(regex, (match) => {
      const marker = `__TK_${tokens.length}__`
      tokens.push(match)
      return marker
    })
  }

  capture(/\{(?:name|current|total|label|path|value|count|percent)\}/g)
  capture(/https?:\/\/\S+/g)
  capture(/ldaps?:\/\/\S+/g)
  capture(/\b(?:cn|ou|dc)=[^,\s]+(?:,[^,\s]+)*/gi)
  capture(/\b(?:LDAP|OIDC|QR|SKU|ISO|ID|N\/A|Inventory Os|APP_DOMAIN|APP_QR_PATH_TEMPLATE)\b/g)

  return { output, tokens }
}

function restoreTokens(input, tokens) {
  let value = input
  for (let i = 0; i < tokens.length; i += 1) {
    value = value.replace(new RegExp(`__TK_${i}__`, "g"), tokens[i])
  }
  return value
}

async function translateOne(value, locale) {
  const params = new URLSearchParams()
  params.append("client", "gtx")
  params.append("sl", "en")
  params.append("tl", locale)
  params.append("dt", "t")
  params.append("q", value)

  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  })

  if (!response.ok) {
    throw new Error(`Translation request failed for ${locale}: HTTP ${response.status}`)
  }

  const payload = await response.json()
  if (!Array.isArray(payload?.[0])) {
    throw new Error(`Unexpected translation payload for ${locale}`)
  }

  if (!Array.isArray(payload[0])) {
    throw new Error(`Unexpected translation structure for ${locale}`)
  }

  return payload[0].map((segment) => segment[0]).join("")
}

async function translateValues(values, locale) {
  const translated = []

  for (const value of values) {
    let succeeded = false
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const result = await translateOne(value, locale)
        translated.push(result)
        succeeded = true
        break
      } catch {
        if (attempt === 3) {
          translated.push(value)
          succeeded = true
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
      }
    }

    if (!succeeded) {
      translated.push(value)
    }
  }

  return translated
}

function buildLocaleBlock(locale, keys, table) {
  const lines = []
  lines.push(`  ${locale}: {`)
  for (const key of keys) {
    lines.push(`    ${key}: ${JSON.stringify(table[key])},`)
  }
  lines.push("  },")
  return `${lines.join("\n")}\n`
}

function toPatchSnippet(oldText, newText) {
  const oldLines = oldText.endsWith("\n") ? oldText.slice(0, -1).split("\n") : oldText.split("\n")
  const newLines = newText.endsWith("\n") ? newText.slice(0, -1).split("\n") : newText.split("\n")

  const removed = oldLines.map((line) => `-${line}`).join("\n")
  const added = newLines.map((line) => `+${line}`).join("\n")
  return `${removed}\n${added}`
}

const en = Function(`return (${extractObjectAfterMarker(source, "const en: TranslationTable = ").text});`)()
const keys = Object.keys(en)

const generatedTables = {}
for (const locale of targetLocales) {
  process.stderr.write(`Translating ${locale}\n`)
  const protectedValues = keys.map((key) => protectTokens(en[key]))
  const translatedRaw = await translateValues(
    protectedValues.map((entry) => entry.output),
    locale,
  )

  const table = {}
  keys.forEach((key, index) => {
    const restored = restoreTokens(translatedRaw[index] ?? en[key], protectedValues[index].tokens)
    table[key] = restored
  })
  table.appName = "Inventory Os"
  generatedTables[locale] = table
}

const snippets = []
for (const locale of targetLocales) {
  const oldBlock = findLocaleBlock(source, locale).text
  const newBlock = buildLocaleBlock(locale, keys, generatedTables[locale])
  snippets.push(toPatchSnippet(oldBlock, newBlock))
}

const patch = [
  "*** Begin Patch",
  "*** Update File: /Users/henryschwerdtner/dev/inventory-os/lib/i18n.ts",
  ...snippets,
  "*** End Patch",
].join("\n")

const patchPath = path.join(workspace, "scripts", "i18n-target-locales.patch.txt")
fs.writeFileSync(patchPath, patch, "utf8")
console.log(`Wrote patch to ${patchPath}`)
