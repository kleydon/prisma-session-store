import type { Store } from 'express-session';

export interface ISession {
  Store: typeof Store;
}
