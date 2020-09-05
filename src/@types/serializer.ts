export interface ISerializer {
  parse: (string: string) => object;
  stringify: (object: object) => string;
}
