import { ContextMessageUpdate } from 'telegraf'
import { PromiseOrConst } from './utils'

type SessionData = {
  [userId: number]: {
    sessionId: Date
    store: {
      [storageKey: string]: boolean
    }
  }
}

export class Session {
  private data: SessionData

  constructor() {
    this.data = {}
  }

  async runOnce(
    userId: number,
    actionPrefix: string,
    originalSessionId: Date | undefined,
    ctx: ContextMessageUpdate | undefined,
    fn: () => PromiseOrConst<any>,
  ) {
    if (originalSessionId && this.sessionId(userId) !== originalSessionId) {
      console.log('session expired for', {
        userId,
        originalSessionId,
        sessionId: this.sessionId(userId),
      })
      return
    }
    if (this.lazyGet(userId, actionPrefix)) {
      // TODO adjust this logic for one-time uses (e.g. location/contact sharing) to avoid logging
      console.log(
        `User ${userId} already asked question for hash "${actionPrefix}"`,
      )
      await ctx?.answerCbQuery('Already answered before.')
      return
    }
    this.lazySet(userId, actionPrefix)
    await fn()
  }

  wipe(userId: number, sessionId: Date) {
    this.data[userId] = {
      sessionId: sessionId,
      store: {},
    }
  }

  sessionId(userId: number) {
    return this.data[userId].sessionId
  }

  private lazyGet(userId: number, actionPrefix: string): boolean {
    this.lazyInit(userId, actionPrefix)
    return this.data[userId].store[actionPrefix]
  }

  private lazySet(userId: number, actionPrefix: string) {
    this.lazyInit(userId, actionPrefix)
    this.data[userId].store[actionPrefix] = true
  }

  private lazyInit(userId: number, actionPrefix: string) {
    // if (this.data[userId] === undefined) {
    //   this.data[userId] = {
    //     sessionId: Math.random(),
    //     store: {},
    //   }
    // }

    if (this.data[userId].store[actionPrefix] === undefined) {
      this.data[userId].store[actionPrefix] = false
    }
  }
}
