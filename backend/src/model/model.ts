import { Event, User, EventType } from '@prisma/client'
import { Moment } from 'moment'
import moment from 'moment'
import _ from 'lodash'
import { CaseCounts } from '../case-counts/cases'
import * as Params from '../params'

export interface InternalEvent {
  type: EventType
  userId: number
  connectionId: number | null
  data: string | null,
  timestamp: Moment
}

export interface UserDict { [id: number]: number }
export interface Interactions { [id: number]: {
    [id: number]: number
  }
}

export default class Model {
  constructor() {

  }

  public calculate(allEvents: (Event & { connection: User, user: User })[]) {
    const events = allEvents.map(e => ({
      type: e.eventType,
      userId: e.user.id,
      connectionId: e.connection.id,
      data: e.data,
      // Align timestamps on 24 hour intervals.
      // Depends on our update interval.
      timestamp: moment(e.timestamp).hour(0).minute(0).second(0).millisecond(0)
    }))
    
    return this.calculateInternal(events)
  }
  
  public calculateInternal(allEvents: InternalEvent[]) {
    const events = allEvents.map(e => ({
      ...e,
      unix: e.timestamp.unix()
    }))

    // Summarize all user IDs
    const userIds = _.uniq(events.flatMap(e => e.connectionId !== null ? [e.userId, e.connectionId] : [e.userId]))

    // Infectivity
    const p: UserDict = userIds.reduce((dict, user) => {
      dict[user] = 0
      return dict
    }, { } as UserDict)
    const interactionAgg: Interactions = { }

    const grouped = Object.values(_.groupBy(events, 'unix'))

    // These are events grouped by day, ordered
    const ordered = _.orderBy(grouped, g => g[0].unix)

    const combine = (p1: number, p2: number) => {
      return 1 - (1 - p1) * (1 - p2)
    }

    const combineP = (userId: number, prob: number) => {
      p[userId] = combine(p[userId], prob)
    }

    const setP = (userId: number, prob: number) => {
      p[userId] = prob
    }

    for(const day of ordered) {
      const date = day[0].timestamp
      const datePlusN= day[0].timestamp.clone().add(Params.incubationPeriod, 'days')

      // Apply certain infections
      const infections = day.filter(e => e.type === EventType.MarkerSick)

      for(const infection of infections) {
        // Assume p = 1
        setP(infection.userId, 1)
      }

      // Apply high risk travel/comeback
      const highRisks = day.filter(e => e.type === EventType.HighRiskArea)
      const highRiskPrediction = CaseCounts.predict(CaseCounts.highRisk(), datePlusN, Params.alpha)
      const highRiskP = highRiskPrediction.casesPerThousand / 1000

      for(const highRisk of highRisks) {
        combineP(highRisk.userId, highRiskP)
      }

      // Apply local risk
      const locals = day.filter(e => e.type === EventType.Location && e.data !== null)

      for(const local of locals) {
        const location = JSON.parse(local.data as string)
        const localCases = CaseCounts.find(location.state, location.region)

        if(localCases === null) {
          continue
        }

        const localPrediction = CaseCounts.predict(localCases, datePlusN, Params.alpha)
        const localRiskP = highRiskPrediction.casesPerThousand / 1000
        combineP(local.userId, localRiskP)
      }

      // Finally, apply interactions, randomized.
      const interactions = _.shuffle(_.uniq(day.filter(e => e.type === EventType.Interaction && e.connectionId !== null).map(e => ({ u1: e.userId, u2: e.connectionId }))))
      
      for(const interaction of interactions) {

        if(interaction.u2 === null || interaction.u1 == interaction.u2) {
          continue
        }

        // TODO: Interactions should not be forever
        if(interactionAgg[interaction.u1] === undefined) {
          interactionAgg[interaction.u1] = { } 
        }
        if(interactionAgg[interaction.u1][interaction.u2] === undefined) {
          interactionAgg[interaction.u1][interaction.u2] = 1
        } else {
          interactionAgg[interaction.u1][interaction.u2] = interactionAgg[interaction.u1][interaction.u2] + 1
        }

        const p1 = p[interaction.u1] * Params.gamma
        const p2 = p[interaction.u2] * Params.gamma

        const max = Math.max(p1, p2)

        p[interaction.u1] = combine(p[interaction.u1], max)
        p[interaction.u2] = combine(p[interaction.u2], max)
      }
    }

    return { userRisk: p, interactions: interactionAgg }
  }
}