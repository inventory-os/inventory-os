import baseConfig from "./next.config.mjs"

const config = {
  ...baseConfig,
  distDir: ".next-acceptance",
}

export default config
