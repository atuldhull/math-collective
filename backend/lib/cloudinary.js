/**
 * lib/cloudinary.js — image hosting that survives a deploy.
 *
 * Gallery uploads used to be written to `backend/public/images`. Two
 * things were wrong with that:
 *
 *   1. Render's filesystem is ephemeral. Every deploy wipes it, so any
 *      photo an admin uploaded disappeared the next time the site
 *      shipped — silently, with no error anywhere.
 *   2. That directory was never served. Even before a deploy wiped it,
 *      the uploaded file was not reachable by any URL.
 *
 * Meanwhile the gallery page rendered a hardcoded list of Cloudinary
 * URLs that the API knew nothing about. So there were two gallery
 * systems, and the working one could only be changed by editing source
 * and redeploying.
 *
 * This talks to Cloudinary's REST API with `fetch` rather than pulling
 * in the `cloudinary` SDK: the three calls we need (signed upload, list,
 * destroy) are a handful of lines each, and the signature is a plain
 * SHA-1 of the sorted parameters. Not worth a dependency.
 *
 * Configuration (all three required, else isConfigured() is false and
 * the callers fall back rather than crash):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import crypto from "node:crypto";
import { logger } from "../config/logger.js";

const FOLDER_ROOT = "math-collective";

function config() {
  return {
    cloud:  process.env.CLOUDINARY_CLOUD_NAME,
    key:    process.env.CLOUDINARY_API_KEY,
    secret: process.env.CLOUDINARY_API_SECRET,
  };
}

export function isConfigured() {
  const { cloud, key, secret } = config();
  return Boolean(cloud && key && secret);
}

/**
 * Cloudinary's signature: every parameter except file, api_key and
 * resource_type, sorted by key, joined as k=v&k=v, with the API secret
 * appended, then SHA-1 hexed.
 */
function sign(params, secret) {
  const canonical = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(canonical + secret).digest("hex");
}

function basicAuth() {
  const { key, secret } = config();
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

/** Keep uploads inside one namespace so the club's other assets are untouched. */
function folderFor(category) {
  const slug = String(category || "general")
    .toLowerCase()
    .trim()
    // Spaces become hyphens BEFORE the strip, otherwise
    // "Inauguration 2026" collapses to "inauguration2026" and comes
    // back out as a run-together album title.
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "general";
  return `${FOLDER_ROOT}/${slug}`;
}

/**
 * Upload a buffer. Returns { url, publicId, width, height, format, bytes }.
 * Throws on failure so the caller's catchAsync turns it into a 500 with a
 * request id rather than a silent success.
 */
export async function uploadImage(buffer, { category, filename } = {}) {
  const { cloud, key, secret } = config();
  if (!isConfigured()) throw new Error("Cloudinary is not configured");

  const timestamp = Math.floor(Date.now() / 1000);
  const folder    = folderFor(category);
  const signed    = { folder, timestamp };
  const signature = sign(signed, secret);

  const form = new FormData();
  form.append("file", new Blob([buffer]), filename || "upload");
  form.append("api_key", key);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error({ status: res.status, detail: json?.error?.message }, "Cloudinary upload failed");
    throw new Error(json?.error?.message || `Cloudinary upload failed (${res.status})`);
  }

  return {
    url:      json.secure_url,
    publicId: json.public_id,
    width:    json.width,
    height:   json.height,
    format:   json.format,
    bytes:    json.bytes,
  };
}

/**
 * List everything under our namespace, grouped by the folder each asset
 * sits in — which is what the gallery calls a category.
 *
 * Paginates: Cloudinary caps a page at 500 and hands back a cursor.
 */
export async function listImages({ max = 500 } = {}) {
  const { cloud } = config();
  if (!isConfigured()) return [];

  const out = [];
  let cursor = null;

  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${cloud}/resources/image`);
    url.searchParams.set("type", "upload");
    url.searchParams.set("prefix", `${FOLDER_ROOT}/`);
    url.searchParams.set("max_results", String(Math.min(500, max)));
    if (cursor) url.searchParams.set("next_cursor", cursor);

    const res = await fetch(url, { headers: { Authorization: basicAuth() } });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Cloudinary list failed");
      break;
    }
    const json = await res.json();
    out.push(...(json.resources || []));
    cursor = json.next_cursor || null;
  } while (cursor && out.length < max);

  return out.map((r) => ({
    url:       r.secure_url,
    publicId:  r.public_id,
    // "math-collective/inauguration/abc123" -> "inauguration"
    category:  (r.public_id.split("/")[1] || "general"),
    width:     r.width,
    height:    r.height,
    format:    r.format,
    createdAt: r.created_at,
  }));
}

/** Permanently remove one asset by its public id. */
export async function destroyImage(publicId) {
  const { cloud, key, secret } = config();
  if (!isConfigured()) throw new Error("Cloudinary is not configured");

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ public_id: publicId, timestamp }, secret);

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", key);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
    method: "POST",
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.result && json.result !== "ok" && json.result !== "not found")) {
    throw new Error(json?.error?.message || `Cloudinary delete failed (${res.status})`);
  }
  return json.result;
}

export const __testing = { sign, folderFor, FOLDER_ROOT };
