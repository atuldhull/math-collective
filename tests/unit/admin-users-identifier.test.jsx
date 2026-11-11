// @vitest-environment jsdom
/**
 * The `students` table carries two keys: `id`, the row's own primary key,
 * and `user_id`, the auth user. Every admin route — role change, password
 * reset, delete — looks the target up by `user_id`.
 *
 * The page was sending `id`. The lookup found nothing, the server
 * answered "User not found" by design (it refuses to confirm whether a
 * user exists), and the role dropdown simply snapped back to its old
 * value. Three admin actions were dead and none of them looked broken.
 *
 * So what is pinned here is the identifier that goes out on the wire,
 * not the UI around it.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  users: vi.fn(),
  updateRole: vi.fn(),
  deleteUser: vi.fn(),
  resetPassword: vi.fn(),
  createUser: vi.fn(),
  activeUsers: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ admin: api }));

const { default: AdminUsersPage } = await import(
  "@/features/admin/pages/AdminUsersPage"
);

/* The two keys differ in production — that is the whole point. */
const ROW_PK = "63853838-a328-4ef8-92d2-8172a731bee5";
const AUTH_ID = "71b1eb0a-636b-4ed2-8211-e56baf7e96b6";

const PERSON = {
  id: ROW_PK,
  user_id: AUTH_ID,
  name: "Ada Lovelace",
  email: "ada@bmsit.in",
  role: "student",
  xp: 0,
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.users.mockResolvedValue({ data: { users: [PERSON], total: 1, page: 1 } });
  api.updateRole.mockResolvedValue({ data: { success: true } });
  api.deleteUser.mockResolvedValue({ data: { success: true } });
  api.activeUsers.mockResolvedValue({ data: [] });
});

afterEach(cleanup);

async function renderPage() {
  render(<MemoryRouter><AdminUsersPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
}

describe("admin user actions address the auth user, not the row id", () => {
  it("sends user_id when changing a role", async () => {
    await renderPage();

    fireEvent.change(screen.getByLabelText(/Role for Ada Lovelace/i), {
      target: { value: "admin" },
    });

    await waitFor(() => expect(api.updateRole).toHaveBeenCalled());
    expect(api.updateRole).toHaveBeenCalledWith(AUTH_ID, "admin");
    // The row's own primary key must never be what goes out.
    expect(api.updateRole).not.toHaveBeenCalledWith(ROW_PK, expect.anything());
  });

  it("sends user_id when deleting someone", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));
    await waitFor(() => expect(api.deleteUser).toHaveBeenCalled());
    expect(api.deleteUser).toHaveBeenCalledWith(AUTH_ID);
    expect(api.deleteUser).not.toHaveBeenCalledWith(ROW_PK);
  });
});
