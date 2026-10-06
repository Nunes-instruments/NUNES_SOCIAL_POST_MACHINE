import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function key() {
  const secret = process.env.OAUTH_SESSION_SECRET || "";
  if (!secret) throw new Error("OAUTH_SESSION_SECRET is required");
  return crypto.createHash("sha256").update(secret).digest();
}

export function cookieName(platform) {
  return `nunes_oauth_${String(platform).toLowerCase()}`;
}

export function configCookieName(platform) {
  return `nunes_cfg_${String(platform).toLowerCase()}`;
}

export function readConfig(jar, platform) {
  return unseal(jar.get(configCookieName(platform))?.value);
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30
};

export function seal(value) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64url");
}

export function unseal(token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + 16);
    const data = raw.subarray(IV_LEN + 16);
    const decipher = crypto.createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(out);
  } catch {
    return null;
  }
}
