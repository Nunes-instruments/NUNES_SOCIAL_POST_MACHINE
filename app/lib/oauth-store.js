import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

export const BROWSER_KEY_COOKIE = "nunes_secure_key";

function keyFromSecret(secret) {
  if (!secret) throw new Error("Encryption key is required");
  return crypto.createHash("sha256").update(secret).digest();
}

export function createBrowserSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

export function secretFromJar(jar) {
  return jar.get(BROWSER_KEY_COOKIE)?.value || process.env.OAUTH_SESSION_SECRET || null;
}

export function cookieName(platform) {
  return `nunes_oauth_${String(platform).toLowerCase()}`;
}

export function configCookieName(platform) {
  return `nunes_cfg_${String(platform).toLowerCase()}`;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 180
};

export const KEY_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 60 * 60 * 24 * 365
};

export function seal(value, secret) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, keyFromSecret(secret), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64url");
}

export function unseal(token, secret) {
  if (!token || !secret) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + 16);
    const data = raw.subarray(IV_LEN + 16);
    const decipher = crypto.createDecipheriv(ALGO, keyFromSecret(secret), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(out);
  } catch {
    return null;
  }
}

export function readConfig(jar, platform) {
  const secret = secretFromJar(jar);
  return unseal(jar.get(configCookieName(platform))?.value, secret);
}
