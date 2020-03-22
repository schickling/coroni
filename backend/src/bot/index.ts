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
import { PrismaClient } from '@prisma/client'
import { EventIngest } from '../ingest'
import Model from '../model/model'

const db = new PrismaClient()

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
      const user = await db.user.findOne({
        where: { phoneNumber: `${ctx.chat!.id}` },
      })
      const ingest = new EventIngest(user!)
      await ingest.locationEvent(region.state, region.region)

      await ctx.reply(
        `\
Cool, Du wohnst in ${region.region} (${region.state}). Dort gibt es derzeit ${region.cases.cases} Fälle.`,
      )
      return q3(ctx)
    }
  },
  appContext,
)

const q3 = selectHandler(
  'Warst Du in den letzten 3 Wochen in einem Risikogebiet?',
  [
    [
      {
        text: 'Ja',
        callback: () => {
          return async ctx => {
            const user = await db.user.findOne({
              where: { phoneNumber: `${ctx.chat!.id}` },
            })
            const ingest = new EventIngest(user!)
            await ingest.highRiskEvent()
            return q5(ctx)
          }
        },
      },
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
      { text: 'Keine Symptome', callback: () => q7('Keine') },
      { text: 'Husten', callback: () => q7('Husten') },
    ],
    [
      { text: 'Fieber', callback: () => q7('Fieber') },
      { text: 'Atemprobleme', callback: () => q7('Atemprobleme') },
    ],
    [
      {
        text: 'Bei mir wurde Corona diagnostiziert!🌡️',
        callback: () => q7('Corona'),
      },
    ],
  ],
  appContext,
)
bot.command('q6', q6)

const q7MessageMap = {
  Keine: '✅ Du hast derzeit keinerlei Symptome. Sehr gut!',
  Husten: `✅ Alles klar, Du hast Husten. Das ist zwar ein Symptom, reicht aber allein noch nicht für eine Diagnose aus.`,
  Fieber: '✅ Bitte sei vorsichtig und gute Besserung!',
  Atemprobleme: '✅ Bitte sei vorsichtig und gute Besserung!',
  Corona: '✅ Well. This is awkward. You should see a doctor. 😷',
}
const q7 = (answer: keyof typeof q7MessageMap) => async (
  ctx: ContextMessageUpdate,
) => {
  const user = await db.user.findOne({
    where: { phoneNumber: `${ctx.chat!.id}` },
  })
  const ingest = new EventIngest(user!)
  if (answer === 'Husten' || answer === 'Atemprobleme' || answer === 'Fieber') {
    await ingest.sympthomsEvent()
  } else if (answer === 'Corona') {
    await ingest.diagnosedPositiveEvent()
  }

  await ctx.reply(q7MessageMap[answer])

  await selectHandler(
    'Warst Du in den letzten 24h mit größeren Menschenmassen im Kontakt?',
    [
      [{ text: 'Nein, ich war nur zuhause', callback: () => q8 }],
      [{ text: '> 50 (bspw. voller Supermarkt)', callback: () => q8 }],
      [{ text: '> 100 (bspw. Zug, Flugzeug, etc.)', callback: () => q8 }],
    ],
    appContext,
  )(ctx)
}
bot.command('q7', q7('Keine'))

const q8 = async (ctx: ContextMessageUpdate) => {
  await ctx.reply(
    `✅ Du warst nur Zuhause, super! Je weniger direkten Menschenkontakt Du hast, desto geringer ist die Wahrscheinlichkeit, mit dem Virus in Kontakt zu kommen.`,
  )

  await selectHandler(
    `\
Geschafft! Das waren die Grund-Informationen. Wie Du bestimmt weißt, ist es aktuell wichtig, soziale Kontakte auf ein Minimum zu reduzieren. Nur so können wir die Ausbreitung des Virus' verhindern.

Es ist klar, dass Du bestimmte Menschen trotzdem regelmäßig siehst. Wir nennen diese Gruppe Menschen Deine “Crew”.

Wie groß ist Deine Crew?`,
    [
      [
        { text: '0', callback: () => notImplemented },
        { text: '1', callback: () => contactQuestion(1, 0) },
        { text: '2', callback: () => contactQuestion(2, 0) },
        { text: '3', callback: () => contactQuestion(3, 0) },
      ],
      [
        { text: '4', callback: () => contactQuestion(4, 0) },
        { text: '5', callback: () => contactQuestion(5, 0) },
        { text: '6', callback: () => contactQuestion(6, 0) },
        { text: '7', callback: () => contactQuestion(7, 0) },
      ],
      [{ text: 'mehr', callback: () => contactQuestion(10, 0) }],
    ],
    appContext,
  )(ctx)
}
bot.command('q8', q8)

