# Session tokens

`Resource` fetchers receive an args object with `env`, `controller`, and `params`. The `env` field is a snapshot of the per-`<app.Boundary>` [Env](./env.md) &mdash; exactly the right place to put a session token: typed, declared once on `App({ env })`, written from a single sign-in handler, read automatically by every fetcher.

This recipe covers:

- Declaring the session shape on `App({ env })`.
- Sign-in and sign-out handlers that write through `context.actions.produce`.
- Reading the token in every Resource fetcher via the `env` arg.
- Refresh-on-401 via a `ky` `afterResponse` hook that reads and writes the Env.
- Clearing Resource Caches on sign-out so cached payloads don't bleed across users.
- When to prefer HttpOnly cookies instead.

## Option 1: HttpOnly cookies (when available)

If the backend sets a session cookie on sign-in and the API is same-origin (or CORS-configured with `credentials: "include"`), the browser auto-attaches it on every request. JS never sees the token; there's nothing to put in the Env. Sign-in / sign-out are just Resources that hit `/api/auth/*` and let the backend's `Set-Cookie` headers do the work:

```ts
// api/client.ts
import ky from "ky";

export const api = ky.create({
  prefixUrl: "/api",
  credentials: "include",
});

// resources.ts
import { app } from "./app";
import { api } from "./api/client";

export const user = app.Resource<User>({
  fetch(context) {
    return api.get("user", { signal: context.controller.signal }).json<User>();
  },
});
```

Simpler than anything below. Reach for it first.

## Option 2: Bearer token in the Env

When cookies aren't viable (React Native, cross-origin APIs without a proxy, browser extensions, anywhere you need to send an `Authorization` header), put the session in the Env.

### Declare the shape on `App`

```ts
// app.ts
import { App } from "march-hare";

export type Session = { accessToken: string; refreshToken: string };

export const app = App({
  env: {
    session: null as Session | null,
  },
});
```

Every read/write of `env.session` &mdash; in handlers, fetchers, the `app.useEnv()` hook &mdash; is typed against the shape inferred from this object.

### Wire the Boundary

```tsx
import { app } from "./app";

<app.Boundary>
  <Root />
</app.Boundary>;
```

If the session should survive reloads, hydrate the initial value from persistent storage at app boot:

```tsx
import { App, Cache, utils } from "march-hare";

const sessionCache = Cache({
  get: (key) => sessionStorage.getItem(key),
  set: (key, value) => sessionStorage.setItem(key, value),
  remove: (key) => sessionStorage.removeItem(key),
  keys: () => Object.keys(sessionStorage),
});

const stored = sessionCache.get<Session>("session");
const initial = stored.data === utils.unset ? null : stored.data;

export const app = App({
  env: { session: initial },
});
```

Whether to persist access tokens in `sessionStorage` / `localStorage` is a security trade-off (XSS surface vs. UX); pick per app.

### Resources read the token via dot notation

Every fetcher receives the Env on its args object. Read the token with plain dot notation; the rest of the Resource stays one-line:

```ts
// resources.ts
import ky from "ky";
import { app } from "./app";

export const user = app.Resource<User, { id: number }>({
  fetch({ env, controller, params }) {
    return ky
      .get(`/api/users/${params.id}`, {
        headers: env.session
          ? { Authorization: `Bearer ${env.session.accessToken}` }
          : {},
        signal: controller.signal,
      })
      .json<User>();
  },
});

export const pay = app.Resource<Receipt, Body>({
  fetch({ env, controller, params }) {
    return ky
      .post("/api/pay", {
        headers: env.session
          ? { Authorization: `Bearer ${env.session.accessToken}` }
          : {},
        json: params,
        signal: controller.signal,
      })
      .json<Receipt>();
  },
});
```

No module-level mutable, no `getSession()` helper, no `ky.beforeRequest` reading a singleton. The token comes from where every other ambient value lives.

### Sign-in / sign-out write via `context.actions.produce`

```ts
// auth/actions.ts
import { app } from "../app";
import { Actions } from "./types";
import * as resource from "./resources";

export function useActions() {
  const context = app.useContext<void, typeof Actions>();
  const actions = context.useActions();

  actions.useAction(Actions.SignIn, async (context, credentials) => {
    const signIn = await context.actions.resource(resource.signIn(credentials));
    context.actions.produce(({ env }) => {
      env.session = {
        accessToken: signIn.accessToken,
        refreshToken: signIn.refreshToken,
      };
    });
    await context.actions.dispatch(Actions.Broadcast.SignedIn, signIn);
  });

  actions.useAction(Actions.SignOut, async (context) => {
    await context.actions.resource(resource.signOut());
    context.actions.produce(({ env }) => {
      env.session = null;
    });
    await context.actions.dispatch(Actions.Broadcast.SignedOut);
  });

  return actions;
}
```

Components that need to react to sign-in/sign-out subscribe to the broadcast actions as usual. The Env carries the ambient value; broadcasts carry the _event_.

## Refresh on 401

When the access token expires, refresh once and retry transparently. This belongs on a shared `ky` client's `afterResponse` hook. The hook runs outside React, so the client is created once at module scope and reads the latest session through two binder functions &mdash; one to read, one to write &mdash; that a small top-level component plugs in on every render.

