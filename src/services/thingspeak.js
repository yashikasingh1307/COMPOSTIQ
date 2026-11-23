const CHANNEL_ID = "3593912";
const READ_API_KEY = "7C3MG4X4AEC60NXA";

export async function getSensorData() {
  const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("ThingSpeak connection failed");
  }

  const data = await response.json();
  const feed = data.feeds?.[0];

  if (!feed) {
    throw new Error("No sensor data available");
  }

  return {
    temperature: Number(feed.field1),
    humidity: Number(feed.field2),
    soilMoisture: Number(feed.field3),
    gasValue: Number(feed.field4),
    alarmState: Number(feed.field5),
    pump: Number(feed.field6),
    fan: Number(feed.field7),
    lastUpdate: feed.created_at
  };
}
