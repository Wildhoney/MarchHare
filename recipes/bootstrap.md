# Bootstrapping

Most apps need to do something asynchronous before the main UI is safe to render &mdash; fetch the signed-in user, load feature flags, hydrate persisted state, open an SSE connection. Keep that work in **one** place and let the rest of the tree gate first paint on a signal that already exists.

The rule of thumb: **gate first paint on the Env, or on a Resource's model annotation &mdash; never invent a dedicated `Booted` broadcast**. Both Env and annotations already encode "boot in progress / boot complete"; a separate event is a third copy of the same fact and splits subscribers across two channels.

Pick by what the rest of the app reads next:

- **Env-driven** &mdash; reach for it when the post-boot UI keeps reading something on the Env (`env.session`, `env.locale`, a feature-flag map). Add a `phase` field and let it ride the channel you already need.
- **Annotation-driven** &mdash; reach for it when boot's job is to populate one specific model field (`model.user`, `model.flags`) via a [Resource](./use-resource.md). The Resource's [annotation](./model-annotations.md) already encodes "still loading", so use that.

## Option A: Env-driven

Declare a `phase` slot on `App({ env })`. Bootstrap runs in a top-level `Lifecycle.Mount` handler, dispatches the necessary fetches, and flips the phase. Downstream code renders against `Lifecycle.Env`.

```ts
// app.ts
import { App } from "march-hare";
import type { Session } from "./auth/types";

export const app = App({
  env: {
    session: null as Session | null,
    phase: "booting" as "booting" | "ready",
  },
});
```

```tsx
// boot/types.ts
import { Lifecycle } from "march-hare";

export class Actions {
  static Mount = Lifecycle.Mount();
}
```

```tsx
// boot/actions.ts
import { app } from "../app";
import { Actions } from "./types";
import * as resource from "../resources";

export function useBootActions() {
  const context = app.useContext<void, typeof Actions>();
  const actions = context.useActions();

  actions.useAction(Actions.Mount, async (context) => {
    if (context.env.session !== null) {
      await Promise.all([
        context.actions.resource(resource.me()).exceeds({ minutes: 5 }),
        context.actions.resource(resource.featureFlags()).exceeds({ hours: 1 }),
      ]);
    }
    context.actions.produce(({ env }) => void (env.phase = "ready"));
  });

  return actions;
}
```

```tsx
// boot/index.tsx
import { Lifecycle } from "march-hare";
import { app } from "../app";
import { useBootActions } from "./actions";
import { Root } from "../root";
import { Splash } from "./splash";

export function Boot() {
  const actions = useBootActions();

  return actions.stream(Lifecycle.Env, (env) =>
    env.phase === "ready" ? <Root /> : <Splash />,
  );
}
```

Mount `<Boot />` once inside `<app.Boundary>`. The prefetches use `.exceeds(...)` so the Resource cache is warm by the time real features call the same Resources &mdash; no second fetch on the actual mount.

## Option B: Annotation-driven

When boot's whole job is to fetch one record, don't add a `phase` slot &mdash; annotate the model field instead. The Resource's pending annotation _is_ the signal.

```ts
// root/types.ts
import { Lifecycle } from "march-hare";

type Model = { user: User | null };

export class Actions {
  static Mount = Lifecycle.Mount();
}
```

```ts
// root/actions.ts
import { app } from "../app";
import { Actions } from "./types";
import * as resource from "../resources";

const model: Model = { user: null };

export function useRootActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.Mount, async (context) => {
    context.actions.produce(
      ({ model }) => void (model.user = context.actions.annotate(model.user)),
    );
    const user = await context.actions.resource(resource.me());
    context.actions.produce(({ model }) => void (model.user = user));
  });

  return actions;
}
```

```tsx
// root/index.tsx
import { useRootActions } from "./actions";
import { Splash } from "../boot/splash";
import { App } from "../app/view";

export function Root() {
  const [model, actions] = useRootActions();

  if (actions.inspect.user.pending()) return <Splash />;
  if (model.user === null) return <SignIn />;

  return <App user={model.user} />;
}
```

`actions.inspect.user.pending()` is `true` until the fetch resolves; `actions.inspect.user.draft()` returns the latest annotated value if you want to render a stale-while-revalidate snapshot. Refreshing the same field later re-uses the same annotation channel &mdash; the splash logic generalises to every subsequent reload of `me()`.

## Hydrating the initial Env from persistent storage

Bootstrap often starts with reading a stored session so the very first render already has the right token. Do this _synchronously_ before `App()`, so `<app.Boundary>` mounts with the correct initial Env and `Lifecycle.Env`'s seed value is right from the first frame:

```ts
// app.ts
import { App, Cache, utils } from "march-hare";
import type { Session } from "./auth/types";

const sessionCache = Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  keys: () => Object.keys(localStorage),
});

const stored = sessionCache.get<Session>("session");
const session = stored.data === utils.unset ? null : stored.data;

export const app = App({
  env: {
    session,
    phase: "booting" as "booting" | "ready",
  },
  cache: sessionCache,
});
```

The `unset` sentinel distinguishes "nothing was ever stored" from "an explicit null was stored" &mdash; collapse both to `null` for the Env unless that distinction matters to your sign-in flow. See the [storage recipe](./storage.md) for adapters (`react-native-mmkv`, `chrome.storage`, async-backend facades) and the full sentinel semantics.

Truly asynchronous storage (IndexedDB, `chrome.storage.local`) cannot run before `App()` in this synchronous form. Render a tiny pre-boot component that does the async read, then mounts `<app.Boundary>` once the value is available &mdash; or use the storage recipe's sync-facade pattern.

## When to reach for which

| Question                                                | Pick                                                                                                                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does boot fetch _one_ record the app will render on?    | **Annotation.** The Resource already carries the pending signal.                                                                                                                                           |
| Does boot fetch _several_ unrelated payloads?           | **Env phase.** A single `phase: "ready"` flip is cleaner than juggling N annotations across N model slots.                                                                                                 |
| Does the app coordinate later through Env anyway?       | **Env phase.** You already need `Lifecycle.Env` subscribers for `session` / `locale` &mdash; let phase ride the same channel.                                                                              |
| Boot is purely "open a connection" (SSE/WebSocket)?     | **Env phase.** There's no Resource result to annotate; flip `phase` once the connection is open. See [real-time applications](./real-time-applications.md) for the connection-lifetime side.               |
| Boot can fail and the failure should sign the user out? | Either pattern works. Reach for [`Lifecycle.Fault`](./error-handling.md) on the boot handler to centralise the redirect &mdash; the choice between Env and annotation is independent of error containment. |

## What not to do

- **Don't introduce `Actions.Broadcast.Booted`.** It duplicates the signal that Env phase or the annotation already carries, and creates two places downstream code can subscribe to the same fact &mdash; drift risk for no upside.
- **Don't write boot logic in `Lifecycle.Mount` on multiple features.** Centralise it in one `Boot` / `Root` component. Features that need post-boot data should consume from the warmed Resource cache (`.exceeds(...)` returns instantly when fresh) rather than re-implementing the readiness check.
- **Don't gate paint on `model.user !== null` when "no user" is a valid signed-out state.** That's the difference between Option B and "is the user signed in?" &mdash; annotation pending distinguishes loading from settled; the value itself distinguishes signed-in from signed-out.
- **Don't await boot work outside React (`top-level await` in `app.ts`).** It blocks the bundle from rendering anything, including the splash. Keep the async work inside `Lifecycle.Mount` so the splash paints immediately and the user sees motion.
