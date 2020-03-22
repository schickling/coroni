import { EventType } from '@prisma/client'
import Model, { InternalEvent } from '../src/model/model'
import moment from 'moment'
import * as Params from '../src/params'
import { CaseCounts } from '../src/case-counts/cases'
import { renderGraph, renderLocalGroup } from '../src/rendering'
import { modelResultToGraphInput } from '../src/modelRender'

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

async function evaluate(dailyEvents: InternalEvent[][], name: string) {

  let initial = 0

  for (let i = 1; i <= dailyEvents.length; i++) {
    const events = dailyEvents.slice(0, i).flatMap(x => x)

    const risk = model.calculateInternal(events)

    const vals = Object.values(risk.userRisk)
   // console.log(vals.join(', '))
    const average = vals.reduce((x, c) => x + c, 0) / vals.length

  //  console.log(events.length, average)
    if(i === 1) {
      initial = average
    }
  //  console.log(average)
  }

  const events = dailyEvents.flatMap(x => x)

  const risk = model.calculateInternal(events)
  const vals = Object.values(risk.userRisk)
  const average = vals.reduce((x, c) => x + c, 0) / vals.length

  const { nodes, edges } = modelResultToGraphInput(risk.userRisk, risk.interactions)

  await renderGraph(nodes, edges, `${name}.png`)
  await renderLocalGroup(nodes, edges, `${nodes[0].id}`, `${name}_local.png`)

  console.log(`${name}: ${average}, Initial: ${initial}, Initial*ExpModel: ${Math.min(initial * Math.pow(Params.alpha, dailyEvents.length), 1)}`)
}

const model = new Model()

 describe('Model "tests".', () => {
    test('Should propagate an infection backwards', async () => {

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

    await evaluate(dailyEvents, 'infection')
  }, 60000)

  const simulateClustering = async (
    clusterGenFn: (n: number, s: number) => { u1: number, u2: number},
    name: string,
    // Users
    n: number = 100,
    // Interactions / day
    m: number = 10,
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

    await evaluate([users, ...days], name)
  }

  test('Randomized contacts', async () => {
    const clusterFn = (n: number, s: number) => {
      const u1 = Math.floor(Math.random() * n)
      const u2 = Math.floor(Math.random() * n)
      return { u1, u2 }
    }

    await simulateClustering(clusterFn, "randomized")
  }, 60000)

  test('Restricted Contacts', async () => {

    const clusterFn = (n: number, s: number) => {
      const u1 = Math.floor(Math.random() * n) 
      const u2 = (u1 + Math.floor(Math.random() * s)) % n
      return { u1, u2 }
    }

    await simulateClustering(clusterFn, "restricted")
  }, 60000)

  test('Strictly clustered Contacts', async () => {
    const clusterFn = (n: number, s: number) => {
      let cluster = Math.floor(Math.random() * n)
      cluster = cluster - (cluster % s)
      const u1 = cluster + Math.floor(Math.random() * s) 
      const u2 = cluster + Math.floor(Math.random() * s)
      return { u1, u2 }
    }

    await simulateClustering(clusterFn, "strictly_restricted")
  }, 60000)
})
