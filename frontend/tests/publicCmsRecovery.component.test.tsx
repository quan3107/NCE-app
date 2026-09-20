/**
 * Location: tests/publicCmsRecovery.component.test.tsx
 * Purpose: Exercise CMS error-to-retry transitions through the real query hooks.
 * Why: Public recovery must refetch without a reload or duplicate pending request.
 */
import assert from "node:assert/strict";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, test, vi } from "vitest";
import { AboutRoute } from "../src/routes/About";
import { ContactRoute } from "../src/routes/Contact";
import { HomeRoute } from "../src/routes/Home";

vi.mock("@lib/router", () => ({ useRouter: () => ({ navigate: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const cases = [
  {
    Route: AboutRoute,
    page: "about page",
    endpoint: "about-page-content",
    content: {
      hero: { title: "Recovered About", description: "Published copy" },
      values: [],
      story: { sections: [] },
    },
    heading: "Recovered About",
  },
  {
    Route: ContactRoute,
    page: "contact page",
    endpoint: "contact-page-content",
    content: {
      header: { title: "Recovered Contact", description: "Published copy" },
      form: {
        title: "Message us",
        description: "Ask a question",
        submitLabel: "Send",
      },
      details: { email: "test@example.test", phone: "123", address: "Test" },
      hours: [],
    },
    heading: "Recovered Contact",
  },
  {
    Route: HomeRoute,
    page: "homepage",
    endpoint: "homepage-content",
    content: {
      hero: {
        title: "Recovered Home",
        description: "Published copy",
        badge: "Test",
        cta_primary: "Courses",
        cta_secondary: "Login",
      },
      stats: [],
      howItWorks: { title: "How it works", description: "Test", features: [] },
    },
    heading: "Recovered Home",
  },
];

for (const { Route, page, endpoint, content, heading } of cases) {
  test(`${page} retries a failed CMS query and replaces the error with published content`, async () => {
    let finish: ((response: Response) => void) | undefined;
    let requests = 0;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        if (!String(input).includes(`/cms/${endpoint}`)) {
          return Response.json([]);
        }
        requests += 1;
        if (requests === 1) throw new TypeError("Network unavailable");
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <Route />
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", {
      name: `Unable to load ${page} content.`,
    });
    assert.ok(screen.queryByRole("heading", { name: heading }) === null);
    assert.ok(screen.queryByRole("button", { name: "Send" }) === null);
    fireEvent.click(screen.getByRole("button", { name: "Retry", exact: true }));
    await waitFor(() => assert.equal(requests, 2));
    // React Query returns to initial loading without exposing stale success or
    // an enabled second retry while the authoritative replacement is pending.
    await screen.findByText(`Loading ${page} content...`);
    assert.ok(
      screen.queryByRole("button", { name: "Retry", exact: true }) === null,
    );
    assert.ok(finish);
    finish(Response.json(content));
    await screen.findByRole("heading", { name: heading });
    assert.ok(screen.queryByText(`Unable to load ${page} content.`) === null);
    assert.equal(requests, 2);
    const cmsCalls = fetchSpy.mock.calls.filter(([input]) =>
      String(input).includes(`/cms/${endpoint}`),
    );
    assert.ok(
      cmsCalls.every(
        ([, init]) => !new Headers(init?.headers).has("Authorization"),
      ),
    );
    client.clear();
  });
}
