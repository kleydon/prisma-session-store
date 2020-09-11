interface IExpirationOptions {
  /**
   * The number of milliseconds to round the expiration date.
   * Mostly used for testing.
   */
  rounding?: number;
}
/**
 * Creates a `Date` object that is a certain number of milliseconds in the future.
 *
 * @param shelfLifeMs the number of milliseconds before the expiration date
 * @param options to modify the way this function behaves
 */
export const createExpiration = (
  shelfLifeMs: number,
  options: IExpirationOptions
) =>
  new Date(
    (options.rounding
      ? Math.floor(new Date().valueOf() / options.rounding) * options.rounding
      : new Date().valueOf()) + shelfLifeMs
  );
