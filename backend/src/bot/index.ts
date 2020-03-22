import Telegraf, { ContextMessageUpdate } from 'telegraf'
import {
  selectHandler,
  locationHandler,
  inputHandler,
  contactHandler,
  ContextCallback,
} from './utils'
import { debugMiddleware } from './middlewares'
import GeoCode from '../case-counts/geocode'
import { identifyRegion } from '../case-counts/regions'
import { Contact } from 'telegraf/typings/telegram-types'

// TODOS
// - make user dynamic

const bot = new Telegraf(process.env.BOT_TOKEN!)

const appContext = { bot, session: {} }

bot.catch((e: any) => {
  console.log('telegraf error', e.response, e.parameters, e.on || e)
})

bot.use(debugMiddleware)

const q1 = selectHandler(
  'q1',
  'Bist du gerade zu Hause?',
  [
    [
      { text: 'Ja', callback: () => q2Yes },
      { text: 'Nein', callback: () => () => null },
    ],
  ],
  appContext,
)

const q2Yes = locationHandler(
  'Wo ist dein Zuhause/Stadt?',
  async loc => {
    const geocode = new GeoCode()
    const result = await geocode.lookup(loc.latitude, loc.longitude)
    const region = identifyRegion(result[0])
    return async (ctx: ContextMessageUpdate) => {
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
  appContext,
)

const q3 = selectHandler(
  'q3',
  'Warst du in den letzten 2 Wochen in einem Risikogebiet?',
  [
    [
      { text: 'Ja', callback: () => q4 },
      { text: 'Nein', callback: () => () => null },
    ],
  ],
  appContext,
)

const q4 = inputHandler(
  'Wo warst du?',
  async answer => {
    return q5
  },
  appContext,
)

const q5 = selectHandler(
  'q5',
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

const q6 = selectHandler(
  'q6',
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
  ],
  appContext,
)

const q7 = selectHandler(
  'q7',
  'Warst du in den letzten 24h mit größeren Menschenmassen im Kontakt?',
  [
    [{ text: 'Niemand, ich war nur zuhause', callback: () => q8 }],
    [{ text: '> 50 (voller Supermarkt, etc)', callback: () => q8 }],
    [{ text: '> 100 (Zug, Flugzeug, etc.)', callback: () => q8 }],
  ],
  appContext,
)

const q8 = selectHandler(
  'q7',
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

const onboardingComplete = (
  ctx: ContextMessageUpdate,
  crewSize: number,
  collected: number,
  contact: Contact,
) =>
  ctx.reply(
    `[${collected}/${crewSize}] Glückwunsch! Mit ${contact.first_name} ist deine Crew nun komplett. Onboarding complete. The end.`,
  )

bot.start(async ctx => {
  await ctx.reply('Welcome to Coroni 🦠')
  await q8(ctx)
})

bot.launch()
