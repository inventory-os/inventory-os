import { setupAcceptanceEnvironment, teardownAcceptanceEnvironment } from "./support/acceptance-env"

export default async function globalSetup() {
  await setupAcceptanceEnvironment()

  return async () => {
    await teardownAcceptanceEnvironment()
  }
}
