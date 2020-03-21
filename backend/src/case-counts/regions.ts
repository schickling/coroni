import { GeoCodeResult } from "./geocode"
import { CaseCounts } from "./cases"

export function identifyRegion(geoInfo: GeoCodeResult) {

  const candidates = geoInfo.address_components.flatMap(x => [x.short_name, x.long_name])

  const [state] = candidates
    .map(cand => ({ name: cand, region: CaseCounts.findState(cand) }))
    .filter(x => x.region !== null)

  if(state) {
    const [region] = candidates
      .map(cand => ({ state: state.name, region: cand, cases: state.region[cand] || null }))
      .filter(x => x.cases !== null)

    if(region) {
      // Return region.
      return region
    } else {
      // Fallback to country level.
      const stateCases = CaseCounts.find("Deutschland", state.name)
      if(stateCases !== null) {
        return { state: 'Deutschland', region: state.name, cases: stateCases }
      }
    }
  }

  // No data. Todo: Fallback to state level.
  return null
}