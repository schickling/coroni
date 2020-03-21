import { readFileSync } from 'fs'
import moment, { Moment } from 'moment'

export interface Cases { 
  [id: string] : { 
    [id: string]: RegionInfo
  } 
}

export interface RegionInfo{ 
  cases: number,
  casesPerThousand: number
}

const cases: Cases = JSON.parse(readFileSync(__dirname + '/cases-data.json', 'utf-8'))
const casesFrom = moment('2020-03-21T00:00:00Z')

export class CaseCounts {
  public static find(state: string, region: string) {
    const res = cases[state]

    if(!res)
      return null

    return res[region] || null
  }

  public static findState(state: string) {
    return cases[state] || null
  }
  
  // 21.3 Italy
  public static highRisk() {
    return {
      cases: 47021,
      casesPerThousand: 0.77774
    }
  }

  public static predict(base: RegionInfo, when: Moment, alpha: number, dataFrom: Moment = casesFrom) {
    const daysDiff = when.diff(dataFrom, 'days')
    const amp = Math.pow(alpha, daysDiff)

    return {
      cases: base.cases * amp,
      casesPerThousand: Math.min(base.casesPerThousand * amp, 1000)
    }
  }
}