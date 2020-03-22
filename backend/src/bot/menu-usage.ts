// import { menu, rmw } from './menu'

// bot.on('message', async ctx => {
//   console.log({ message: ctx.message })
//   // rmw.setSpecific(ctx, 'a')
// })

// bot.use(
//   menu.init({
//     backButtonText: 'back…',
//     mainMenuButtonText: 'back to main menu…',
//     actionCode: 'a',
//   }),
// )

// setTimeout(async () => {
//   const message = await bot.telegram.sendMessage(
//     67786295,
//     'deferred message',
//     Extra.markup((markup: Markup) =>
//       Markup.inlineKeyboard([
//         Markup.callbackButton('Start questions', 'my-callback-data'),
//         // Markup.contactRequestButton('contact')
//       ]),
//     ),
//   )
//   message.
// }, 300)

// bot.action('my-callback-data', ctx => {
//   ctx.answerCbQuery('answer')
//   // rmw.setSpecific(ctx, 'a')
// })

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
