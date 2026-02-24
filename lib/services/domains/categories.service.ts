import * as repository from "@/lib/repository/domains/categories.repository"
import { CategoryNameSchema } from "@/lib/types/categories"

export const listManagedCategories = (
  ...args: Parameters<typeof repository.listManagedCategories>
): ReturnType<typeof repository.listManagedCategories> => repository.listManagedCategories(...args)
export const createCategory = (
  ...args: Parameters<typeof repository.createCategory>
): ReturnType<typeof repository.createCategory> => {
  const [name] = args
  return repository.createCategory(CategoryNameSchema.parse(name))
}
export const updateCategory = (
  ...args: Parameters<typeof repository.updateCategory>
): ReturnType<typeof repository.updateCategory> => {
  const [id, name] = args
  return repository.updateCategory(id, CategoryNameSchema.parse(name))
}
export const deleteCategory = (
  ...args: Parameters<typeof repository.deleteCategory>
): ReturnType<typeof repository.deleteCategory> => repository.deleteCategory(...args)
export const getCategorySummary = (
  ...args: Parameters<typeof repository.getCategorySummary>
): ReturnType<typeof repository.getCategorySummary> => repository.getCategorySummary(...args)
