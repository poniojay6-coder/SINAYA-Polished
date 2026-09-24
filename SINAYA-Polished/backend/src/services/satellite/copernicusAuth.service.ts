import { env } from "../../config/env.js";

interface CopernicusTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export function isCopernicusConfigured(): boolean {
  return Boolean(
    env.copernicus.clientId &&
    env.copernicus.clientSecret
  );
}

export async function getCopernicusToken(): Promise<string> {
  if (!isCopernicusConfigured()) {
    throw new Error(
      "Copernicus client ID and client secret are not configured."
    );
  }

  const currentTime = Date.now();

  if (cachedToken && currentTime < tokenExpiresAt) {
    return cachedToken;
  }

  const requestBody = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.copernicus.clientId,
    client_secret: env.copernicus.clientSecret
  });

  const response = await fetch(env.copernicus.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: requestBody
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Copernicus authentication failed with status ${response.status}: ${errorText}`
    );
  }

  const tokenData =
    (await response.json()) as CopernicusTokenResponse;

  cachedToken = tokenData.access_token;

  tokenExpiresAt =
    Date.now() +
    Math.max(60, tokenData.expires_in - 60) * 1000;

  return cachedToken;
}