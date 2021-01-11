import type { SessionData } from 'express-session';

/**
 * An object containing a list of sessions where the key is the
 * ID of the session and the value is the SessionData
 */
export interface ISessions {
  [key: string]: SessionData;
}
