/**
 * Creates a `Date` object that is a certain number of milliseconds in the future.
 * @param milliseconds the number of milliseconds before the expiration date
 */
export const createExpiration = (shelfLifeMs: number) =>
  new Date(Math.floor(new Date().valueOf() / 10) * 10 + shelfLifeMs);
