import Telegraf, { ContextMessageUpdate, Extra, Markup } from 'telegraf'
import { Location, Message, Contact } from 'telegraf/typings/telegram-types'

type PromiseOrConst<T> = Promise<T> | T
export type ContextCallback = (ctx: ContextMessageUpdate) => PromiseOrConst<any>
export type Callback<T> = (arg: T) => PromiseOrConst<ContextCallback>

export type Session = {
  [userId: number]: {
    [sessionKey: string]: boolean
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

export function selectHandler(
  actionPrefix: string,
  question: string,
  answers: Answer[][],
  appContext: AppContext,
): (ctx: ContextMessageUpdate) => Promise<any> {
  return ctx => {
    const actionKey = (row: number, col: number) =>
      `${actionPrefix}-${row}-${col}`

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

    let questionAsked = false
    for (const row of answers.keys()) {
      for (const col of answers[row].keys())
        appContext.bot.action(actionKey(row, col), async actionCtx => {
          if (questionAsked) {
            console.log(`Already asked question "${question}"`)
            return
          }
          questionAsked = true
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
): (ctx: ContextMessageUpdate) => Promise<any> {
  return async ctx => {
    let questionAsked = false
    let message: Message

    appContext.bot.on('contact', async (contactCtx, next) => {
      if (questionAsked) {
        console.log(`Already asked question "${question}"`)
        return next && next()
      }
      questionAsked = true

      const fn = await callback(contactCtx.update.message!.contact!)
      await fn(contactCtx)

      return next && next()
    })
    message = await ctx.reply(question)
    return message
  }
}

export function inputHandler(
  question: string,
  callback: Callback<string>,
  appContext: AppContext,
): (ctx: ContextMessageUpdate) => Promise<any> {
  return ctx => {
    let questionAsked = false
    appContext.bot.on('message', async (messageCtx, next) => {
      if (questionAsked) {
        console.log(`Already asked question "${question}"`)
        return next && next()
      }
      questionAsked = true
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
): (ctx: ContextMessageUpdate) => Promise<any> {
  return async ctx => {
    let questionAsked = false
    let message: Message
    appContext.bot.on('location', async (locationCtx, next) => {
      if (questionAsked) {
        console.log(`Already asked question "${question}"`)
        return next && next()
      }
      questionAsked = true

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
