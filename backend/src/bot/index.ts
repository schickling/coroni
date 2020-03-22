import Telegraf, { ContextMessageUpdate } from 'telegraf'
import {
  selectHandler,
  locationHandler,
  inputHandler,
  contactHandler,
  ContextCallback,
  Session,
  wipeUserSession,
} from './utils'
import { debugMiddleware } from './middlewares'
import GeoCode from '../case-counts/geocode'
import { identifyRegion } from '../case-counts/regions'
import { Contact } from 'telegraf/typings/telegram-types'

// TODOS
// - make user dynamic

const bot = new Telegraf(process.env.BOT_TOKEN!)

const appContext = { bot, session: new Session() }

bot.catch((e: any) => {
  console.log('telegraf error', e.response, e.parameters, e.on || e)
})

bot.use(debugMiddleware)

const notImplemented = (ctx: ContextMessageUpdate) =>
  ctx.reply('Game over. Restart with /start')

const start = async (ctx: ContextMessageUpdate) => {
  await ctx.reply('Welcome to Coroni 🦠')
  await q2Yes(ctx)
  // await selectHandler(
  //   'Bist du gerade zu Hause?',
  //   [
  //     [
  //       { text: 'Ja', callback: () => q2Yes },
  //       { text: 'Nein (*)', callback: () => notImplemented },
  //     ],
  //   ],
  //   appContext,
  // )(ctx)
}

const q2Yes = locationHandler(
  'Wo ist dein Zuhause oder Stadt?',
  async loc => {
    const geocode = new GeoCode()
    const result = await geocode.lookup(loc.latitude, loc.longitude)
    const region = identifyRegion(result[0])!
    return async (ctx: ContextMessageUpdate) => {
      await ctx.reply(
        `\
Cool, du wohnst in ${region.region} (${region.state}).
Derzeit ${region.cases.cases} Fälle.`,
      )
      return q3(ctx)
    }
  },
  appContext,
)

const q3 = selectHandler(
  'Warst du in den letzten 2 Wochen in einem Risikogebiet?',
  [
    [
      { text: 'Ja', callback: () => q5 },
      { text: 'Nein', callback: () => q6 },
    ],
  ],
  appContext,
)
bot.command('q3', q3)

// const q4 = inputHandler(
//   'Wo warst du?',
//   async answer => {
//     return q6
//   },
//   appContext,
// )
// bot.command('q4', q4)

const q5 = selectHandler(
  'Danke für die Info. Wann war der letzte Tag deiner Reise?',
  [
    [{ text: 'vor weniger als 1 Woche', callback: () => q6 }],
    [
      { text: 'vor 2 Wochen', callback: () => q6 },
      { text: 'vor 3 Wochen', callback: () => q6 },
    ],
  ],
  appContext,
)
bot.command('q5', q5)

const q6 = selectHandler(
  'Spürst du Krankheitssymptome?',
  [
    [
      { text: 'Keine', callback: () => q7 },
      { text: 'Husten', callback: () => q7 },
    ],
    [
      { text: 'Fieber', callback: () => q7 },
      { text: 'Atemprobleme', callback: () => q7 },
    ],
    [
      { text: 'Corona!', callback: () => q7 },
    ],
  ],
  appContext,
)
bot.command('q6', q6)

const q7 = selectHandler(
  'Warst du in den letzten 24h mit größeren Menschenmassen im Kontakt?',
  [
    [{ text: 'Niemand, ich war nur zuhause', callback: () => q8 }],
    [{ text: '> 50 (voller Supermarkt, etc)', callback: () => q8 }],
    [{ text: '> 100 (Zug, Flugzeug, etc.)', callback: () => q8 }],
  ],
  appContext,
)
bot.command('q7', q7)

const q8 = selectHandler(
  `\
Geschafft! Das waren die Baseline-Informationen. Wie du bestimmt weißt, ist es aktuell wichtig, soziale Kontakte auf ein Minimum zu reduzieren.
Es ist klar, dass du bestimmte Menschen trotzdem regelmäßig siehst. Wir nennen diese Gruppe Menschen deine “Crew”. Wie groß ist deine Crew?`,
  [
    [
      { text: '0', callback: () => contactQuestion(0, 0) },
      { text: '1', callback: () => contactQuestion(1, 0) },
      { text: '2', callback: () => contactQuestion(2, 0) },
    ],
    [
      { text: '3', callback: () => contactQuestion(3, 0) },
      { text: '4', callback: () => contactQuestion(4, 0) },
      { text: '5', callback: () => contactQuestion(5, 0) },
      { text: '6', callback: () => contactQuestion(6, 0) },
    ],
    [
      { text: '7', callback: () => contactQuestion(7, 0) },
      { text: 'mehr', callback: () => contactQuestion(10, 0) },
    ],
  ],
  appContext,
)
bot.command('q8', q8)

const contactQuestion = (
  crewSize: number,
  collected: number,
  contact?: Contact,
): ContextCallback => {
  if (crewSize === collected) {
    return ctx => onboardingComplete(ctx, crewSize, collected, contact!)
  }

  const question =
    collected === 0
      ? 'Her mit deiner Crew'
      : `Added ${
          contact!.first_name
        }. Nächster Kontakt bitte (${collected}/${crewSize})`
  return contactHandler(
    question,
    contact => {
      console.log({ contact })
      return contactQuestion(crewSize, collected + 1, contact)
    },
    appContext,
  )
}

const onboardingComplete = async (
  ctx: ContextMessageUpdate,
  crewSize: number,
  collected: number,
  contact: Contact,
) => {
  await ctx.reply(`\
[${collected}/${crewSize}] Glückwunsch! Mit ${contact.first_name} ist deine Crew nun komplett.

Und hier nun endlich dein Ergebnis:`)

  await ctx.replyWithPhoto('https://i.imgur.com/ceRsYUD.png')

  await ctx.replyWithMarkdown(`\
🤪 Deine Infektions- wahrscheinlichkeit: **25%**.

👪 Die Wahrscheinlichkeit, dass jemand in deiner Gruppe infiziert ist: **83%**.

👍 Deine Gruppe hat sich nicht vergrößert, super!`)

  await ctx.reply(
    `Wir werden dich jeden Tag nach einem Update fragen. Am besten funktioniert es, wenn jeder deiner Crew mitmacht.`,
  )
}

bot.start(async ctx => {
  wipeUserSession(ctx, appContext)
  await start(ctx)
})

bot.launch()
