const BASE_URL = "https://verification.didit.me/v3";

export async function diditPost(
  endpoint: string,
  body: FormData
): Promise<Response> {
  const key = process.env.DIDIT_API_KEY;
  if (!key) throw new Error("DIDIT_API_KEY no está configurada");

  return fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "x-api-key": key },
    body,
  });
}
