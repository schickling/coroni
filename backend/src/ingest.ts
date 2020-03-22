import { User, Event, PrismaClient, EventType } from '@prisma/client'
import { Moment } from 'moment'
import moment = require('moment')
import * as Params from './params'

export class EventIngest {
  private client: PrismaClient
  private user: User

  constructor(user: User) {
    this.client = new PrismaClient()
    this.user = user
  }

  highRiskEvent(timestamp: Moment = moment()) {
    this.client.event.create({
      data: {
        eventType: EventType.HighRiskArea,
        timestamp: timestamp.format(),
        user: {
          connect: { id: this.user.id }
        },
        data: '',
        interaction: null
      }
    })
  }
  
  sympthomsEvent(timestamp: Moment = moment()) {
    this.client.event.create({
      data: {
        eventType: EventType.Sympthoms,
        timestamp: timestamp.format(),
        user: {
          connect: { id: this.user.id }
        },
        data: '',
        interaction: null
      }
    })
  }



  diagnosedPositiveEvent(timestamp: Moment = moment()) {
    this.client.event.create({
      data: {
        eventType: EventType.DiagnosedSick,
        timestamp: timestamp.format(),
        user: {
          connect: { id: this.user.id }
        },
        data: '',
        interaction: null
      }
    })

    const infectedSince = timestamp.clone().subtract(Params.incubationPeriod, 'days')

    this.client.event.create({
      data: {
        eventType: EventType.MarkerSick,
        timestamp: infectedSince.format(),
        user: {
          connect: { id: this.user.id }
        },
        data: '',
        interaction: null
      }
    })
  }

  /**
   * Location state/region needs to be equal to the stuff returned from the geocoder.
   */
  locationEvent(state: string, region: string, timestamp: Moment = moment()) {
    this.client.event.create({
      data: {
        eventType: EventType.Location,
        timestamp: timestamp.format(),
        user: {
          connect: { id: this.user.id }
        },
        // Best encoding!
        data: JSON.stringify({ state, region }),
        interaction: null
      }
    })
  }

  interactionEvent(otherUser: User, timestamp: Moment = moment()) {
    this.client.event.create({
      data: {
        eventType: EventType.Interaction,
        timestamp: timestamp.format(),
        user: {
          connect: { id: this.user.id }
        },
        // Best encoding!
        data: '',
        interaction: {
          connect: { id: otherUser.id }
        }
      }
    })
  }
}