import {
  callDeepSeek,
  isDeepSeekConfigured,
} from "./services/ai/deepseek.client.js";

async function testServices() {
  console.log("Testing external services...\n");

  // Test DeepSeek
if (!isDeepSeekConfigured()) {
  console.log("⏭️ DeepSeek test skipped: no API key configured.");
} else {
  try {
    const aiResponse = await callDeepSeek([
      {
        role: "system",
        content:
          "You are the SINAYA communication assistant. Follow the requested connection-test format only.",
      },
      {
        role: "user",
        content:
          "Reply with exactly: SINAYA connection OK",
      },
    ]);

    console.log("✅ DeepSeek connection successful");
    console.log("Response:", aiResponse);
  } catch (error) {
    console.error("❌ DeepSeek connection failed");
    console.error(error);
  }
}

  // Satellite is outside the revised MVP; retain an explicit legacy diagnostic.
  if (!process.argv.includes("--include-legacy-satellite")) {
    console.log("Copernicus skipped: outside the sensor + weather MVP.");
    return;
  }
  try {
    const { testCopernicusConnection } = await import("./services/satellite/copernicus.client.js");
    const satelliteResponse = await testCopernicusConnection();

    console.log("✅ Copernicus connection successful");
    console.log(
      "Available collections:",
      satelliteResponse.collections?.length ?? "Connection confirmed",
    );
  } catch (error) {
    console.error("❌ Copernicus connection failed");
    console.error(error);
  }
}

testServices();
