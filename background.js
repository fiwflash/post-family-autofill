// background.js

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting panel behavior:", error));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractDataWithGemini") {
    extractData(request.text, request.imageBase64, request.model, request.apiKey)
      .then(result => sendResponse({ success: true, data: result.data, modelUsed: result.modelUsed }))
      .catch(error => {
          console.error("Extraction Error:", error);
          sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// ==========================================
// 🤖 GEMINI FREE TIER MODEL FALLBACK ORDER
// ==========================================
// ลำดับโมเดลตามตาราง (ต้องตรงกับ MODEL_PRIORITY ใน popup.js)
const MODEL_FALLBACK = [
  'gemini-3.5-flash-lite',  // 🍃 แนะนำ - เสถียรและเร็วสุด (default)
  'gemini-2.5-flash-lite',  // 🟢 fallback - ประหยัด
  'gemini-2.5-flash',       // 🔵 fallback
  'gemini-3.6-flash',       // 🚀 แม่นยำ - ช้า/ติดโหลดเป็นระยะ
  'gemini-3.8-flash',       // ⚡ เร็วสุด - ช่วงนี้ติดโหลดสูง
];

// HTTP สถานะที่ถือว่าเป็น "ติดโหลด/ชั่วคราว" → สมควรลอง fallback ต่อ
const TRANSIENT_STATUS = new Set([429, 500, 503]);
const TRANSIENT_PATTERN = /high demand|spikes in demand|resource[\s_]*exhausted|rate[\s_]?limit|quota|unavailable|overloaded|too many requests/i;

function normalizeModelId(model) {
  const id = String(model || '').replace(/^models\//, '').trim();
  return id || MODEL_FALLBACK[0];
}

function isTransient(error) {
  if (TRANSIENT_STATUS.has(error.status)) return true;
  return TRANSIENT_PATTERN.test(error.message || '');
}

async function extractData(text, imageBase64, model, apiKey) {
  if (!apiKey) throw new Error("Please set your Gemini API Key in Settings.");

  // ลองโมเดลที่ผู้ใช้เลือกก่อน แล้วค่อยไล่ fallback ตามลำดับตาราง
  const requested = normalizeModelId(model);
  const order = [requested, ...MODEL_FALLBACK.filter(id => id !== requested)];

  let lastError;
  for (const modelId of order) {
    try {
      const data = await generateContent(modelId, text, imageBase64, apiKey);
      return { data, modelUsed: modelId };
    } catch (error) {
      lastError = error;
      // error ที่ไม่ใช่ "ติดโหลดชั่วคราว" → หยุดทันที ไม่ไล่ fallback ต่อ
      if (!isTransient(error)) throw error;
      console.warn(`Model ${modelId} unavailable, trying next fallback:`, error.message);
    }
  }
  throw lastError;
}

async function generateContent(modelId, text, imageBase64, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  // Prompt ใหม่: บังคับภาษาไทย และเพิ่ม Email
  const promptText = `
    Extract information from the provided ID card image and/or text for a POST Family registration.
    Return ONLY a valid JSON object matching this schema. Do not add markdown formatting.
    
    CRITICAL LANGUAGE RULE:
    - All text values MUST be in Thai language (e.g., Name, Surname, Address, Province).
    - EXCEPTION: "email" and "passport" fields MUST be in English (alphanumeric) if present.
    - Leave fields empty ("") if not found.
    
    Schema:
    {
      "firstName": "string (Thai language only)",
      "lastName": "string (Thai language only)",
      "citizenId": "string (Numeric only)",
      "passport": "string (English only, if found instead of ID card)",
      "phone": "string",
      "email": "string (English only)",
      "dateOfBirth": { 
        "day": "string 2 digits", 
        "month": "string 2 digits", 
        "year": "string 4 digits (BE)" 
      },
      "address": {
        "houseNo": "string",
        "moo": "string",
        "soi": "string",
        "road": "string",
        "subDistrict": "string (Thai language only)",
        "district": "string (Thai language only)",
        "province": "string (Thai language only)",
        "postcode": "string"
      }
    }
    
    Extra Text Context: ${text || "None"}
  `;

  const parts = [{ text: promptText }];
  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    parts.push({ inline_data: { mime_type: "image/jpeg", data: cleanBase64 } });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    let message = "Gemini API Error";
    try {
      const err = await response.json();
      message = err.error?.message || message;
    } catch (e) { /* ignore */ }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  let responseText = data.candidates[0].content.parts[0].text;

  responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  const firstBracket = responseText.indexOf('{');
  const lastBracket = responseText.lastIndexOf('}');
  if (firstBracket !== -1 && lastBracket !== -1) {
      responseText = responseText.substring(firstBracket, lastBracket + 1);
  }

  return JSON.parse(responseText);
}
