/**
 * The Cloudinary layer that replaced disk-based gallery uploads.
 *
 * Uploads used to be written to backend/public/images — a directory the
 * server never served, on a filesystem Render wipes every deploy. So an
 * admin's photo was unreachable AND temporary, failing silently twice.
 *
 * These cover the parts that are pure logic. The network calls are
 * exercised by a real round trip during development rather than mocked
 * here, because a mocked HTTP client mostly tests the mock.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isConfigured, __testing } from "../../backend/lib/cloudinary.js";

const { sign, folderFor, FOLDER_ROOT } = __testing;
const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
});
afterEach(() => { process.env = { ...ORIGINAL }; });

describe("isConfigured", () => {
  it("is false when nothing is set, so callers can fall back", () => {
    expect(isConfigured()).toBe(false);
  });

  it("needs all three values, not just some", () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    expect(isConfigured()).toBe(false);
    process.env.CLOUDINARY_API_KEY = "123";
    expect(isConfigured()).toBe(false);
    process.env.CLOUDINARY_API_SECRET = "shh";
    expect(isConfigured()).toBe(true);
  });
});

describe("sign", () => {
  it("is a 40-character SHA-1 hex digest", () => {
    expect(sign({ timestamp: 1, folder: "a" }, "secret")).toMatch(/^[0-9a-f]{40}$/);
  });

  it("is stable for the same input", () => {
    const a = sign({ timestamp: 1700000000, folder: "math-collective/x" }, "s3cret");
    const b = sign({ timestamp: 1700000000, folder: "math-collective/x" }, "s3cret");
    expect(a).toBe(b);
  });

  it("does not depend on key order — Cloudinary sorts before signing", () => {
    const a = sign({ timestamp: 5, folder: "f" }, "s");
    const b = sign({ folder: "f", timestamp: 5 }, "s");
    expect(a).toBe(b);
  });

  it("changes when any parameter changes", () => {
    const base = sign({ timestamp: 5, folder: "f" }, "s");
    expect(sign({ timestamp: 6, folder: "f" }, "s")).not.toBe(base);
    expect(sign({ timestamp: 5, folder: "g" }, "s")).not.toBe(base);
    expect(sign({ timestamp: 5, folder: "f" }, "other")).not.toBe(base);
  });

  it("skips empty values, which Cloudinary excludes from the signature", () => {
    expect(sign({ timestamp: 5, folder: "" }, "s")).toBe(sign({ timestamp: 5 }, "s"));
    expect(sign({ timestamp: 5, folder: undefined }, "s")).toBe(sign({ timestamp: 5 }, "s"));
  });
});

describe("folderFor", () => {
  it("keeps every upload inside one namespace", () => {
    expect(folderFor("events")).toBe(`${FOLDER_ROOT}/events`);
  });

  it("falls back to general with no category", () => {
    expect(folderFor()).toBe(`${FOLDER_ROOT}/general`);
    expect(folderFor("")).toBe(`${FOLDER_ROOT}/general`);
  });

  it("strips anything that could escape the namespace", () => {
    // A category is user input from a query string. Without stripping,
    // "../../other-account-folder" would place uploads outside our
    // namespace — which is also what the delete guard checks against.
    expect(folderFor("../../escape")).toBe(`${FOLDER_ROOT}/escape`);
    expect(folderFor("a/b/c")).toBe(`${FOLDER_ROOT}/abc`);
    expect(folderFor("Inauguration!")).toBe(`${FOLDER_ROOT}/inauguration`);
  });

  it("turns spaces into hyphens so album titles keep their words", () => {
    // Stripping before converting whitespace collapsed "Tech Fest" to
    // "techfest", which the gallery then displayed as one run-together
    // word. A mangled regex here once replaced literal "s" characters
    // instead of whitespace, producing "techfe-t".
    expect(folderFor("Tech Fest")).toBe(`${FOLDER_ROOT}/tech-fest`);
    expect(folderFor("Inauguration 2026!")).toBe(`${FOLDER_ROOT}/inauguration-2026`);
    expect(folderFor("  Treasure   Hunt  ")).toBe(`${FOLDER_ROOT}/treasure-hunt`);
  });

  it("never leaves a leading or trailing hyphen", () => {
    expect(folderFor(" - Events - ")).toBe(`${FOLDER_ROOT}/events`);
  });

  it("caps an absurdly long category", () => {
    const long = folderFor("x".repeat(500));
    expect(long.length).toBeLessThan(FOLDER_ROOT.length + 45);
  });

  it("falls back rather than producing a trailing slash for junk input", () => {
    expect(folderFor("!!!")).toBe(`${FOLDER_ROOT}/general`);
  });
});