```ts
// api/client.ts
import ky from "ky";
import type { Session } from "../app";

let readSession: () => Session | null = () => null;
let writeSession: (next: Session | null) => void = () => {};

export function bindSession(
  read: () => Session | null,
  write: (next: Session | null) => void,
): void {
  readSession = read;
  writeSession = write;
}

// Bare client used only for refresh — never goes through `api`, otherwise
// a 401 on refresh would re-enter afterResponse → infinite loop.
const refreshClient = ky.create({ prefixUrl: "/api" });

export const api = ky.create({
  prefixUrl: "/api",
  hooks: {
    beforeRequest: [
      (request) => {
        const current = readSession();
        if (current) {
          request.headers.set("Authorization", `Bearer ${current.accessToken}`);
        }
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 401) return;
        const current = readSession();
        if (!current) return; // not signed in — bubble the 401

        const next = await refreshClient
          .post("auth/refresh", {
            json: { refreshToken: current.refreshToken },
          })
          .json<Session>()
          .catch(() => null);

        if (next === null) {
          writeSession(null);
          return; // bubble the original 401
        }

        writeSession(next);
        request.headers.set("Authorization", `Bearer ${next.accessToken}`);
        return ky(request);
      },
    ],
  },
});
```

A tiny top-level component plugs the live Env reader and an internal dispatch into those binders. It renders `null` &mdash; no provider, no children wrapping, no ref dance:

```tsx
import { app } from "./app";
import { bindSession } from "./api/client";

function AuthBridge(): null {
  const env = app.useEnv();
  const [, actions] = useActions();

  bindSession(
    () => env.session,
    (next) => void actions.dispatch(Actions.RefreshSession, next),
  );

  return null;
}

// Internal action that writes the refresh result back to the Env.
actions.useAction(Actions.RefreshSession, (context, next) => {
  context.actions.produce(({ env }) => {
    env.session = next;
  });
});
```

Mount `<AuthBridge />` once inside the `<app.Boundary>` and Resources go on importing `api` from `./api/client` as if nothing fancy was happening. `bindSession` is called every render but it just rebinds two function references &mdash; no allocations, no lifecycle hooks, no `useRef`.

Notes:

- **Separate `refreshClient`.** Send the refresh request through a bare client to avoid an `afterResponse` loop.
- **One refresh at a time.** The example above will fire multiple parallel refreshes if several requests 401 simultaneously. For a production app, gate refreshes behind a module-scope `Promise<Session>` so concurrent 401s share the same attempt.
- **Refresh failure bubbles.** Setting `session` to `null` and returning lets the original 401 propagate to the caller, where a `Lifecycle.Fault` handler can sign the user out fully and redirect.

## Clear Resource Caches on sign-out

If your Resources are wired to persistent `Cache`s, the previous user's cached payloads survive sign-out and bleed into the next session. There are two ways to keep tenants from seeing each other's data &mdash; pick one:

**Option A: Scope every slot by access token.** Pass `key({ env })` on the Cache so writes for Alice land under `alice:…` and Bob's land under `bob:…`. Same backing store, no leakage between tenants, no explicit clear required:

```ts
type AppEnv = { session: { accessToken: string } | null };

export const app = App<AppEnv>({
  env: { session: null },
  cache: Cache<AppEnv>({
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key),
    keys: () => Object.keys(localStorage),
    key: ({ env }) => env.session?.accessToken ?? "",
  }),
});
```

When `session` flips to `null`, the scope becomes the empty string &mdash; the signed-out gap reads through the top-level (unscoped) tier. See the [scoped cache section in `use-resource.md`](./use-resource.md#per-context-scoping--cache-adapter-key) for the resource-side semantics.

**Option B: Clear on sign-out.** Reach for this when scoping by token isn't an option (e.g. shared cache across resources with different lifetimes). Clear them alongside the Env reset:

```ts
import { userCache, ordersCache, settingsCache } from "../caches";
import * as resource from "../resources";

actions.useAction(Actions.SignOut, async (context) => {
  await context.actions.resource(resource.signOut());

  context.actions.produce(({ env }) => {
    env.session = null;
  });

  // Wipe everything the signed-in user might have cached.
  userCache.clear();
  ordersCache.clear();
  settingsCache.clear();

  await context.actions.dispatch(Actions.Broadcast.SignedOut);
});
```

The Env reset and Cache clears are independent concerns (token vs. cached data); both belong in the sign-out handler.

## Targeted authorisation (per-component, per-call)

If a single call needs a different token than the ambient session (impersonation, service-to-service hops, etc.), pass an explicit override via `params` and merge in the fetcher:

```ts
type AdminUserParams = { id: number; asToken?: string };

export const adminUser = app.Resource<User, AdminUserParams>({
  fetch({ env, controller, params }) {
    const token = params.asToken ?? env.session?.accessToken;
    return ky
      .get(`/api/users/${params.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      })
      .json<User>();
  },
});
```

The per-params cache treats `asToken` as part of the key, so impersonation calls don't collide with the ambient session's slot.

## Limitations

- **Single ambient session per Boundary.** Multi-tenant cases where one screen needs to authenticate against two different backends are handled by either explicit per-call overrides (as above) or by nested `<app.Boundary>` instances backed by distinct `App` calls.
- **SSR needs per-request Boundaries.** On the server each request must get its own Boundary with a fresh Env containing that request's session. Build a new `App({ env })` per request &mdash; the `App` factory is cheap.
- **Refresh-during-await isn't free.** If a request fires, the token expires mid-flight, and a parallel refresh races in, the original request's `Authorization` is already on the wire and may 401. The `afterResponse` retry handles this, but the user-visible latency is two round-trips.
