import { describe, expect, it } from 'vitest'
import { createMockApi } from './mock'

describe('MockApi visits (足迹)', () => {
  it('getVisits starts empty and addVisit records a visit', async () => {
    const api = createMockApi()
    expect(await api.getVisits()).toEqual([])
    const v = await api.addVisit({ destination_id: 11, attraction_name: '櫛田神社' })
    expect(v.attraction_name).toBe('櫛田神社')
    expect(v.id).toBeGreaterThan(0)
    const list = await api.getVisits()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ destination_id: 11, attraction_name: '櫛田神社' })
  })

  it('deleteVisit removes a visit', async () => {
    const api = createMockApi()
    const v = await api.addVisit({ attraction_name: '大濠公園' })
    await api.deleteVisit(v.id)
    expect(await api.getVisits()).toEqual([])
  })

  it('completeTrip records each stop once and completes the trip', async () => {
    const api = createMockApi()
    const trips = await api.getTrips()
    const first = trips[0]!
    const trip = await api.completeTrip(first.id!, ['櫛田神社', '大濠公園'])
    expect(trip.status).toBe('completed')
    expect(trip.destination_id).toBe(first.destination_id)
    const names = (await api.getVisits()).map((v) => v.attraction_name)
    expect(names).toEqual(['櫛田神社', '大濠公園'])
    await api.completeTrip(first.id!, ['櫛田神社'])
    expect(await api.getVisits()).toHaveLength(2)
  })

  it('completeTrip rejects an unknown trip', async () => {
    const api = createMockApi()
    await expect(api.completeTrip(999, ['天神'])).rejects.toThrow('Trip not found')
  })
})