export const createExpiration = (seconds: number) => {
  return new Date(new Date().valueOf() + seconds * 1000);
};
