const axios = require("axios");
const xlsx = require("xlsx");
const path = require("path");
require("dotenv").config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Extract necessary fields from the message using Gemini AI
async function extractFieldsFromMessage(message) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `You will receive a message. Extract ONLY the following fields if they are clearly present in the message with the label or field name. Don't take any data without label or field name not mentioned :

- GP ID (e.g., GP ID: 12345)
- Seeker ID (e.g., Seeker ID: 67890)
- Event Date (e.g., mm/dd/yyyy or dd/mm/yyyy)
- Event Time (e.g., 09:00 AM or 15:30)
- Issue Details (Any description of a problem or issue)

If you can't find ANY of these fields clearly, return: null

Otherwise, return JSON in the following format:
{
  "gp_id": "",
  "seeker_id": "",
  "event_date": "",
  "event_time": "",
  "issue_details": ""

}

DO NOT take any value without the label is present. If there is no label "GP ID:", "Seeker ID:", "Event Date:", "Event Time:", "Issue Details:" specifically. Return only raw JSON or null.
DO NOT take any letter duplicate or ignore any letter from the IDs. Handle it carefully.
Message: """${message}"""`,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // Remove potential markdown formatting
    text = text.replace(/```json|```/g, "").trim();

    // Parse the JSON response
    const parsed = JSON.parse(text);

    // Ensure only the exact fields are returned
    return {
      gp_id: parsed?.gp_id || "",
      seeker_id: parsed?.seeker_id || "",
      event_date: parsed?.event_date || "",
      event_time: parsed?.event_time || "",
      issue_details: parsed?.issue_details || "",
    };
  } catch (error) {
    console.error(
      "Gemini extraction error:",
      error.response?.data || error.message
    );
    return null;
  }
}

// Find the matching record from the Excel file based on GP ID and Seeker ID
function findMatchingRecord(gpId, seekerId) {
  try {
    const filePath = path.join(__dirname, "data.xlsx");
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { defval: "" });

    return data.find(
      (row) =>
        row["GP ID"]?.toLowerCase() === gpId?.toLowerCase() &&
        row["Seeker ID"]?.toLowersCase() === seekerId?.toLowerCase()
    );
  } catch (err) {
    console.error("Excel read error:", err.message);
    return null;
  }
}

// Main function to process user message and get a response based on conditions
async function getAIResponse(message) {
  let extracted;
  try {
    extracted = await extractFieldsFromMessage(message);
  } catch (err) {
    console.error("Gemini extraction error:", err);
    return "Server is unavailable. Please wait or try again after sometime.";
  }

  if (!extracted || typeof extracted !== "object") {
    return null;
  }

  const allFieldsEmpty = Object.values(extracted).every(
    (value) => typeof value === "string" && value.trim() === ""
  );
  if (allFieldsEmpty) return null;

  const missingFields = [];
  if (!extracted.gp_id?.trim()) missingFields.push("GP ID");
  if (!extracted.seeker_id?.trim()) missingFields.push("Seeker ID");
  if (!extracted.event_date?.trim()) missingFields.push("Event Date");
  if (!extracted.event_time?.trim()) missingFields.push("Event Time");
  if (!extracted.issue_details?.trim()) missingFields.push("Issue Details");

  if (missingFields.length > 0) {
    console.log("Missing Field Found!");
    return `⚠️ Missing fields: ${missingFields.join(", ")}

*You must enter the following fields:*
GP ID, Seeker ID, Event Date, Event Time, Issue Details`;
  }

  // Load Excel
  try {
    const filePath = path.join(__dirname, "data.xlsx");
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { defval: "" });

    // Exact match
    const match = data.find(
      (row) =>
        row["GP ID"]?.toLowerCase() === extracted.gp_id.toLowerCase() &&
        row["Seeker ID"]?.toLowerCase() === extracted.seeker_id.toLowerCase()
    );

    if (match) {
      return `✅ GP ID: ${extracted.gp_id}  
Seeker ID: ${extracted.seeker_id}  
Event Date: ${extracted.event_date}  
Event Time: ${extracted.event_time}  
Issue Details: ${extracted.issue_details}  
GP POC: ${match["1st Level POC (Umbrella ZM)"]}`;
    }

    // Partial match check
    const gpExists = data.some(
      (row) => row["GP ID"]?.toLowerCase() === extracted.gp_id.toLowerCase()
    );
    const seekerExists = data.some(
      (row) => row["Robi ID"]?.toLowerCase() === extracted.seeker_id.toLowerCase()
    );

    if (gpExists && !seekerExists) {
      return `❌ Incorrect Seeker ID: "${extracted.seeker_id}".`;
    }

    if (!gpExists && seekerExists) {
      return `❌ Incorrect GP ID: "${extracted.gp_id}".`;
    }

    return `❌ No relevant site found! Please check your input and follow the format:

GP ID: XXXX  
Seeker ID: XXXXX  
Event Date: mm/dd/yyyy  
Event Time: hh:mm:ss AM/PM  
Issue Details: ---`;
  } catch (err) {
    console.error("Excel read error:", err);
    return "❌ Failed to read Excel file.";
  }
}


module.exports = { getAIResponse };
