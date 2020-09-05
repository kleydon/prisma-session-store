/**
 * Creates an array starting from a certain value and ending just before another value
 * @param end the value to end just before reaching
 * @param start the value to start at. Defaults to 0
 */
export const range = (end: number, start: number = 0) =>
  Array.from({ length: end - start }, (_, i) => i + start);
