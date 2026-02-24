import * as repository from "@/lib/repository/domains/incidents.repository"
import {
  CreateIncidentFileRecordInputSchema,
  CreateIncidentInputSchema,
  ListIncidentsInputSchema,
  UpdateIncidentInputSchema,
} from "@/lib/types/incidents"

export const listIncidents = (
  ...args: Parameters<typeof repository.listIncidents>
): ReturnType<typeof repository.listIncidents> => {
  const [input] = args
  return repository.listIncidents(input ? ListIncidentsInputSchema.parse(input) : undefined)
}
export const listAssetIncidents = (
  ...args: Parameters<typeof repository.listAssetIncidents>
): ReturnType<typeof repository.listAssetIncidents> => repository.listAssetIncidents(...args)
export const createIncident = (
  ...args: Parameters<typeof repository.createIncident>
): ReturnType<typeof repository.createIncident> => {
  const [input] = args
  return repository.createIncident(CreateIncidentInputSchema.parse(input))
}
export const updateIncident = (
  ...args: Parameters<typeof repository.updateIncident>
): ReturnType<typeof repository.updateIncident> => {
  const [id, input] = args
  return repository.updateIncident(id, UpdateIncidentInputSchema.parse(input))
}
export const deleteIncident = (
  ...args: Parameters<typeof repository.deleteIncident>
): ReturnType<typeof repository.deleteIncident> => repository.deleteIncident(...args)
export const listIncidentFiles = (
  ...args: Parameters<typeof repository.listIncidentFiles>
): ReturnType<typeof repository.listIncidentFiles> => repository.listIncidentFiles(...args)
export const createIncidentFileRecord = (
  ...args: Parameters<typeof repository.createIncidentFileRecord>
): ReturnType<typeof repository.createIncidentFileRecord> => {
  const [input] = args
  return repository.createIncidentFileRecord(CreateIncidentFileRecordInputSchema.parse(input))
}
export const getIncidentFileById = (
  ...args: Parameters<typeof repository.getIncidentFileById>
): ReturnType<typeof repository.getIncidentFileById> => repository.getIncidentFileById(...args)
export const deleteIncidentFileRecord = (
  ...args: Parameters<typeof repository.deleteIncidentFileRecord>
): ReturnType<typeof repository.deleteIncidentFileRecord> => repository.deleteIncidentFileRecord(...args)
