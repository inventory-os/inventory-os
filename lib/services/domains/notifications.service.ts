import * as repository from "@/lib/repository/domains/notifications.repository"
import {
  NotifyAssetBorrowedInputSchema,
  NotifyAssetReturnedInputSchema,
  NotifyAssetStatusChangedInputSchema,
  NotifyLowInventoryForAssetInputSchema,
  NotifyMemberRoleChangedInputSchema,
} from "@/lib/types/notifications"

export const listNotificationsForMember = (
  ...args: Parameters<typeof repository.listNotificationsForMember>
): ReturnType<typeof repository.listNotificationsForMember> => repository.listNotificationsForMember(...args)
export const markNotificationRead = (
  ...args: Parameters<typeof repository.markNotificationRead>
): ReturnType<typeof repository.markNotificationRead> => repository.markNotificationRead(...args)
export const markAllNotificationsRead = (
  ...args: Parameters<typeof repository.markAllNotificationsRead>
): ReturnType<typeof repository.markAllNotificationsRead> => repository.markAllNotificationsRead(...args)
export const deleteNotification = (
  ...args: Parameters<typeof repository.deleteNotification>
): ReturnType<typeof repository.deleteNotification> => repository.deleteNotification(...args)
export const deleteAllNotifications = (
  ...args: Parameters<typeof repository.deleteAllNotifications>
): ReturnType<typeof repository.deleteAllNotifications> => repository.deleteAllNotifications(...args)
export const notifyAssetBorrowed = (
  ...args: Parameters<typeof repository.notifyAssetBorrowed>
): ReturnType<typeof repository.notifyAssetBorrowed> => {
  const [input] = args
  return repository.notifyAssetBorrowed(NotifyAssetBorrowedInputSchema.parse(input))
}
export const notifyAssetReturned = (
  ...args: Parameters<typeof repository.notifyAssetReturned>
): ReturnType<typeof repository.notifyAssetReturned> => {
  const [input] = args
  return repository.notifyAssetReturned(NotifyAssetReturnedInputSchema.parse(input))
}
export const notifyAssetStatusChanged = (
  ...args: Parameters<typeof repository.notifyAssetStatusChanged>
): ReturnType<typeof repository.notifyAssetStatusChanged> => {
  const [input] = args
  return repository.notifyAssetStatusChanged(NotifyAssetStatusChangedInputSchema.parse(input))
}
export const notifyLowInventoryForAsset = (
  ...args: Parameters<typeof repository.notifyLowInventoryForAsset>
): ReturnType<typeof repository.notifyLowInventoryForAsset> => {
  const [input] = args
  return repository.notifyLowInventoryForAsset(NotifyLowInventoryForAssetInputSchema.parse(input))
}
export const notifyMemberRoleChanged = (
  ...args: Parameters<typeof repository.notifyMemberRoleChanged>
): ReturnType<typeof repository.notifyMemberRoleChanged> => {
  const [input] = args
  return repository.notifyMemberRoleChanged(NotifyMemberRoleChangedInputSchema.parse(input))
}
export const notifyLdapSyncFailed = (
  ...args: Parameters<typeof repository.notifyLdapSyncFailed>
): ReturnType<typeof repository.notifyLdapSyncFailed> => repository.notifyLdapSyncFailed(...args)
export const notifyAuthIntegrationFailed = (
  ...args: Parameters<typeof repository.notifyAuthIntegrationFailed>
): ReturnType<typeof repository.notifyAuthIntegrationFailed> => repository.notifyAuthIntegrationFailed(...args)
export const notifyQrSettingsChanged = (
  ...args: Parameters<typeof repository.notifyQrSettingsChanged>
): ReturnType<typeof repository.notifyQrSettingsChanged> => repository.notifyQrSettingsChanged(...args)
export const runDueAndOverdueNotifications = (
  ...args: Parameters<typeof repository.runDueAndOverdueNotifications>
): ReturnType<typeof repository.runDueAndOverdueNotifications> => repository.runDueAndOverdueNotifications(...args)
