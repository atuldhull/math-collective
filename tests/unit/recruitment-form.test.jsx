// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http", () => ({ default: { post: vi.fn() } }));
import http from "@/lib/http";
import RecruitmentPage from "../../frontend/src/features/recruitment/RecruitmentPage.jsx";

const categories = [
  [1, null, "first-year", "Personal email", "student@example.com"],
  [2, "Normal", "normal", "BMSIT email", "student@bmsit.in"],
  [2, "Lateral", "lateral", "Personal email", "student@example.com"],
  [3, "Normal", "normal", "BMSIT email", "student@bmsit.in"],
  [3, "Lateral", "lateral", "Personal email", "student@example.com"],
];

function renderForm() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RecruitmentPage />} />
        <Route path="/signup" element={<p>Account signup</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function selectCategory(year, entry) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`${year === 1 ? "1st" : year === 2 ? "2nd" : "3rd"} Year`) }));
  if (entry) fireEvent.click(screen.getByRole("button", { name: entry, exact: true }));
}

function fillDetails(email) {
  fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Test Student" } });
  fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/USN/i), { target: { value: "24UG1BYAI038" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Branch/i }), { target: { value: "MECH" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Section/i }), { target: { value: "15" } });
  fireEvent.click(screen.getByRole("button", { name: /Event Design/ }));
  fireEvent.click(screen.getByRole("button", { name: /Technology & Systems/ }));
}

