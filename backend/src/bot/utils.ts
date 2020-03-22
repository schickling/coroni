import Telegraf, { ContextMessageUpdate, Extra, Markup } from 'telegraf'
import { Location, Message, Contact } from 'telegraf/typings/telegram-types'
import { createHash } from 'crypto'

type PromiseOrConst<T> = Promise<T> | T
export type ContextCallback = (ctx: ContextMessageUpdate) => PromiseOrConst<any>
export type Callback<T> = (arg: T) => PromiseOrConst<ContextCallback>

type SessionData = {
  [userId: number]: {
    [storageKey: string]: boolean
  }
}

export class Session {
  private data: SessionData

  constructor() {
    this.data = {}
  }

  lazyGet(userId: number, actionPrefix: string): boolean {
    this.lazyInit(userId, actionPrefix)
    return this.data[userId][actionPrefix]
  }

  lazySet(userId: number, actionPrefix: string) {
    this.lazyInit(userId, actionPrefix)
    this.data[userId][actionPrefix] = true
  }

  wipe(userId: number) {
    this.data[userId] = {}
  }

  private lazyInit(userId: number, actionPrefix: string) {
    if (this.data[userId] === undefined) {
      this.data[userId] = {}
    }

    if (this.data[userId][actionPrefix] === undefined) {
      this.data[userId][actionPrefix] = false
    }
  }
}

export type AppContext = {
  bot: Telegraf<ContextMessageUpdate>
  session: Session
}

type Answer = {
  text: string
  callback: Callback<void>
}

export function wipeUserSession(
  ctx: ContextMessageUpdate,
  appContext: AppContext,
) {
  const userId = ctx.from!.id
  appContext.session.wipe(userId)
}

export function selectHandler(
  question: string,
  answers: Answer[][],
  appContext: AppContext,
): ContextCallback {
  return ctx => {
    const userId = ctx.from!.id
    const actionPrefix = hash(question)
    const actionKey = (row: number, col: number) =>
      `${actionPrefix}-${userId}-${row}-${col}`

    const renderMarkup = (activeButton?: [number, number]) =>
      Markup.inlineKeyboard(
        answers.map((list, row) =>
          list.map((a, col) => {
            const prefix =
              activeButton && activeButton[0] === row && activeButton[1] === col
                ? '✅ '
                : ''
            return Markup.callbackButton(prefix + a.text, actionKey(row, col))
          }),
        ),
      ).extra()

    for (const row of answers.keys()) {
      for (const col of answers[row].keys())
        appContext.bot.action(actionKey(row, col), async actionCtx => {
          if (appContext.session.lazyGet(userId, actionPrefix)) {
            console.log(`Already asked question "${question}"`)
            return
          }
          appContext.session.lazySet(userId, actionPrefix)
          await actionCtx.editMessageText(question, renderMarkup([row, col]))
          const fn = await answers[row][col].callback()
          await fn(actionCtx)
        })
    }
    return ctx.reply(question, renderMarkup())
  }
}

export function contactHandler(
  question: string,
  callback: Callback<Contact>,
  appContext: AppContext,
): ContextCallback {
  return async ctx => {
    const userId = ctx.from!.id
    const actionPrefix = hash(question)

    appContext.bot.on('contact', async (contactCtx, next) => {
      if (appContext.session.lazyGet(userId, actionPrefix)) {
        console.log(`Already asked question "${question}"`)
        return next && next()
      }
      appContext.session.lazySet(userId, actionPrefix)

      const fn = await callback(contactCtx.update.message!.contact!)
      await fn(contactCtx)

      return next && next()
    })
    return ctx.reply(question)
  }
}

export function inputHandler(
  question: string,
  callback: Callback<string>,
  appContext: AppContext,
): ContextCallback {
  return ctx => {
    const userId = ctx.from!.id
    const actionPrefix = hash(question)
    appContext.bot.on('message', async (messageCtx, next) => {
      if (appContext.session.lazyGet(userId, actionPrefix)) {
        console.log(`Already asked question "${question}"`)
        return next && next()
      }
      appContext.session.lazySet(userId, actionPrefix)
      const fn = await callback(messageCtx.update.message!.text!)
      await fn(messageCtx)
      return next && next()
    })
    return ctx.reply(question)
  }
}

export function locationHandler(
  question: string,
  callback: Callback<Location>,
  appContext: AppContext,
): ContextCallback {
  return async ctx => {
    const userId = ctx.from!.id
    const actionPrefix = hash(question)
    let message: Message
    appContext.bot.on('location', async (locationCtx, next) => {
      if (appContext.session.lazyGet(userId, actionPrefix)) {
        console.log(`Already asked question "${question}"`)
        return next && next()
      }
      appContext.session.lazySet(userId, actionPrefix)

      // https://core.telegram.org/bots/api#updating-messages
      // From the docs: Please note, that it is currently only possible to edit messages
      // without reply_markup or with inline keyboards.
      await appContext.bot.telegram.deleteMessage(
        message.chat.id,
        message.message_id,
      )
      // await ctx.reply(question)

      const fn = await callback(locationCtx.update.message!.location!)
      await fn(locationCtx)
      return next && next()
    })
    message = await ctx.reply(
      question,
      Extra.markup((markup: Markup) => {
        return (
          markup
            .keyboard([markup.locationRequestButton('Send location', false)])
            // oneTime doesn't seem to work for locationRequestButton
            .oneTime()
            .resize()
        )
      }),
    )
    return message
  }
}

function hash(str: string): string {
  return createHash('md5')
    .update(str)
    .digest('hex')
}
