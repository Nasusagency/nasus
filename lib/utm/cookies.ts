const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

const COOKIE_DURATION_DAYS = 30;
const COOKIE_DOMAIN = "nasus.lat";

interface UTMData {
  [key: string]: string;
}

function getCookieExpiration(): Date {
  const date = new Date();
  date.setDate(date.getDate() + COOKIE_DURATION_DAYS);
  return date;
}

function getCookieString(value: string, isProduction: boolean): string {
  const expires = getCookieExpiration().toUTCString();
  let cookie = `${value}; expires=${expires}; path=/; SameSite=Lax`;

  if (isProduction) {
    cookie += `; Secure; Domain=${COOKIE_DOMAIN}`;
  }

  return cookie;
}

export function saveUTMsToCookies(params: URLSearchParams): void {
  const isProduction = typeof window !== "undefined" && window.location.hostname === COOKIE_DOMAIN;

  UTM_PARAMS.forEach((param) => {
    const value = params.get(param);
    if (value) {
      document.cookie = `${param}=${encodeURIComponent(value)}; ${getCookieString("", isProduction).slice(0, -2)}expires=${getCookieExpiration().toUTCString()}; path=/; SameSite=Lax${isProduction ? `; Secure; Domain=${COOKIE_DOMAIN}` : ""}`;
    }
  });
}

export function readUTMsFromCookies(): UTMData {
  const utmData: UTMData = {};

  UTM_PARAMS.forEach((param) => {
    const value = getCookieValue(param);
    if (value) {
      utmData[param] = value;
    }
  });

  return utmData;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;

  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(nameEQ)) {
      return decodeURIComponent(trimmed.substring(nameEQ.length));
    }
  }

  return null;
}

export function clearUTMCookies(): void {
  const isProduction = typeof window !== "undefined" && window.location.hostname === COOKIE_DOMAIN;

  UTM_PARAMS.forEach((param) => {
    const expires = new Date(0).toUTCString();
    let cookie = `${param}=; expires=${expires}; path=/`;

    if (isProduction) {
      cookie += `; Domain=${COOKIE_DOMAIN}`;
    }

    document.cookie = cookie;
  });
}
