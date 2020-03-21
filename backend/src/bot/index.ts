import Telegraf, { Extra, Markup } from 'telegraf'
import { questionHandler, locationHandler } from './utils'
import { debugMiddleware } from './middlewares'

const bot = new Telegraf(process.env.BOT_TOKEN!)

bot.catch((e: any) => {
  console.log('telegraf error', e.response, e.parameters, e.on || e)
})

bot.use(debugMiddleware)

const q3 = questionHandler(
  'q3',
  'Warst du in den letzten 2 Wochen in einem Risikogebiet?',
  [
    { text: 'Ja', callback: async () => console.log('yup') },
    { text: 'Nein', callback: async () => null },
  ],
  bot,
)

const q2Yes = locationHandler(
  'Wo ist dein Zuhause/Stadt?',
  loc => {
    console.log({ loc })
    return q3
  },
  bot,
)

const q1 = questionHandler(
  'q1',
  'Bist du gerade zu Hause?',
  [
    { text: 'Ja', callback: q2Yes },
    { text: 'Nein', callback: async () => null },
  ],
  bot,
)

bot.start(async ctx => {
  await ctx.reply('Welcome to Coroni 🦠')
  await q1(ctx)
})

bot.help(ctx => ctx.reply('Send me a sticker'))

bot.hears('hi', ctx => {
  ctx.reply('Hey there')
  // ctx.telegram.forwardMessage(108990193, ctx.from!.id, ctx.message!.message_id)
})

bot.hears('contact', ctx => {})

// bot.command('special', ctx => {
//   return ctx.reply(
//     'Special buttons keyboard',
//     Extra.markup((markup: Markup) => {
//       return markup
//         .resize()
//         .keyboard([
//           markup.contactRequestButton('contact', false),
//           markup.locationRequestButton('location', false),
//         ])
//     }),
//   )
// })

// let i = 1
// bot.on('contact', ctx => {
//   console.log(ctx.update.message?.contact)
//   const contact = ctx.update.message!.contact
//   ctx.reply(`Thanks a lot for sharing ${contact?.first_name} (${i++}/5)`)
// })

bot.launch()
