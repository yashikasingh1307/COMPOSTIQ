const API_BASE_URL = "http://127.0.0.1:8000";

export async function getSensorData() {
  const response = await fetch(`${API_BASE_URL}/api/sensors`);

  if (!response.ok) {
    throw new Error("Failed to fetch sensor data from COMPOSTIQ backend");
  }

  return response.json();
}
