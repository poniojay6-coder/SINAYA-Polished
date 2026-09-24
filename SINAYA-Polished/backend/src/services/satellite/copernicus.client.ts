import { env } from "../../config/env.js";
import {
  getCopernicusToken
} from "./copernicusAuth.service.js";

export async function testCopernicusConnection() {
  const token = await getCopernicusToken();

  const response = await fetch(
    `${env.copernicus.catalogUrl}/collections`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Copernicus request failed with status ${response.status}: ${errorText}`
    );
  }

  return response.json();
}