import { Event, User, EventType } from '@prisma/client'
import { Moment } from 'moment'
import moment from 'moment'
import _, { Dictionary } from 'lodash'
import { CaseCounts } from '../case-counts/cases'
import * as Params from '../params'

interface InternalEvent {
  type: EventType
  userId: number
  connectionId: number
  data: string,
  timestamp: Moment
}

interface UserDict { [id: number]: number }

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
    })).map(e => ({
      ...e,
      unix: e.timestamp.unix()
    }))

    // Summarize all user IDs
    const userIds = _.uniq(events.flatMap(e => [e.userId, e.connectionId]))

    // Infectivity
    const p: UserDict = userIds.reduce((dict, user) => {
      dict[user] = 0
      return dict
    }, { } as UserDict)

    const grouped = Object.values(_.groupBy(events, 'unix'))

    // These are events grouped by day, ordered
    const ordered = _.orderBy(grouped, g => g[0].unix)

    const combineP = (userId: number, prob: number) => {
      p[userId] = 1 - (1 - p[userId]) * (1 - prob)
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
      const localTravel = day.filter(e => e.type === EventType.Location)
    //  const location = CaseCounts.get
      const localPrediction = CaseCounts.predict(CaseCounts.highRisk(), datePlusN, Params.alpha)
    }
  }
}