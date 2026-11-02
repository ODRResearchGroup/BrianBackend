export async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  return response;
}
