/**
 * Returns a promise that resolves after a given amount of time
 * @param duration the time in milliseconds before the promise resolves
 */
export const sleep = async (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));
