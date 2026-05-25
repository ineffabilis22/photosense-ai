import fs from "node:fs";
import path from "node:path";

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

// 把这里改成你本地任意一张测试图片路径
const imagePath = process.argv[2];

if (!imagePath) {
  console.error("Please provide an image path.");
  console.error('Example: node test-vision.mjs "C:\\Users\\YYN\\Desktop\\test.jpg"');
  process.exit(1);
}

const imageBuffer = fs.readFileSync(imagePath);
const ext = path.extname(imagePath).toLowerCase();

let mimeType = "image/jpeg";
if (ext === ".png") mimeType = "image/png";
if (ext === ".webp") mimeType = "image/webp";

const base64Image = imageBuffer.toString("base64");
const dataUrl = `data:${mimeType};base64,${base64Image}`;

const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

console.log("Testing vision API...");
console.log("URL:", url);
console.log("Model:", model);
console.log("Image:", imagePath);
console.log("Image size KB:", Math.round(imageBuffer.length / 1024));

try {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);

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
          content: [
            {
              type: "text",
              text: "请用一句中文简单描述这张图片内容。",
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 120,
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