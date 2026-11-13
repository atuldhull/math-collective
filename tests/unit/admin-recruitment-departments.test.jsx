// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ recruitment: vi.fn(), exportRecruitment: vi.fn() }));
vi.mock("@/lib/api", () => ({ admin: api }));
vi.mock("@/components/lamp", () => ({
  PageHeader: ({ title, actions }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
  StatTile: ({ label, value }) => (
    <div>
      {label}: {value}
    </div>
  ),
}));
import AdminRecruitmentPage from "../../frontend/src/features/admin/pages/AdminRecruitmentPage.jsx";

const rows = [
  {
    id: "1",
    year: 1,
    student_type: "first-year",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "9876543210",
    usn: "1BY26CS001",
    branch: "CSE",
    section: "1",
    first_preference: "Event Design",
    second_preference: "PR & Sponsorship",
    submitted_at: "2026-11-13T10:00:00Z",
  },
  {
    id: "2",
    year: 2,
    student_type: "normal",
    name: "Alan Turing",
    email: "alan@bmsit.in",
    phone: "9876543211",
    usn: "1BY25EC002",
    branch: "ECE",
    section: "2",
    first_preference: "Technology & Systems",
    second_preference: "Event Design",
    submitted_at: "2026-11-13T09:00:00Z",
  },
];

beforeEach(() => {
  api.recruitment.mockReset();
  api.recruitment.mockResolvedValue({
    data: {
      registrations: rows,
      summary: {
        total: 2,
        byYear: { "Year 1": 1, "Year 2": 1 },
        byBranch: { CSE: 1, ECE: 1 },
        byFirstPreference: { "Event Design": 1, "Technology & Systems": 1 },
      },
      tableReady: true,
    },
  });
});
afterEach(cleanup);

it("shows department counts and filters the list from cards and the dropdown", async () => {
  render(<AdminRecruitmentPage />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Registrations by department" })).toBeInTheDocument());

  expect(screen.getByRole("button", { name: /CSE: 1 registration/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /MECH: 0 registrations/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /CSE: 1 registration/i }));
  expect(screen.getByRole("combobox", { name: "Department" })).toHaveValue("CSE");
  expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Showing 1 of 2");
  expect(screen.getByRole("cell", { name: "Ada Lovelace" })).toBeInTheDocument();
  expect(screen.queryByRole("cell", { name: "Alan Turing" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "Department" }), { target: { value: "ECE" } });
  expect(screen.getByRole("cell", { name: "Alan Turing" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /ECE: 1 registration/i }));
  expect(screen.getByRole("combobox", { name: "Department" })).toHaveValue("all");
  expect(screen.getByRole("cell", { name: "Ada Lovelace" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "Alan Turing" })).toBeInTheDocument();
});
