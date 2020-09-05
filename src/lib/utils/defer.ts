/**
 * Runs a callback with a number of arguments on the next tick
 *
 * @param callback the function to run in the future
 * @param args the arguments for the `callback` function when it is run
 */
export const defer = <T extends Function, A extends any[]>(
  callback: T,
  ...args: A
) => {
  setImmediate(() => {
    callback(...args);
  });
};
