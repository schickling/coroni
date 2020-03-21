import GeoCode from '../src/case-counts/geocode'
import { identifyRegion } from '../src/case-counts/regions'

describe('Geocoding and case lookiup', () => {
  test('Happypath', async () => {
    const geocode = new GeoCode()

    // Somehwere in Bayern
    const res = await geocode.lookup(47.732930, 11.047053)

    const region = identifyRegion(res[0])

    expect(region).not.toBeNull()
    if(region !== null) {
      expect(region.state).toBe('Bayern')
      expect(region.region).toBe('Weilheim-Schongau')
      expect(region.cases.cases).toBe(48)
      expect(region.cases.casesPerThousand).toBe(0.355)
    }
  })
})