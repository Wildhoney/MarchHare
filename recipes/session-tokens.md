# Session tokens

`Resource` fetchers receive an args object with `store`, `signal`, and `params`. The `store` field is a snapshot of the per-`<Boundary>` [Store](./store.md) &mdash; exactly the right place to put a session token: typed, declared once via module augmentation, written from a single sign-in handler, read automatically by every fetcher.

This recipe covers:

- Declaring the session in the Store.
- Sign-in and sign-out handlers that write through `context.actions.produce`.
- Reading the token in every Resource fetcher via the `store` arg.
- Refresh-on-401 via a `ky` `afterResponse` hook that reads and writes the Store.
- Clearing Resource Caches on sign-out so cached payloads don't bleed across users.
- When to prefer HttpOnly cookies instead.

## Option 1: HttpOnly cookies (when available)

If the backend sets a session cookie on sign-in and the API is same-origin (or CORS-configured with `credentials: "include"`), the browser auto-attaches it on every request. JS never sees the token; there's nothing to put in the Store. Sign-in / sign-out are just Resources that hit `/api/auth/*` and let the backend's `Set-Cookie` headers do the work:

```ts
// api/client.ts
import ky from "ky";

export const api = ky.create({
  prefixUrl: "/api",
  credentials: "include",
});

// resources.ts
import { Resource } from "march-hare";
import { api } from "./api/client";

export const user = Resource(({ signal }) =>
  api.get("user", { signal }).json<User>(),
);
```

Simpler than anything below. Reach for it first.

## Option 2: Bearer token in the Store

When cookies aren't viable (React Native, cross-origin APIs without a proxy, browser extensions, anywhere you need to send an `Authorization` header), put the session in the Store.

### Declare the shape

```ts
// auth/types.ts
export type Session = { accessToken: string; refreshToken: string };

// app/store.ts
declare module "march-hare" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Store {
    session: Session | null;
  }
}
```

### Wire the initial Store at the Boundary

```tsx
<Boundary store={{ session: null }}>
  <App />
</Boundary>
```

If the session should survive reloads, hydrate the initial value from persistent storage at app boot:

```tsx
import { Cache, utils } from "march-hare";

const sessionCache = new Cache({
  get: (key) => sessionStorage.getItem(key),
  set: (key, value) => sessionStorage.setItem(key, value),
  remove: (key) => sessionStorage.removeItem(key),
  clear: () => sessionStorage.clear(),
});

const stored = sessionCache.get<Session>("session");
const initial = stored.data === utils.unset ? null : stored.data;

<Boundary store={{ session: initial }}>
  <App />
</Boundary>;
```

Whether to persist access tokens in `sessionStorage` / `localStorage` is a security trade-off (XSS surface vs. UX); pick per app.

### Resources read the token via dot notation

Every fetcher receives the Store on its args object. Read the token with plain dot notation; the rest of the Resource stays one-line:

```ts
// resources.ts
import ky from "ky";
import { Resource, type FetcherArgs } from "march-hare";

export const user = Resource(
  ({ store, signal, params }: FetcherArgs<{ id: number }>) =>
    ky
      .get(`/api/users/${params.id}`, {
        headers: store.session
          ? { Authorization: `Bearer ${store.session.accessToken}` }
          : {},
        signal,
      })
      .json<User>(),
);

export const pay = Resource(({ store, signal, params }: FetcherArgs<Body>) =>
  ky
    .post("/api/pay", {
      headers: store.session
        ? { Authorization: `Bearer ${store.session.accessToken}` }
        : {},
      json: params,
      signal,
    })
    .json<Receipt>(),
);
```

No module-level mutable, no `getSession()` helper, no `ky.beforeRequest` reading a singleton. The token comes from where every other ambient value lives.

### Sign-in / sign-out write via `context.actions.produce`

```ts
// auth/actions.ts
import { useActions } from "march-hare";
import { Actions } from "./types";
import * as resource from "./resources";

export function useAuthActions() {
  const actions = useActions<void, typeof Actions>();

  actions.useAction(Actions.SignIn, async (context, creds) => {
    const result = await context.actions.resource(resource.signIn, creds);
    context.actions.produce(({ store }) => {
      store.session = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    });
    await context.actions.dispatch(Actions.Broadcast.SignedIn, result);
  });

  actions.useAction(Actions.SignOut, async (context) => {
    await context.actions.resource(resource.signOut);
    context.actions.produce(({ store }) => {
      store.session = null;
    });
    await context.actions.dispatch(Actions.Broadcast.SignedOut);
  });

  return actions;
}
```

Components that need to react to sign-in/sign-out subscribe to the broadcast actions as usual. The Store carries the ambient value; broadcasts carry the _event_.

## Refresh on 401

When the access token expires, refresh once and retry transparently. This belongs on a shared `ky` client's `afterResponse` hook. Since the hook runs outside React, give it a direct reference to the Store ref via a small auth-flow function that owns the `ky` client lifetime:

