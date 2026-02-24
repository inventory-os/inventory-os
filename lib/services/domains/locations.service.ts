import * as repository from "@/lib/repository/domains/locations.repository"
import { LocationInputSchema } from "@/lib/types/locations"

export const listLocations = (
  ...args: Parameters<typeof repository.listLocations>
): ReturnType<typeof repository.listLocations> => repository.listLocations(...args)
export const getLocationById = (
  ...args: Parameters<typeof repository.getLocationById>
): ReturnType<typeof repository.getLocationById> => repository.getLocationById(...args)
export const createLocation = (
  ...args: Parameters<typeof repository.createLocation>
): ReturnType<typeof repository.createLocation> => {
  const [input] = args
  return repository.createLocation(LocationInputSchema.parse(input))
}
export const updateLocation = (
  ...args: Parameters<typeof repository.updateLocation>
): ReturnType<typeof repository.updateLocation> => {
  const [id, input] = args
  return repository.updateLocation(id, LocationInputSchema.parse(input))
}
export const deleteLocation = (
  ...args: Parameters<typeof repository.deleteLocation>
): ReturnType<typeof repository.deleteLocation> => repository.deleteLocation(...args)
