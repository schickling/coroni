import { ContextMessageUpdate, Middleware } from 'telegraf'

export const debugMiddleware: Middleware<ContextMessageUpdate> = (
  ctx,
  next,
) => {
  if (ctx.callbackQuery && ctx.callbackQuery.data) {
    console.log(
      'another callbackQuery happened',
      ctx.callbackQuery.data.length,
      ctx.callbackQuery.data,
    )
  }

  return next && next()
}
