'use strict';

const twilio = require('twilio');
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TO_NUMBER = process.env.ALERT_TO_NUMBER;
const FROM_NUMBER = process.env.ALERT_FROM_NUMBER;

if (!ACCOUNT_SID || !AUTH_TOKEN || !TO_NUMBER || !FROM_NUMBER) {
  console.error('\u2717 Missing Twilio configuration environment variables');
  process.exit(1);
}

const LAT = process.env.LATITUDE || 37.7749; // default San Francisco
const LON = process.env.LONGITUDE || -122.4194;

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

async function checkAndAlert() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&temperature_unit=fahrenheit&timezone=auto`;
  let data;
  try {
    const resp = await fetch(url);
    data = await resp.json();
  } catch (err) {
    console.error('Weather fetch failed:', err.message);
    return;
  }

  const temp = data.current_weather && data.current_weather.temperature;
  if (temp === undefined) {
    console.warn('No temperature in weather response');
    return;
  }

  const now = new Date();
  const hr = now.getHours();

  if (hr >= 7 && hr < 21 && temp < 77) {
    try {
      await client.messages.create({
        from: FROM_NUMBER,
        to: TO_NUMBER,
        body: `Alert: temperature dropped to ${temp}\xB0F`,
      });
      console.log(`\u2714\uFE0F Sent alert (${temp}\xB0F)`);
    } catch (err) {
      console.error('Failed to send SMS:', err.message);
    }
  } else {
    console.log(`\u2192 Temp ${temp}\xB0F at ${now.toLocaleTimeString()}, no alert`);
  }
}

checkAndAlert();
setInterval(checkAndAlert, 30 * 60 * 1000); // check every 30 minutes
