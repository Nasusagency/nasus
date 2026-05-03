export const ADMIN_COOKIE = "nasus_admin";
const TOKEN_TTL_SEC = 86400 * 7; // 7 days

// Pure Web Crypto — works in Edge Runtime and Node.js alike

function encodeB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function decodeB64url(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.ADMIN_JWT_SECRET ?? "dev-secret-change-in-prod";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signAdminToken(): Promise<string> {
  const enc = new TextEncoder();
  const header = encodeB64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = encodeB64url(
    enc.encode(
      JSON.stringify({
        sub: "admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
      })
    )
  );
  const signing = `${header}.${payload}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signing));
  return `${signing}.${encodeB64url(sig)}`;
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [header, payload, sig] = parts;
    const key = await getKey();
    const signing = `${header}.${payload}`;
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeB64url(sig),
      new TextEncoder().encode(signing)
    );
    if (!valid) return false;
    const data = JSON.parse(new TextDecoder().decode(new Uint8Array(decodeB64url(payload)))) as { exp: number };
    return data.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
