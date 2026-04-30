import ky from "ky";

export type Cat = {
  id: string;
  url: string;
  width: number;
  height: number;
};

export class HttpError extends Error {
  override name = "HttpError";
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`HTTP ${status} ${url}`);
  }
}

export class RateLimitedError extends HttpError {
  override name = "RateLimitedError";
  retryAfter: number;
  constructor(url: string, retryAfter: number) {
    super(429, url);
    this.retryAfter = retryAfter;
  }
}

const http = ky.create({
  prefix: "https://api.thecatapi.com/v1/",
  timeout: 10_000,
  retry: {
    limit: 2,
    statusCodes: [429, 503],
    methods: ["get"],
  },
  hooks: {
    afterResponse: [
      ({ request, response }) => {
        if (response.ok) return response;
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
          throw new RateLimitedError(request.url, retryAfter);
        }
        throw new HttpError(response.status, request.url);
      },
    ],
  },
});

export async function fetchCat(): Promise<Cat> {
  const cats = await http.get("images/search").json<Cat[]>();
  if (cats.length === 0) throw new HttpError(404, "images/search");
  return cats[0];
}
