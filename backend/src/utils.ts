import Telegraf, { ContextMessageUpdate, Extra, Markup } from 'telegraf'
import { Location } from 'telegraf/typings/telegram-types'

type Callback = () => (ctx: ContextMessageUpdate) => Promise<any>

type Answer = {
  text: string
  callback: (ctx: ContextMessageUpdate) => Promise<any>
}

export function questionHandler(
  actionPrefix: string,
  question: string,
  answers: Answer[],
  bot: Telegraf<ContextMessageUpdate>,
): (ctx: ContextMessageUpdate) => Promise<any> {
  return ctx => {
    const actionKey = (index: number) => `${actionPrefix}-${index}`
    let questionAsked = false
    for (const i of answers.keys()) {
      bot.action(actionKey(i), actionCtx => {
        if (questionAsked) {
          console.log(`Already asked question "${question}"`)
          return
        }
        questionAsked = true
        answers[i].callback(actionCtx)
      })
    }
    return ctx.reply(
      question,
      Extra.markup(
        Markup.inlineKeyboard(
          answers.map((a, i) => Markup.callbackButton(a.text, actionKey(i))),
        ),
      ),
    )
  }
}

export function locationHandler(
  question: string,
  callback: (loc: Location) => (ctx: ContextMessageUpdate) => Promise<any>,
  bot: Telegraf<ContextMessageUpdate>,
): (ctx: ContextMessageUpdate) => Promise<any> {
  return ctx => {
    let questionAsked = false
    bot.on('location', async (locationCtx, next) => {
      if (questionAsked) {
        console.log(`Already asked question "${question}"`)
        return next && next()
      }
      questionAsked = true
      await callback(locationCtx.update.message!.location!)(locationCtx)
      return next && next()
    })
    return ctx.reply(
      question,
      Extra.markup((markup: Markup) => {
        return markup
          .resize()
          .keyboard([markup.locationRequestButton('Share location', false)])
      }),
    )
  }
}
