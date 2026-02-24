# Using ky for HTTP requests

[ky](https://github.com/sindresorhus/ky) is a lightweight HTTP client built on `fetch` with a cleaner API, automatic retries, and better error handling. It pairs well with Chizu actions for data fetching.

## Basic usage

Here's a simple example that fetches user data:

```ts
import { useActions, Lifecycle, Action, Operation } from "chizu";
import ky from "ky";

type User = { id: number; name: string; email: string };

type Model = {
  user: User | null;
};

export class Actions {
  static FetchUser = Action<number>("FetchUser");
}

const model: Model = {
  user: null,
};

export function useUserActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.FetchUser, async (context, userId) => {
    context.actions.produce(({ model, inspect }) => {
      model.user = inspect.annotate(Operation.Pending, model.user);
    });

    const user = await ky.get(`/api/users/${userId}`).json<User>();

    context.actions.produce(({ model }) => {
      model.user = user;
    });
  });

  return actions;
}
```

## Request cancellation

Chizu provides an `AbortController` via `context.task.controller` that you can pass to ky. This enables automatic cancellation when the component unmounts or when a newer request supplants the current one:

```ts
actions.useAction(Actions.FetchUser, async (context, userId) => {
  context.actions.produce(({ model, inspect }) => {
    model.user = inspect.annotate(Operation.Pending, model.user);
  });

  const user = await ky
    .get(`/api/users/${userId}`, {
      signal: context.task.controller.signal,
    })
    .json<User>();

  context.actions.produce(({ model }) => {
    model.user = user;
  });
});
```

## Creating a configured instance

For applications with shared configuration (base URL, headers, auth), create a ky instance and access it via `context.data`:

```ts
import { useActions, Lifecycle, Action } from "chizu";
import ky, { type KyInstance } from "ky";

type User = { id: number; name: string; email: string };

type Model = {
  user: User | null;
};

type Data = {
  api: KyInstance;
};

export class Actions {
  static FetchUser = Action<number>("FetchUser");
}

const model: Model = {
  user: null,
};

export function useUserActions(authToken: string) {
  const api = ky.create({
    prefixUrl: "https://api.example.com",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    retry: {
      limit: 3,
      methods: ["get"],
      statusCodes: [408, 429, 500, 502, 503, 504],
    },
    timeout: 30_000,
  });

  const actions = useActions<Model, typeof Actions, Data>(model, () => ({
    api,
  }));

  actions.useAction(Actions.FetchUser, async (context, userId) => {
    const user = await context.data.api
      .get(`users/${userId}`, {
        signal: context.task.controller.signal,
      })
      .json<User>();

    context.actions.produce(({ model }) => {
      model.user = user;
    });
  });

  return actions;
}
```

> **Note:** By passing the ky instance through `context.data`, you ensure that handlers always access the latest configuration, even if props like `authToken` change after an `await`.

## Error handling with HTTPError

ky throws an `HTTPError` for non-2xx responses, which integrates with Chizu's error handling:

```ts
import ky, { HTTPError } from "ky";

actions.useAction(Actions.FetchUser, async (context, userId) => {
  context.actions.produce(({ model, inspect }) => {
    model.user = inspect.annotate(Operation.Pending, model.user);
    model.error = null;
  });

  try {
    const user = await ky
      .get(`/api/users/${userId}`, {
        signal: context.task.controller.signal,
      })
      .json<User>();

    context.actions.produce(({ model }) => {
      model.user = user;
    });
  } catch (error) {
    if (error instanceof HTTPError) {
      const body = await error.response.json<{ message: string }>();
      context.actions.produce(({ model }) => {
        model.error = body.message;
      });
    } else {
      throw error; // Re-throw non-HTTP errors for Lifecycle.Error()
    }
  }
});
```

## Hooks for request/response

ky supports hooks for cross-cutting concerns like logging or token refresh:

```ts
const api = ky.create({
  prefixUrl: "https://api.example.com",
  hooks: {
    beforeRequest: [
      (request) => {
        console.log(`→ ${request.method} ${request.url}`);
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          // Refresh token and retry
          const token = await refreshToken();
          request.headers.set("Authorization", `Bearer ${token}`);
          return ky(request);
        }
      },
    ],
  },
});
```

Key patterns demonstrated:

- **Abort signal integration** &ndash; Pass `context.task.controller.signal` to ky for automatic request cancellation on unmount or supplantation.
- **Configured instances via data** &ndash; Use `context.data` to access a pre-configured ky instance with shared settings.
- **Typed responses** &ndash; Use `.json<T>()` for type-safe response parsing.
- **Granular error handling** &ndash; Catch `HTTPError` to handle API errors while letting other errors bubble to `Lifecycle.Error()`.
