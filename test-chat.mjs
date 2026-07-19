import fs from "node:fs";

function loadEnv() {
  const text = fs.readFileSync(".env", "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    process.env[key] = value;
  }
}

loadEnv();

const baseUrl = process.env.OPENAI_RELAY_BASE_URL;
const apiKey = process.env.OPENAI_RELAY_API_KEY;
const model = process.env.OPENAI_RELAY_MODEL || "gpt-5.4";

if (!baseUrl || !apiKey || !model) {
  console.error("Missing OPENAI_RELAY_BASE_URL / OPENAI_RELAY_API_KEY / OPENAI_RELAY_MODEL in .env");
  process.exit(1);
}

const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

console.log("Testing relay API...");
console.log("URL:", url);
console.log("Model:", model);
console.log("API Key exists:", Boolean(apiKey));

try {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: "请只回复：API连接成功",
        },
      ],
      max_tokens: 50,
      temperature: 0.2,
    }),
  });

  clearTimeout(timer);

  console.log("Status:", response.status);

  const text = await response.text();
  console.log("Raw response:");
  console.log(text);

  if (!response.ok) {
    process.exit(1);
  }

  const data = JSON.parse(text);

  console.log("Assistant reply:");
  console.log(data.choices?.[0]?.message?.content);
} catch (error) {
  console.error("Request failed:");
  console.error(error);
}