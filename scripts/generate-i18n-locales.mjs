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

const enText = extractObject("en")
const en = Function(`return (${enText});`)()
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

const languageNames = {
  bg: "Bulgarian",
  cs: "Czech",
  da: "Danish",
  de: "German",
  el: "Greek",
  es: "Spanish",
  et: "Estonian",
  fi: "Finnish",
  fr: "French",
  ga: "Irish",
  hr: "Croatian",
  hu: "Hungarian",
  it: "Italian",
  lt: "Lithuanian",
  lv: "Latvian",
  mt: "Maltese",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  sk: "Slovak",
  sl: "Slovenian",
  sv: "Swedish",
}

function protectPlaceholders(input) {
  const placeholders = []
  const output = input.replace(/\{(\w+)\}/g, (_, token) => {
    const marker = `__PH_${placeholders.length}__`
    placeholders.push(`{${token}}`)
    return marker
  })

  return { output, placeholders }
}

function restorePlaceholders(input, placeholders) {
  return placeholders.reduce(
    (value, placeholder, index) => value.replace(new RegExp(`__PH_${index}__`, "g"), placeholder),
    input,
  )
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
  return payload[0].map((segment) => segment[0])
}

async function translateOne(value, locale, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const translated = await translateBatch([value], locale)
      const first = translated?.[0]
      if (typeof first === "string") {
        return first
      }
    } catch {
      if (attempt === retries) {
        throw new Error(`Unable to translate value for ${locale}`)
      }
    }
  }

  throw new Error(`Unable to translate value for ${locale}`)
}

async function translateForce(text, locale) {
  const { output, placeholders } = protectPlaceholders(text)
  const prompt = `Translate this software UI text to ${languageNames[locale]}. Keep placeholders exactly unchanged. Text: ${output}`
  const translated = await translateOne(prompt, locale)
  let value = translated

  const textIndex = value.lastIndexOf("Text:")
  if (textIndex >= 0) {
    value = value.slice(textIndex + 5).trim()
  }

  return restorePlaceholders(value, placeholders)
}

const allLocales = {}
for (const locale of locales) {
  process.stderr.write(`Generating ${locale}\n`)

  const table = {}
  for (const key of keys) {
    const original = en[key]
    const protectedValue = protectPlaceholders(original)
    const translatedRaw = await translateOne(protectedValue.output, locale)
    let translated = restorePlaceholders(translatedRaw, protectedValue.placeholders)

    if (translated.trim() === original.trim() && original !== "Inventory Os") {
      translated = original
    }

    table[key] = translated
  }

  for (const key of keys) {
    if (table[key].trim() === en[key].trim() && en[key] !== "Inventory Os") {
      table[key] = await translateForce(en[key], locale)
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