beforeEach(() => {
  http.post.mockReset();
  http.post.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe("recruitment form", () => {
  it.each(categories)("submits category %i %s with its required email (%s)", async (year, entry, type, label, email) => {
    renderForm();
    selectCategory(year, entry);
    expect(screen.getByLabelText(new RegExp(label, "i"))).toBeInTheDocument();
    fillDetails(email);
    const submit = screen.getByRole("button", { name: /Submit registration/i });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read and agree/i }));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    expect(http.post).toHaveBeenCalledWith("/recruitment", expect.objectContaining({
      year, student_type: type, email, usn: "24UG1BYAI038",
      branch: "MECH", section: "15",
      first_preference: "Event Design", second_preference: "Technology & Systems", rules_accepted: true,
    }));
    expect(await screen.findByText(/Your recruitment registration has been submitted/i)).toBeInTheDocument();
  });

  it.each([2, 3])("rejects a non-BMSIT email for %i Year Normal", (year) => {
    renderForm();
    selectCategory(year, "Normal");
    fillDetails("student@gmail.com");
    fireEvent.blur(screen.getByLabelText(/BMSIT email/i));
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read and agree/i }));
    expect(screen.getByText(/Use your BMSIT email ending in @bmsit.in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit registration/i })).toBeDisabled();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("offers only the approved branches and sections and requires both selections", () => {
    renderForm();
    selectCategory(1);
    const branch = screen.getByRole("combobox", { name: /Branch/i });
    const section = screen.getByRole("combobox", { name: /Section/i });
    expect(branch).toBeRequired();
    expect(section).toBeRequired();
    expect(branch).toHaveValue("");
    expect(section).toHaveValue("");
    expect(Array.from(branch.options, (option) => option.textContent)).toEqual([
      "Select your branch", "CSE", "AIML", "CIVIL", "ECE", "EEE", "CSBS", "MECH",
    ]);
    expect(Array.from(section.options, (option) => option.textContent)).toEqual([
      "Select your section", ...Array.from({ length: 15 }, (_, index) => String(index + 1)),
    ]);
    expect(screen.getByText("Select your official branch as shown on your college record.")).toBeInTheDocument();
    expect(screen.getByText("Select your official section as shown on your college record.")).toBeInTheDocument();
    fireEvent.blur(branch);
    fireEvent.blur(section);
    expect(screen.getByText("Select your branch.")).toBeInTheDocument();
    expect(screen.getByText("Select your section.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit registration/i })).toBeDisabled();
  });

  it("enforces exactly two ordered preferences and promotes the remaining choice", () => {
    renderForm();
    selectCategory(1);
    expect(screen.getByRole("heading", { name: "Choose two domains" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Recruitment domain preferences" })).toBeInTheDocument();
    expect(screen.getByText("Designing and sketching events from scratch.")).toBeInTheDocument();
    expect(screen.getByText("Promoting the club and creating content for social media.")).toBeInTheDocument();
    expect(screen.getByText("Communicating with people and reaching out to potential sponsors.")).toBeInTheDocument();
    expect(screen.getByText("Building and managing the technology and systems used by the club.")).toBeInTheDocument();
    expect(screen.getByText("Using mathematics and data to plan and improve club activities.")).toBeInTheDocument();
    const event = screen.getByRole("button", { name: /Event Design/ });
    const design = screen.getByRole("button", { name: /Marketing & Social Media/ });
    const quantitative = screen.getByRole("button", { name: /Quantitative Strategy/ });
    fireEvent.click(event);
    fireEvent.click(design);
    expect(event).toHaveAttribute("aria-pressed", "true");
    expect(design).toHaveTextContent("2nd");
    expect(quantitative).toBeDisabled();
    fireEvent.click(quantitative);
    expect(screen.getByText(/2nd: Marketing & Social Media/)).toBeInTheDocument();
    fireEvent.click(event);
    expect(design).toHaveTextContent("1st");
    expect(quantitative).toBeEnabled();
    fireEvent.click(quantitative);
    expect(quantitative).toHaveTextContent("2nd");
    expect(screen.getByText(/1st: Marketing & Social Media/)).toBeInTheDocument();
    expect(screen.getByText(/2nd: Quantitative Strategy/)).toBeInTheDocument();
  });

  it("keeps entered fields when the year/type selection changes", () => {
    renderForm();
    selectCategory(2, "Normal");
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Kept Name" } });
    selectCategory(3, "Lateral");
    expect(screen.getByLabelText(/Full name/i)).toHaveValue("Kept Name");
    expect(screen.getByLabelText(/Personal email/i)).toBeInTheDocument();
    selectCategory(2, "Normal");
    expect(screen.getByLabelText(/Full name/i)).toHaveValue("Kept Name");
    expect(screen.getByLabelText(/BMSIT email/i)).toBeInTheDocument();
  });

  it("shows field errors and requires explicit rules acceptance", () => {
    renderForm();
    selectCategory(1);
    fillDetails("bad-email");
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText(/USN/i), { target: { value: "x" } });
    fireEvent.blur(screen.getByLabelText(/Phone number/i));
    fireEvent.blur(screen.getByLabelText(/Personal email/i));
    fireEvent.blur(screen.getByLabelText(/USN/i));
    expect(screen.getByText(/10–15 digits/)).toBeInTheDocument();
    expect(screen.getByText(/Enter a valid email address/)).toBeInTheDocument();
    expect(screen.getByText(/6–20 letters or numbers/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit registration/i })).toBeDisabled();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("preserves entries on failure and allows a retry", async () => {
    http.post.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: {} });
    renderForm();
    selectCategory(1);
    fillDetails("student@example.com");
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read and agree/i }));
    fireEvent.click(screen.getByRole("button", { name: /Submit registration/i }));
    expect(await screen.findByText(/Could not submit right now/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/i)).toHaveValue("Test Student");
    expect(screen.getByRole("button", { name: /Submit registration/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Submit registration/i }));
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Your recruitment registration has been submitted/i)).toBeInTheDocument();
  });

  it("sends only one request on repeated Submit clicks while pending", async () => {
    let resolveRequest;
    http.post.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    const { container } = renderForm();
    selectCategory(1);
    fillDetails("student@example.com");
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read and agree/i }));
    const form = container.querySelector("form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Submitting your application/i })).toBeDisabled();
    await act(async () => resolveRequest({ data: {} }));
    expect(screen.getByText(/Your recruitment registration has been submitted/i)).toBeInTheDocument();
    expect(http.post).toHaveBeenCalledTimes(1);
  });
});
