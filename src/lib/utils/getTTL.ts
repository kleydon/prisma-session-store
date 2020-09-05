import { IOptions } from '../../@types';
import { PartialDeep } from 'type-fest';
import { ONE_DAY } from './constants';

/**
 *  Determines the TTL (Time to Live) for a given session with given options
 * @param options the options to determine the TTL
 * @param session the session data
 * @param sid the id of the current session
 */
export const getTTL = (
  options: Pick<IOptions, 'ttl'>,
  session: PartialDeep<Express.SessionData>,
  sid: string
) => {
  if (typeof options.ttl === 'number') return options.ttl;
  if (typeof options.ttl === 'function')
    return options.ttl(options, session, sid);
  if (options.ttl)
    throw new TypeError('`options.ttl` must be a number or function.');

  const maxAge = session?.cookie?.maxAge ?? null;
  return typeof maxAge === 'number' ? Math.floor(maxAge) : ONE_DAY;
};
