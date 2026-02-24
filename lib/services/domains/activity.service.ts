import * as repository from "@/lib/repository/domains/activity.repository"
import { ListActivityEventsInputSchema, RecordActivityEventInputSchema } from "@/lib/types/activity"

export const recordActivityEvent = (
  ...args: Parameters<typeof repository.recordActivityEvent>
): ReturnType<typeof repository.recordActivityEvent> => {
  const [input] = args
  return repository.recordActivityEvent(RecordActivityEventInputSchema.parse(input))
}

export const listActivityEvents = (
  ...args: Parameters<typeof repository.listActivityEvents>
): ReturnType<typeof repository.listActivityEvents> => {
  const [input] = args
  return repository.listActivityEvents(ListActivityEventsInputSchema.parse(input))
}
