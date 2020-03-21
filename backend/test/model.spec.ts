import { EventType } from '@prisma/client'
import Model, { InternalEvent } from '../src/model/model'
import moment from 'moment'
import * as Params from '../src/params'
import { CaseCounts } from '../src/case-counts/cases'

function e(
  userId: number,
  type: EventType,
  timestamp: string,
  connectionId: number | null = null,
  state: string | null = null,
  region: string | null = null,
) {
  return {
    userId,
    type,
    timestamp: moment(timestamp),
    connectionId,
    data: JSON.stringify({ state, region }),
  }
}

function evaluate(dailyEvents: InternalEvent[][]) {

  let initial = 0

  for (let i = 1; i <= dailyEvents.length; i++) {
    const events = dailyEvents.slice(0, i).flatMap(x => x)

    const risk = model.calculateInternal(events)

    const vals = Object.values(risk.userRisk)
  //  console.log(vals.join(', '))
    const average = vals.reduce((x, c) => x + c, 0) / vals.length

  //  console.log(events.length, average)
    if(i === 1) {
      initial = average
    }
  //  console.log(average)
  }

  const events = dailyEvents.flatMap(x => x)

  let aa = 0;

  for(let i = 0; i < 20; i++) {
    const risk = model.calculateInternal(events)
    const vals = Object.values(risk.userRisk)
    const average = vals.reduce((x, c) => x + c, 0) / vals.length
    aa += average
  }

  console.log(`Final: ${aa / 20}, Initial: ${initial}, Initial*ExpModel: ${Math.min(initial * Math.pow(Params.alpha, dailyEvents.length), 1)}`)
}

const model = new Model()

 describe('Model "tests".', () => {
    test('Should propagate an infection backwards', () => {

    // From this test, we expect a similar rating through days 1-4 for both clusters. 
    // On day 4, the risk for 1 and 3 should be slightly higher
    // On day 5, the risk of 1 should be 1, and the risk of 0, 2, 3 should be elevated.
    // On day 5, the risk of 4 should stay low.

    const dailyEvents = [
      [
        e(0, EventType.Location, '2020-03-21T03:00:00+01:00', null, 'Deutschland', 'Berlin'),
        e(1, EventType.Location, '2020-03-21T04:00:00+01:00', null, 'Deutschland', 'Berlin'),
        e(2, EventType.Location, '2020-03-21T09:00:00+01:00', null, 'Deutschland', 'Berlin'),
        e(3, EventType.Location, '2020-03-21T09:00:00+01:00', null, 'Deutschland', 'Berlin'),
        e(4, EventType.Location, '2020-03-21T09:00:00+01:00', null, 'Deutschland', 'Berlin'),
      ],
      [
        // First cluster
        e(0, EventType.Interaction, '2020-03-22T22:00:00Z+01:00', 1),
        e(1, EventType.Interaction, '2020-03-22T18:00:00Z+01:00', 2),
      ],
      [
        // Second cluster
        e(3, EventType.Interaction, '2020-03-23T22:00:00Z+01:00', 4),
        e(4, EventType.Interaction, '2020-03-23T18:00:00Z+01:00', 3),
      ],
      [
        // Overlap cluster
        e(3, EventType.Interaction, '2020-03-24T22:00:00Z+01:00', 1),
      ],
      [
        // Oh no, 1 was infected.
        e(1, EventType.DiagnosedSick, '2020-03-04T22:00:00Z+01:00'),
        e(1, EventType.MarkerSick, '2020-03-04T22:00:00Z+01:00'),
      ],
    ]

    evaluate(dailyEvents)
  })

  const simulateClustering = (
    clusterGenFn: (n: number, s: number) => { u1: number, u2: number},
    // Users
    n: number = 100,
    // Interactions / day
    m: number = 500,
    // Days
    d: number = 30,
    // Cluster Size
    s: number = 5) => {
    
    const users: InternalEvent[] = []
    const startDate = '2020-03-21T03:00:00+01:00'

    for(let i = 0; i < n; i++) {
      users.push(e(i, EventType.Location, startDate, null, 'Deutschland', 'Berlin'))
    }

    const days: InternalEvent[][] = []

    for(let i = 0; i < d; i++) {
      const day: InternalEvent[] = []
      for(let j = 0; j < m; j++) {
        const { u1, u2 } = clusterGenFn(n, s)
        day.push(e(u1, EventType.Interaction, moment(startDate).add(i + 1, 'd').format(), u2))
      }
      days.push(day)
    }

    evaluate([users, ...days])
  }

  test('Randomized contacts', () => {
    const clusterFn = (n: number, s: number) => {
      const u1 = Math.floor(Math.random() * n)
      const u2 = Math.floor(Math.random() * n)
      return { u1, u2 }
    }

    simulateClustering(clusterFn)
  })

  test('Restricted Contacts', () => {

    const clusterFn = (n: number, s: number) => {
      const u1 = Math.floor(Math.random() * n) 
      const u2 = (u1 + Math.floor(Math.random() * s)) % n
      return { u1, u2 }
    }

    simulateClustering(clusterFn)
  })

  test('Strictly clustered Contacts', () => {
    const clusterFn = (n: number, s: number) => {
      let cluster = Math.floor(Math.random() * n)
      cluster = cluster - (cluster % s)
      const u1 = cluster + Math.floor(Math.random() * s) 
      const u2 = cluster + Math.floor(Math.random() * s)
      return { u1, u2 }
    }

    simulateClustering(clusterFn)
  })
})
