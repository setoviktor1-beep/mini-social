import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

// 1. Nustatome maksimalų tokenų kiekį atsakymui (taupymas)
const generationConfig = {
  maxOutputTokens: 60,
  temperature: 0.1, // Maža temperatūra = tikslesni, trumpesni atsakymai
};

export function parsePriceEstimateJson(text: string): { min: number; max: number } {
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error("No JSON object found in response");
  const parsed = JSON.parse(match[0]);
  const min = typeof parsed.min === "number" && Number.isFinite(parsed.min) && parsed.min >= 0
    ? Math.round(parsed.min)
    : 20;
  const rawMax = typeof parsed.max === "number" && Number.isFinite(parsed.max) && parsed.max >= 0
    ? Math.round(parsed.max)
    : 80;
  const max = rawMax >= min ? rawMax : Math.max(min, 80);
  return { min, max };
}

export async function getPriceEstimate(description: string, userId: string) {
  // 2. Paprastas saugiklis: nesiunčiame trumpų užklausų
  if (description.length < 15) {
    return { min: 0, max: 0, error: "Per trumpas aprasymas" };
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig 
    });

    const prompt = `Esi meistras. Paskaičiuok preliminarią kainą EUR rėžį už: "${description}". Atsakyk TIK JSON: {"min": 0, "max": 0}. Be teksto.`;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parsePriceEstimateJson(text);
  } catch (error) {
    console.error("AI Klaida:", error);
    return { min: 20, max: 80 }; // Saugus variantas
  }
}
