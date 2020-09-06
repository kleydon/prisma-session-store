/**
 * Creates an array starting at 0 going to `length` -1
 * @param length the value to end just before reaching
 */
export const range = (length: number) => Array.from({ length }, (_, i) => i);
