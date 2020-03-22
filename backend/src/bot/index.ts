import Telegraf, { ContextMessageUpdate } from 'telegraf'
import {
  selectHandler,
  locationHandler,
  // inputHandler,
  contactHandler,
  ContextCallback,
  wipeUserSession,
} from './utils'
import { debugMiddleware } from './middlewares'
import GeoCode from '../case-counts/geocode'
import { identifyRegion } from '../case-counts/regions'
import { Contact } from 'telegraf/typings/telegram-types'
import { Session } from './session'

const bot = new Telegraf(process.env.BOT_TOKEN!)

const appContext = { bot, session: new Session() }

bot.catch((e: any) => {
  console.log('telegraf error:')
  console.dir(e, { depth: null, colors: true })
})

// bot.use(debugMiddleware)

const notImplemented = (ctx: ContextMessageUpdate) =>
  ctx.reply('Game over. Restart with /start')

const start = async (ctx: ContextMessageUpdate) => {
  await ctx.reply(
    'Willkommen bei Coroni! 🦠 Gemeinsam sind wir im Kampf gegen Corona stark! Hilf dabei, das Virus einzudämmen, indem Du zuerst ein paar Fragen beantwortest 💪',
  )
  await q2Yes(ctx)
  // await selectHandler(
  //   'Bist Du gerade zu Hause?',
  //   [
  //     [
  //       { text: 'Ja', callback: () => q2Yes },
  //       { text: 'Nein (*)', callback: () => notImplemented },
  //     ],
  //   ],
  //   appContext,
  // )(ctx)
}

// location doppelt?
const q2Yes = locationHandler(
  'Wo wohnst Du? Keine Sorge, nur Deine Stadt ist relevant.',
  async loc => {
    const geocode = new GeoCode()
    const result = await geocode.lookup(loc.latitude, loc.longitude)
    const region = identifyRegion(result[0])!
    return async (ctx: ContextMessageUpdate) => {
      await ctx.reply(
        `\
Cool, Du wohnst in ${region.region} (${region.state}).
Derzeit ${region.cases.cases} Fälle.`,
      )
      return q3(ctx)
    }
  },
  appContext,
)

const q3 = selectHandler(
  'Warst Du in den letzten 2 Wochen in einem Risikogebiet?',
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
//   'Wo warst Du?',
//   async answer => {
//     return q6
//   },
//   appContext,
// )
// bot.command('q4', q4)

const q5 = selectHandler(
  'Danke für die Info. Wann war der letzte Tag Deiner Reise?',
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
  'Spürst Du Krankheitssymptome? 🤒',
  [
    [
      { text: 'Keine', callback: () => q7 },
      { text: 'Husten', callback: () => q7 },
    ],
    [
      { text: 'Fieber', callback: () => q7 },
      { text: 'Atemprobleme', callback: () => q7 },
    ],
    [{ text: 'Bei mir wurde Corona diagnostiziert!🌡️', callback: () => q7 }],
  ],
  appContext,
)
bot.command('q6', q6)

const q7 = selectHandler(
  'Warst Du in den letzten 24h mit größeren Menschenmassen im Kontakt?',
  [
    [{ text: 'Nein, ich war nur zuhause', callback: () => q8 }],
    [{ text: '> 50 (bspw. voller Supermarkt)', callback: () => q8 }],
    [{ text: '> 100 (bspw. Zug, Flugzeug, etc.)', callback: () => q8 }],
  ],
  appContext,
)
bot.command('q7', q7)

const q8 = selectHandler(
  `\
Geschafft! Das waren die Grund-Informationen. Wie Du bestimmt weißt, ist es aktuell wichtig, soziale Kontakte auf ein Minimum zu reduzieren. Nur so können wir die Ausbreitung des Virus' verhindern.

Es ist klar, dass Du bestimmte Menschen trotzdem regelmäßig siehst. Wir nennen diese Gruppe Menschen Deine “Crew”.

Wie groß ist Deine Crew?`,
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
      ? `✅ Super, deine Crew besteht aus ${crewSize} Leuten. Wer ist dabei?`
      : `[${collected}/${crewSize}] Super, Björn ist nun Teil deiner Crew. Nächster Kontakt bitte.`
  return contactHandler(
    question,
    collected === 0 ? 'https://i.imgur.com/QcNN7lk.png' : undefined,
    contact => {
      console.log({ contact })
      return contactQuestion(crewSize, collected + 1, contact)
    },
    appContext,
  )
}

// TODO forwarding step missing

const onboardingComplete = async (
  ctx: ContextMessageUpdate,
  crewSize: number,
  collected: number,
  contact: Contact,
) => {
  await ctx.reply(`\
[${collected}/${crewSize}] Glückwunsch! Mit ${contact.first_name} ist Deine Crew nun komplett.

Und hier nun endlich Dein Ergebnis:`)

  await ctx.replyWithPhoto('https://imgur.com/vMtyhMC.png')

  await ctx.replyWithMarkdown(`\
🤪 Deine Infektions- wahrscheinlichkeit: **25%**.

👪 Die Wahrscheinlichkeit, dass jemand in deiner Crew infiziert ist: **83%**.

👍 Deine Crew hat sich nicht vergrößert, super!`)

  await ctx.reply(
    `Wir werden Dich jeden Tag nach einem Update fragen. Am besten funktioniert es, wenn jeder in Deiner Crew mitmacht.`,
  )
}

const checkin = async (ctx: ContextMessageUpdate) => {
  await selectHandler(
    'Hey! Es ist Zeit für dein tägliches Corona-Update. Wie fühlst du dich heute?',
    [
      [
        { text: 'Keine Symptome', callback: () => q7 },
        { text: 'Husten', callback: () => q7 },
      ],
      [
        { text: 'Fieber', callback: () => q7 },
        { text: 'Atemprobleme', callback: () => q7 },
      ],
      [{ text: 'Corona!', callback: () => q7 }],
    ],
    appContext,
  )(ctx)
}

bot.command('/checkin', checkin)

bot.start(async ctx => {
  wipeUserSession(new Date(), ctx, appContext)
  await start(ctx)
})

const debug = true
if (debug) {
  const devUserIds = [
    108740976, // Julian Bauer
    67786295, // Johannes Schickling
    108990193, // Emanuel Joebstl
    1085659828, // Julian Specht
  ]
  for (const userId of devUserIds) {
    bot.telegram.sendMessage(userId, 'Server restarted. Please run /start')
  }
}

bot.launch()
