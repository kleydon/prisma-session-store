import { EventEmitter } from 'events';
import type { Store } from 'express-session';

/**
 * A Jest Mock of a Express Session Store
 */
export class MockStore extends EventEmitter implements Store {
  public addListener = jest.fn();
  public all = jest.fn();
  public clear = jest.fn();
  public createSession = jest.fn();
  public destroy = jest.fn();
  public emit = jest.fn();
  public eventNames = jest.fn();
  public get = jest.fn();
  public getMaxListeners = jest.fn();
  public length = jest.fn();
  public listenerCount = jest.fn();
  public listeners = jest.fn();
  public load = jest.fn();
  public off = jest.fn();
  public on = jest.fn();
  public once = jest.fn();
  public prependListener = jest.fn();
  public prependOnceListener = jest.fn();
  public rawListeners = jest.fn();
  public regenerate = jest.fn();
  public removeAllListeners = jest.fn();
  public removeListener = jest.fn();
  public set = jest.fn();
  public setMaxListeners = jest.fn();
  public touch = jest.fn();
}
