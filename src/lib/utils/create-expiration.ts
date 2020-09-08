/**
 * Creates a `Date` object that is a certain number of milliseconds in the future.
 * Note: The time will be rounded down to the nearest `0.01s` to enure expirations
 * created at roughly the same time match. This is required in order to test these
 * values.
 *
 * @param shelfLifeMs the number of milliseconds before the expiration date
 */
export const createExpiration = (shelfLifeMs: number) =>
  new Date(Math.floor(new Date().valueOf() / 10) * 10 + shelfLifeMs);
