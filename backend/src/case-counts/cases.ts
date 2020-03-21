import { readFileSync } from 'fs'

export interface Cases { 
  [id: string] : { 
    [id: string]: { 
      cases: number,
      casesPerThousand: number
    }
  } 
}

const cases: Cases = JSON.parse(readFileSync(__dirname + '/cases-data.json', 'utf-8'))

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
}