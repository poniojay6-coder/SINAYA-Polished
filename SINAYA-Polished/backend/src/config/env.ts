import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 3030),

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",

    model:
      process.env.DEEPSEEK_MODEL ??
      "deepseek-flash",

    baseUrl:
      process.env.DEEPSEEK_BASE_URL ??
      "https://api.deepseek.com"
  },

  copernicus: {
    clientId: process.env.COPERNICUS_CLIENT_ID ?? "",
    clientSecret: process.env.COPERNICUS_CLIENT_SECRET ?? "",

    tokenUrl:
      process.env.COPERNICUS_TOKEN_URL ??
      "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",

    catalogUrl:
      process.env.COPERNICUS_CATALOG_URL ??
      "https://sh.dataspace.copernicus.eu/catalog/v1",

    processUrl:
      process.env.COPERNICUS_PROCESS_URL ??
      "https://sh.dataspace.copernicus.eu/process/v1"
  },

  database: {
    url: process.env.DATABASE_URL ?? ""
  }
};