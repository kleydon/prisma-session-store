import type { Store } from 'express-session';

export interface Session {
  Store: typeof Store;
}
