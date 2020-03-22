import Telegraf, { Extra, Markup } from 'telegraf'
import { selectHandler, locationHandler, inputHandler } from './utils'
import { debugMiddleware } from './middlewares'
import GeoCode from '../case-counts/geocode'
import { identifyRegion } from '../case-counts/regions'

// TODOS
// - make user dynamic
// - highlight selected option
// - layout

const bot = new Telegraf(process.env.BOT_TOKEN!)

bot.catch((e: any) => {
  console.log('telegraf error', e.response, e.parameters, e.on || e)
})

bot.use(debugMiddleware)

const q8 = selectHandler(
  'q7',
  `\
Geschafft! Das waren die Baseline-Informationen. Wie du bestimmt weißt, ist es aktuell wichtig, soziale Kontakte auf ein Minimum zu reduzieren.
Es ist klar, dass du bestimmte Menschen trotzdem regelmäßig siehst. Wir nennen diese Gruppe Menschen deine “Crew”. Wie groß ist deine Crew?`,
  [
    [
      { text: '0', callback: async () => null },
      { text: '1', callback: async () => null },
      { text: '2', callback: async () => null },
    ],
    [
      { text: '3', callback: async () => null },
      { text: '4', callback: async () => null },
      { text: '5', callback: async () => null },
      { text: '6', callback: async () => null },
    ],
    [
      { text: '7', callback: async () => null },
      { text: 'mehr', callback: async () => null },
    ],
  ],
  bot,
)

const q7 = selectHandler(
  'q7',
  'Warst du in den letzten 24h mit größeren Menschenmassen im Kontakt?',
  [
    [{ text: 'Niemand, ich war nur zuhause', callback: q8 }],
    [{ text: '> 50 (voller Supermarkt, etc)', callback: q8 }],
    [{ text: '> 100 (Zug, Flugzeug, etc.)', callback: q8 }],
  ],
  bot,
)

const q6 = selectHandler(
  'q6',
  'Spürst du Krankheitssymptome?',
  [
    [
      { text: 'Keine', callback: q7 },
      { text: 'Husten', callback: q7 },
    ],
    [
      { text: 'Fieber', callback: q7 },
      { text: 'Atemprobleme', callback: q7 },
    ],
  ],
  bot,
)

const q5 = selectHandler(
  'q5',
  'Danke für die Info. Wann war der letzte Tag deiner Reise?',
  [
    [{ text: 'vor weniger als 1 Woche', callback: q6 }],
    [
      { text: 'vor 2 Wochen', callback: q6 },
      { text: 'vor 3 Wochen', callback: q6 },
    ],
  ],
  bot,
)

const q4 = inputHandler(
  'Wo warst du?',
  async answer => {
    return q5
  },
  bot,
)

const q3 = selectHandler(
  'q3',
  'Warst du in den letzten 2 Wochen in einem Risikogebiet?',
  [
    [
      { text: 'Ja', callback: q4 },
      { text: 'Nein', callback: async () => null },
    ],
  ],
  bot,
)

const q2Yes = locationHandler(
  'Wo ist dein Zuhause/Stadt?',
  async loc => {
    const geocode = new GeoCode()
    const result = await geocode.lookup(loc.latitude, loc.longitude)
    const region = identifyRegion(result[0])
    return async ctx => {
      await ctx.reply(
        `\
Cool, du wohnst in ${result[0].formatted_address}. \n
State: ${region?.state}
Region: ${region?.region}
Cases: ${region?.cases.cases}`,
      )
      return q3(ctx)
    }
  },
  bot,
)

const q1 = selectHandler(
  'q1',
  'Bist du gerade zu Hause?',
  [
    [
      { text: 'Ja', callback: q2Yes },
      { text: 'Nein', callback: async () => null },
    ],
  ],
  bot,
)

bot.start(async ctx => {
  await ctx.reply('Welcome to Coroni 🦠')
  await q1(ctx)
})

// bot.help(ctx => ctx.reply('Send me a sticker'))

// bot.hears('hi', ctx => {
//   ctx.reply('Hey there')
//   // ctx.telegram.forwardMessage(108990193, ctx.from!.id, ctx.message!.message_id)
// })

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
