export const range = (length: number, offset: number = 0) =>
  Array.from({ length: length - offset }, (_, i) => i + offset);
