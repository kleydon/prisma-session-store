import type { Store } from 'express-session';
import { EventEmitter } from 'events';

export class MockStore extends EventEmitter implements Store {
  listenerCount = jest.fn();
  regenerate = jest.fn();
  load = jest.fn();
  createSession = jest.fn();
  get = jest.fn();
  set = jest.fn();
  destroy = jest.fn();
  all = jest.fn();
  length = jest.fn();
  clear = jest.fn();
  touch = jest.fn();
  addListener = jest.fn();
  on = jest.fn();
  once = jest.fn();
  removeListener = jest.fn();
  off = jest.fn();
  removeAllListeners = jest.fn();
  setMaxListeners = jest.fn();
  getMaxListeners = jest.fn();
  listeners = jest.fn();
  rawListeners = jest.fn();
  emit = jest.fn();
  prependListener = jest.fn();
  prependOnceListener = jest.fn();
  eventNames = jest.fn();
}
