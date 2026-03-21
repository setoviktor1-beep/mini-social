import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY nerastas .env faile.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export async function getPriceEstimate(description: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Esi patyręs kaimynystės meistras. Paskaičiuok preliminarią darbų kainą EUR (rėžį nuo-iki) pagal šį aprašymą: "${description}". Atsakymą pateik TIK JSON formatu: {"min": 0, "max": 0}. Svarbu: be jokių papildomų tekstų.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Išvalome JSON, jei Gemini pridėtų kodines žymes
    const cleanJson = text.replace(/\\`\\`\\`json/g, '').replace(/\\`\\`\\`/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("AI Estimator klaida:", error);
    return { min: 30, max: 100 };
  }
}
