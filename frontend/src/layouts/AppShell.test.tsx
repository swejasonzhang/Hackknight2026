import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { clearToken, setToken } from "../auth/token";
import { HintProvider } from "../components/Hint";
import { AppShell } from "./AppShell";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("AppShell", () => {
  beforeEach(() => {
    clearToken();
    setToken("valid");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url === "/api/health"
            ? json({ ok: true, db: "connected", uptime: 1 })
            : json({
                id: "u1",
                name: "Ada",
                email: "ada@example.com",
                createdAt: 1,
              }),
        ),
      ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("takes you to the landing page from the logo, on the rail and on the phone bar", async () => {
    render(
      <HintProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<p>dashboard</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </HintProvider>,
    );
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    const logos = screen.getAllByRole("link", { name: "Arc home page" });
    expect(logos).toHaveLength(2);
    for (const logo of logos) expect(logo).toHaveAttribute("href", "/");
  });

  it("leads to the account page from the account tag, on the rail and on the phone bar", async () => {
    render(
      <HintProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<p>dashboard</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </HintProvider>,
    );
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    const tags = await screen.findAllByRole("link", { name: "Account: Ada" });
    expect(tags).toHaveLength(2);
    for (const tag of tags) expect(tag).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});
