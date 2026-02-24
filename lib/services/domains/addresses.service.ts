import * as repository from "@/lib/repository/domains/addresses.repository"
import { AddressInputSchema } from "@/lib/types/addresses"

export const listAddresses = (
  ...args: Parameters<typeof repository.listAddresses>
): ReturnType<typeof repository.listAddresses> => repository.listAddresses(...args)
export const createAddress = (
  ...args: Parameters<typeof repository.createAddress>
): ReturnType<typeof repository.createAddress> => {
  const [input] = args
  return repository.createAddress(AddressInputSchema.parse(input))
}
export const updateAddress = (
  ...args: Parameters<typeof repository.updateAddress>
): ReturnType<typeof repository.updateAddress> => {
  const [id, input] = args
  return repository.updateAddress(id, AddressInputSchema.parse(input))
}
export const deleteAddress = (
  ...args: Parameters<typeof repository.deleteAddress>
): ReturnType<typeof repository.deleteAddress> => repository.deleteAddress(...args)
