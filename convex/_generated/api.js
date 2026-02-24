/* eslint-disable */
// Stub module — replaced by `npx convex dev`
// Provides a proxy that returns undefined for any property access
// so hooks like useQuery(api.users.me) don't crash at build time.

const handler = {
  get(_target, prop) {
    if (prop === "__esModule") return true;
    if (prop === "default") return new Proxy({}, handler);
    return new Proxy({}, handler);
  },
};

export const api = new Proxy({}, handler);
export const internal = new Proxy({}, handler);