const contactQuestion = (
  crewSize: number,
  collected: number,
  contact?: Contact,
): ContextCallback => {
  return async ctx => {
    if (contact) {
      const user = await db.user.findOne({
        where: { phoneNumber: `${ctx.chat!.id}` },
      })
      const ingest = new EventIngest(user!)
      const data = { phoneNumber: `${contact.user_id!}` }
      const otherUser = await db.user.upsert({
        where: data,
        create: data,
        update: {},
      })
      await ingest.interactionEvent(otherUser)
    }

    if (crewSize === collected) {
      return onboardingComplete(ctx, crewSize, collected, contact!)
    }

    const question =
      collected === 0
        ? `\n
✅ Super, deine Crew besteht aus ${crewSize} Leuten.
Bitte teile die entsprechenden Kontakte:`
        : `[${collected}/${crewSize}] Super, ${contact?.first_name} ist nun Teil deiner Crew. Nächster Kontakt bitte.`
    return contactHandler(
      question,
      collected === 0 ? 'https://imgur.com/WnVaIOq.png' : undefined,
      contact => {
        console.log({ contact })
        return contactQuestion(crewSize, collected + 1, contact)
      },
      appContext,
    )(ctx)
  }
}

// TODO forwarding step missing

const onboardingComplete = async (
  ctx: ContextMessageUpdate,
  crewSize: number,
  collected: number,
  contact: Contact,
) => {
  const model = new Model()
  const user = await db.user.findOne({
    where: { phoneNumber: `${ctx.chat!.id}` },
  })
  const events = await db.event.findMany({
    include: { user: true, interaction: true },
  })
  const risks = model.calculate(events)

  await ctx.reply(`\
[${collected}/${crewSize}] Glückwunsch! Mit ${contact.first_name} ist Deine Crew nun komplett.

Und hier nun endlich Dein Ergebnis:`)

  await ctx.replyWithPhoto('https://imgur.com/jicHJrF.png')

  await ctx.replyWithMarkdown(`\
👩‍⚕️ Deine Infektions- wahrscheinlichkeit: **${risks.userRisk[user!.id] * 100}%**.

👪 Die Wahrscheinlichkeit, dass jemand in deiner Crew infiziert ist: **${risks
    .groupRisk[user!.id] * 100}%**.`)

  await ctx.reply(
    `Wir werden Dich jeden Tag nach einem Update fragen. Am besten funktioniert es, wenn jeder in Deiner Crew mitmacht. 👋`,
  )
}

// const checkin = async (ctx: ContextMessageUpdate) => {
//   await selectHandler(
//     'Hey! Es ist Zeit für dein tägliches Corona-Update. Wie fühlst du dich heute?',
//     [
//       [
//         { text: 'Keine Symptome', callback: () => q7 },
//         { text: 'Husten', callback: () => q7 },
//       ],
//       [
//         { text: 'Fieber', callback: () => q7 },
//         { text: 'Atemprobleme', callback: () => q7 },
//       ],
//       [{ text: 'Corona!', callback: () => q7 }],
//     ],
//     appContext,
//   )(ctx)
// }

// bot.command('/checkin', checkin)

bot.start(async ctx => {
  wipeUserSession(new Date(), ctx, appContext)
  await db.user.upsert({
    where: { phoneNumber: `${ctx.chat!.id}` },
    create: { phoneNumber: `${ctx.chat!.id}` },
    update: {},
  })
  await start(ctx)
})

const debug = true
if (debug) {
  const devUserIds = [
    // 108740976, // Julian Bauer
    67786295, // Johannes Schickling
    // 108990193, // Emanuel Joebstl
    // 1085659828, // Julian Specht
  ]
  for (const userId of devUserIds) {
    bot.telegram.sendMessage(userId, 'Server restarted. Please run /start')
  }
}

bot.launch()
