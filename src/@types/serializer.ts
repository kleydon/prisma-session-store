export interface ISerializer {
  /**
   * A function to take a string and convert it into a JavaScript object.
   * The inverse of `stringify()`
   */
  parse: (string: string) => object;

  /**
   * A function to take a JavaScript object and covert it into a string.
   * The inverse of `parse()`
   */
  stringify: (object: object) => string;
}
