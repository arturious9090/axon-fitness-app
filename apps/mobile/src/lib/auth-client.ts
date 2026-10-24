import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : "http://localhost:3000");
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins:
    Platform.OS === "web"
      ? []
      : [
          expoClient({
            scheme: "axonfitness",
            storagePrefix: "axonfitness",
            storage: SecureStore,
          }),
        ],
});
export async function api(path: string, options: RequestInit = {}) {
  const cookie = Platform.OS === "web" ? "" : await authClient.getCookie();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
  });
  if (!response.ok)
    throw new Error(
      response.status === 401 ? "AUTH_EXPIRED" : `API_${response.status}`,
    );
  return response.json();
}
