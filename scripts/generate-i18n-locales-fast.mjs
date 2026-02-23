import fs from "node:fs"
import path from "node:path"

const workspace = process.cwd()
const filePath = path.join(workspace, "lib/i18n.ts")
const source = fs.readFileSync(filePath, "utf8")

function extractObject(name) {
  const marker = `const ${name}: TranslationTable = `
  const start = source.indexOf(marker)
  if (start === -1) {
    throw new Error(`Unable to find ${name}`)
  }

  const objectStart = source.indexOf("{", start + marker.length)
  let depth = 0
  let inString = false
  let escaped = false
  let quote = ""

  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (char === quote) {
        inString = false
        quote = ""
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      quote = char
      continue
    }

    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return source.slice(objectStart, index + 1)
      }
    }
  }

  throw new Error(`Unterminated object for ${name}`)
}

function extractLocaleOverridesObjectText() {
  const marker = "const localeOverrides: Partial<Record<EuropeanLocale, TranslationTable>> = "
  const start = source.indexOf(marker)
  if (start === -1) {
    throw new Error("Unable to find localeOverrides")
  }

  const objectStart = source.indexOf("{", start + marker.length)
  let depth = 0
  let inString = false
  let escaped = false
  let quote = ""

  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (char === quote) {
        inString = false
        quote = ""
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      quote = char
      continue
    }

    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return source.slice(objectStart, index + 1)
      }
    }
  }

  throw new Error("Unterminated localeOverrides object")
}

const en = Function(`return (${extractObject("en")});`)()
const existingOverrides = Function(`return (${extractLocaleOverridesObjectText()});`)()
const keys = Object.keys(en)

const locales = [
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "es",
  "et",
  "fi",
  "fr",
  "ga",
  "hr",
  "hu",
  "it",
  "lt",
  "lv",
  "mt",
  "nl",
  "pl",
  "pt",
  "ro",
  "sk",
  "sl",
  "sv",
]

function protectTokens(input) {
  const protectedParts = []
  let output = input

  output = output.replace(/\{(name|current|total|label|path|value|count|percent)\}/g, (match) => {
    const marker = `__TK_${protectedParts.length}__`
    protectedParts.push(match)
    return marker
  })

  output = output.replace(/https?:\/\/\S+/g, (match) => {
    const marker = `__TK_${protectedParts.length}__`
    protectedParts.push(match)
    return marker
  })

  output = output.replace(/ldaps?:\/\/\S+/g, (match) => {
    const marker = `__TK_${protectedParts.length}__`
    protectedParts.push(match)
    return marker
  })

  output = output.replace(/\b(?:cn|ou|dc)=[^,\s]+(?:,[^\s]+)*/gi, (match) => {
    const marker = `__TK_${protectedParts.length}__`
    protectedParts.push(match)
    return marker
  })

  output = output.replace(/\b(?:Inventory Os|LDAP|OIDC|QR|SKU|ISO|ID|N\/A)\b/g, (match) => {
    const marker = `__TK_${protectedParts.length}__`
    protectedParts.push(match)
    return marker
  })

  return { output, protectedParts }
}

function restoreTokens(input, protectedParts) {
  return protectedParts.reduce(
    (value, part, index) => value.replace(new RegExp(`__TK_${index}__`, "g"), part),
    input,
  )
}

function chunk(values, size) {
  const output = []
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size))
  }
  return output
}

async function translateBatch(values, locale) {
  const params = new URLSearchParams()
  params.append("client", "gtx")
  params.append("sl", "en")
  params.append("tl", locale)
  params.append("dt", "t")
  values.forEach((value) => params.append("q", value))

  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  })

  if (!response.ok) {
    throw new Error(`Translation request failed for ${locale} with HTTP ${response.status}`)
  }

  const payload = await response.json()
  if (!Array.isArray(payload?.[0])) {
    throw new Error(`Unexpected translation payload for ${locale}`)
  }

  return payload[0].map((segment) => segment[0])
}

async function translateValues(values, locale) {
  const batches = chunk(values, 20)
  const translated = []

  for (const batch of batches) {
    let attempt = 0
    while (attempt < 3) {
      try {
        const result = await translateBatch(batch, locale)
        translated.push(...result)
        break
      } catch {
        attempt += 1
        if (attempt >= 3) {
          translated.push(...batch)
          break
        }

        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
      }
    }
  }

  return translated
}

const allLocales = {}
for (const locale of locales) {
  process.stderr.write(`Generating ${locale}\n`)

  const existing = existingOverrides[locale] ?? {}
  const table = {}

  const missingKeys = keys.filter((key) => !(key in existing))
  const protectedValues = missingKeys.map((key) => protectTokens(en[key]))
  const translatedRaw = await translateValues(
    protectedValues.map((entry) => entry.output),
    locale,
  )

  missingKeys.forEach((key, index) => {
    table[key] = restoreTokens(translatedRaw[index] ?? en[key], protectedValues[index].protectedParts)
  })

  for (const key of keys) {
    if (key in existing) {
      table[key] = existing[key]
    }
  }

  table.appName = "Inventory Os"
  allLocales[locale] = table
}

const outputLines = ["const localeOverrides: Partial<Record<EuropeanLocale, TranslationTable>> = {"]
for (const locale of locales) {
  outputLines.push(`  ${locale}: {`)
  for (const key of keys) {
    outputLines.push(`    ${key}: ${JSON.stringify(allLocales[locale][key])},`)
  }
  outputLines.push("  },")
}
outputLines.push("}")

const outputPath = path.join(workspace, "scripts/generated-locale-overrides.txt")
fs.writeFileSync(outputPath, `${outputLines.join("\n")}\n`, "utf8")
console.log(`Wrote ${outputPath}`)
