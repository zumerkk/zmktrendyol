/**
 * ZMK Trendyol — API Client
 * All requests go through Next.js rewrite → localhost:4000
 */

const API_BASE = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("zmk_token");
}

export function setToken(token: string) {
  localStorage.setItem("zmk_token", token);
}

export function clearToken() {
  localStorage.removeItem("zmk_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  const json = await res.json();
  // Our API wraps in { success, data } via interceptor
  return json.data !== undefined ? json.data : json;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
