export const defer = <T extends Function, A extends any[]>(
  callback: T,
  ...args: A
) => {
  setImmediate(() => {
    callback(...args);
  });
};
