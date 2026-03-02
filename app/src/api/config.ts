// app/src/api/config.ts

export const BASE_URL = "https://med.apoteka24.me";

// Если где-то в коде ждут API_BASE_URL — тоже дадим
export const API_BASE_URL = BASE_URL;

// удобная функция (не обязательно, но полезно)
export function apiUrl(path: string) {
  if (!path.startsWith("/")) path = "/" + path;
  return `${BASE_URL}${path}`;
}

