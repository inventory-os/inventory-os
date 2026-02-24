import { beforeAll, describe, expect, it } from "vitest"
import { apiJson, ensureBaseData } from "../support/http"

describe("entities.api acceptance", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("persists category and producer CRUD via API", async () => {
    const suffix = Date.now()
    const categoryName = `Acceptance Category ${suffix}`
    const updatedCategoryName = `${categoryName} Updated`
    const producerName = `Acceptance Producer ${suffix}`
    const producerWebsite = `https://acceptance-${suffix}.example.com`
    const updatedProducerWebsite = `https://acceptance-${suffix}-updated.example.com`

    const createCategory = await apiJson<{ category: { id: string; name: string } }>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: categoryName }),
    })
    expect(createCategory.status).toBe(201)
    const categoryId = createCategory.data.category.id

    const patchCategory = await apiJson<{ category: { id: string; name: string } }>(`/api/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: updatedCategoryName }),
    })
    expect(patchCategory.status).toBe(200)
    expect(patchCategory.data.category.name).toBe(updatedCategoryName)

    const listCategories = await apiJson<{ managedCategories: Array<{ id: string; name: string }> }>(
      `/api/categories?page=1&pageSize=50&search=${encodeURIComponent(updatedCategoryName)}`,
    )
    expect(listCategories.status).toBe(200)
    expect(listCategories.data.managedCategories.some((entry) => entry.id === categoryId)).toBe(true)

    const createProducer = await apiJson<{ producer: { id: string; name: string; websiteUrl: string } }>("/api/producers", {
      method: "POST",
      body: JSON.stringify({
        name: producerName,
        websiteUrl: producerWebsite,
        description: "Acceptance producer",
      }),
    })
    expect(createProducer.status).toBe(201)
    const producerId = createProducer.data.producer.id

    const patchProducer = await apiJson<{ producer: { id: string; name: string; websiteUrl: string } }>(`/api/producers/${producerId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: `${producerName} Updated`,
        websiteUrl: updatedProducerWebsite,
        description: "Updated by acceptance",
      }),
    })
    expect(patchProducer.status).toBe(200)
    expect(patchProducer.data.producer.websiteUrl).toContain(`acceptance-${suffix}-updated.example.com`)

    const listProducers = await apiJson<{ producers: Array<{ id: string }> }>("/api/producers")
    expect(listProducers.status).toBe(200)
    expect(listProducers.data.producers.some((entry) => entry.id === producerId)).toBe(true)

    const deleteProducer = await apiJson<{ success: boolean }>(`/api/producers/${producerId}`, { method: "DELETE" })
    expect(deleteProducer.status).toBe(200)

    const afterDeleteProducer = await apiJson<{ producers: Array<{ id: string }> }>("/api/producers")
    expect(afterDeleteProducer.data.producers.some((entry) => entry.id === producerId)).toBe(false)

    const deleteCategory = await apiJson<{ success: boolean }>(`/api/categories/${categoryId}`, { method: "DELETE" })
    expect(deleteCategory.status).toBe(200)

    const afterDeleteCategory = await apiJson<{ managedCategories: Array<{ id: string }> }>(
      `/api/categories?page=1&pageSize=50&search=${encodeURIComponent(updatedCategoryName)}`,
    )
    expect(afterDeleteCategory.data.managedCategories.some((entry) => entry.id === categoryId)).toBe(false)
  })

  it("persists address and location CRUD via API", async () => {
    const suffix = Date.now()
    const addressLabel = `Acceptance Address ${suffix}`
    const locationName = `Acceptance Location ${suffix}`
    const updatedLocationName = `${locationName} Updated`

    const createAddress = await apiJson<{ address: { id: string; label: string } }>("/api/addresses", {
      method: "POST",
      body: JSON.stringify({
        label: addressLabel,
        addressLine1: "Main Street 1",
        postalCode: "1000",
        city: "Test City",
        country: "DE",
      }),
    })
    expect(createAddress.status).toBe(201)
    const addressId = createAddress.data.address.id

    const createLocation = await apiJson<{ location: { id: string; name: string; addressId: string | null } }>("/api/locations", {
      method: "POST",
      body: JSON.stringify({
        name: locationName,
        addressId,
        kind: "building",
      }),
    })
    expect(createLocation.status).toBe(201)
    const locationId = createLocation.data.location.id

    const getLocation = await apiJson<{ location: { id: string; name: string; addressId: string | null } }>(`/api/locations/${locationId}`)
    expect(getLocation.status).toBe(200)
    expect(getLocation.data.location.addressId).toBe(addressId)

    const patchLocation = await apiJson<{ location: { id: string; name: string } }>("/api/locations", {
      method: "PATCH",
      body: JSON.stringify({
        id: locationId,
        name: updatedLocationName,
        addressId,
        kind: "building",
      }),
    })
    expect(patchLocation.status).toBe(200)
    expect(patchLocation.data.location.name).toBe(updatedLocationName)

    const listLocations = await apiJson<{ locations: Array<{ id: string; name: string }> }>("/api/locations")
    expect(listLocations.status).toBe(200)
    expect(listLocations.data.locations.some((entry) => entry.id === locationId && entry.name === updatedLocationName)).toBe(true)

    const deleteLocation = await apiJson<{ success: boolean }>(`/api/locations/${locationId}`, { method: "DELETE" })
    expect(deleteLocation.status).toBe(200)

    const missingLocation = await apiJson<{ error: string }>(`/api/locations/${locationId}`)
    expect(missingLocation.status).toBe(404)

    const deleteAddress = await apiJson<{ success: boolean }>(`/api/addresses/${addressId}`, { method: "DELETE" })
    expect(deleteAddress.status).toBe(200)

    const listAddresses = await apiJson<{ addresses: Array<{ id: string }> }>("/api/addresses")
    expect(listAddresses.status).toBe(200)
    expect(listAddresses.data.addresses.some((entry) => entry.id === addressId)).toBe(false)
  })
})
