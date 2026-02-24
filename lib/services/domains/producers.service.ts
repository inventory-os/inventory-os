import * as repository from "@/lib/repository/domains/producers.repository"
import { ProducerInputSchema } from "@/lib/types/producers"

export const listProducers = (
  ...args: Parameters<typeof repository.listProducers>
): ReturnType<typeof repository.listProducers> => repository.listProducers(...args)
export const createProducer = (
  ...args: Parameters<typeof repository.createProducer>
): ReturnType<typeof repository.createProducer> => {
  const [input] = args
  return repository.createProducer(ProducerInputSchema.parse(input))
}
export const updateProducer = (
  ...args: Parameters<typeof repository.updateProducer>
): ReturnType<typeof repository.updateProducer> => {
  const [id, input] = args
  return repository.updateProducer(id, ProducerInputSchema.parse(input))
}
export const deleteProducer = (
  ...args: Parameters<typeof repository.deleteProducer>
): ReturnType<typeof repository.deleteProducer> => repository.deleteProducer(...args)
