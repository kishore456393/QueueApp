const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";

export function getApiUrl(path: string): string {
  if (!path.startsWith("/")) {
    return path;
  }
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}
