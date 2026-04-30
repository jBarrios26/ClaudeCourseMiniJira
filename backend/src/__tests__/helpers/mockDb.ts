import { vi } from 'vitest';

/**
 * Returns a Proxy that mimics a Drizzle query chain.
 * Any method call returns the same proxy; awaiting resolves to `result`.
 */
export function makeChain<T>(result: T): any {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then')
        return (onFulfilled: (v: T) => any) =>
          Promise.resolve(result).then(onFulfilled);
      if (prop === 'catch')
        return (onRejected: (e: any) => any) =>
          Promise.resolve(result).catch(onRejected);
      return (..._args: any[]) => proxy;
    },
  };
  const proxy: any = new Proxy({}, handler);
  return proxy;
}

/** Like makeChain but rejects — used to simulate DB constraint errors. */
export function makeRejectedChain(error: Error): any {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then')
        return (_onFulfilled: any, onRejected: any) =>
          Promise.reject(error).then(undefined, onRejected);
      if (prop === 'catch')
        return (onRejected: any) => Promise.reject(error).catch(onRejected);
      return (..._args: any[]) => proxy;
    },
  };
  const proxy: any = new Proxy({}, handler);
  return proxy;
}

export const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