```ts
// api/client.ts
import ky, { type KyInstance } from "ky";
import type { Store } from "march-hare";

// Bare client used only for refresh — never goes through `api`, otherwise
// a 401 on refresh would re-enter afterResponse → infinite loop.
const refreshClient = ky.create({ prefixUrl: "/api" });

// The Store ref is mutated by sign-in / sign-out / refresh. We expose a
// small accessor so the ky hooks can read and write it without going
// through React.
type SessionAccessor = {
  read: () => Store["session"];
  write: (next: Store["session"]) => void;
};

export function makeApiClient(session: SessionAccessor): KyInstance {
  return ky.create({
    prefixUrl: "/api",
    hooks: {
      beforeRequest: [
        (request) => {
          const current = session.read();
          if (current) {
            request.headers.set(
              "Authorization",
              `Bearer ${current.accessToken}`,
            );
          }
        },
      ],
      afterResponse: [
        async (request, _options, response) => {
          if (response.status !== 401) return;
          const current = session.read();
          if (!current) return; // not signed in — bubble the 401

          const next = await refreshClient
            .post("auth/refresh", {
              json: { refreshToken: current.refreshToken },
            })
            .json<{ accessToken: string; refreshToken: string }>()
            .catch(() => null);

          if (next === null) {
            session.write(null);
            return; // bubble the original 401
          }

          session.write(next);
          request.headers.set("Authorization", `Bearer ${next.accessToken}`);
          return ky(request);
        },
      ],
    },
  });
}
```

Wire the accessor at app boot using a component that bridges the Store into the `ky` client and dispatches actions for any writes the hooks need to make:

```tsx
import { useStore } from "march-hare";

function AuthBridge({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const actions = useAuthActions();

  // Use a ref so the api client closes over a stable accessor that always
  // reads the latest store.session via dot notation.
  const apiRef = React.useRef<KyInstance | null>(null);
  if (apiRef.current === null) {
    apiRef.current = makeApiClient({
      read: () => store.session,
      write: (next) => {
        // Dispatch an internal action that writes session via produce.
        void actions[1].dispatch(Actions.RefreshSession, next);
      },
    });
  }

  return (
    <ApiContext.Provider value={apiRef.current}>{children}</ApiContext.Provider>
  );
}

// Internal action that writes the refresh result back to the Store.
actions.useAction(Actions.RefreshSession, (context, next) => {
  context.actions.produce(({ store }) => {
    store.session = next;
  });
});
```

Resources then read the client from `ApiContext` (via React context, since the client is React-scoped now) or from a module export &mdash; pick whichever fits your wiring.

Notes:

- **Separate `refreshClient`.** Send the refresh request through a bare client to avoid an `afterResponse` loop.
- **One refresh at a time.** The example above will fire multiple parallel refreshes if several requests 401 simultaneously. For a production app, gate refreshes behind a module-scope `Promise<Session>` so concurrent 401s share the same attempt.
- **Refresh failure bubbles.** Setting `session` to `null` and returning lets the original 401 propagate to the caller, where a `Lifecycle.Fault` handler can sign the user out fully and redirect.

## Clear Resource Caches on sign-out

If your Resources are wired to persistent `Cache`s, the previous user's cached payloads survive sign-out and bleed into the next session. Clear them alongside the Store reset:

```ts
import { userCache, ordersCache, settingsCache } from "../caches";

actions.useAction(Actions.SignOut, async (context) => {
  await context.actions.resource(resource.signOut);

  context.actions.produce(({ store }) => {
    store.session = null;
  });

  // Wipe everything the signed-in user might have cached.
  userCache.clear();
  ordersCache.clear();
  settingsCache.clear();

  await context.actions.dispatch(Actions.Broadcast.SignedOut);
});
```

The Store reset and Cache clears are independent concerns (token vs. cached data); both belong in the sign-out handler.

## Targeted authorisation (per-component, per-call)

If a single call needs a different token than the ambient session (impersonation, service-to-service hops, etc.), pass an explicit override via `params` and merge in the fetcher:

```ts
export const adminUser = Resource(
  ({
    store,
    signal,
    params,
  }: FetcherArgs<{ id: number; asToken?: string }>) => {
    const token = params.asToken ?? store.session?.accessToken;
    return ky
      .get(`/api/users/${params.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      })
      .json<User>();
  },
);
```

The per-params cache treats `asToken` as part of the key, so impersonation calls don't collide with the ambient session's slot.

## Limitations

- **Single ambient session per Boundary.** Multi-tenant cases where one screen needs to authenticate against two different backends are handled by either explicit per-call overrides (as above) or by nested Boundaries with distinct Stores.
- **SSR needs per-request Boundaries.** On the server each request must get its own Boundary with a fresh Store containing that request's session. The module-augmented `Store` type is shared but the _value_ must not be.
- **Refresh-during-await isn't free.** If a request fires, the token expires mid-flight, and a parallel refresh races in, the original request's `Authorization` is already on the wire and may 401. The `afterResponse` retry handles this, but the user-visible latency is two round-trips.
