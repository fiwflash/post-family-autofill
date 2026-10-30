// background.js

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting panel behavior:", error));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractDataWithGemini") {
    extractData(request.text, request.imageBase64, request.model, request.apiKey)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => {
          console.error("Extraction Error:", error);
          sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function extractData(text, imageBase64, model, apiKey) {
  if (!apiKey) throw new Error("Please set your Gemini API Key in Settings.");

  const modelName = model || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
  
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

  try {
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
        const err = await response.json();
        throw new Error(err.error?.message || "Gemini API Error");
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
  } catch (error) {
      throw error;
  }
}
