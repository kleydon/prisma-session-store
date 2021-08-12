import type { SessionData } from 'express-session';
import type { PartialDeep } from 'type-fest';

import type { IOptions } from '../../@types';

import { ONE_DAY_MS } from './constants';

/**
 *  Determines the TTL (Time to Live) for a given session with given options
 * @param options the options to determine the TTL
 * @param session the session data
 * @param sid the id of the current session
 */
export const getTTL = <M extends string>(
  options: Pick<IOptions<M>, 'ttl'>,
  session: PartialDeep<SessionData>,
  sid: string
) => {
  if (typeof options.ttl === 'number') return options.ttl;
  if (typeof options.ttl === 'function')
    return options.ttl(options, session, sid);
  if ((options.ttl as unknown) !== undefined)
    throw new TypeError('`options.ttl` must be a number or function.');

  const maxAge = session.cookie?.maxAge ?? null;

  return typeof maxAge === 'number' ? Math.floor(maxAge) : ONE_DAY_MS;
};
