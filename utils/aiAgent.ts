import { GoogleGenAI } from "@google/genai";
import { Feature } from 'geojson';

// Define the shape of the AI response based on the prompt instructions
interface AIPlaceResult {
    name: string;
    address: string;
    category: string;
    description: string;
    coordinates: {
        lat: number | null;
        lng: number | null;
    } | null;
}

const SYSTEM_INSTRUCTION = `
Role: You are a strict Geospatial Data API. Your only purpose is to accept user queries about locations and return structured JSON data.

Directives:
1.  **Use Grounding:** Always use Google Search/Grounding to find real, existing places based on the user's request. Do not hallucinate locations.
2.  **Output Format:** You must output ONLY a valid JSON array. Do not include markdown formatting (like \`\`\`json ... \`\`\`), do not include conversational filler, and do not include explanations. Just the raw JSON array.
3.  **Language:** Keep JSON keys in English. The values (names/descriptions) should be in the language of the user's query.
4.  **No Results:** If no places are found, return an empty array [].

JSON Structure:
Each object in the array must follow this schema:
{
  "name": "String (Name of the place)",
  "address": "String (Full address suitable for geocoding)",
  "category": "String (e.g., 'Restaurant', 'Park', 'Museum')",
  "description": "String (Brief 1-sentence summary)",
  "coordinates": {
      "lat": Number (Estimate if available in search context, otherwise null),
      "lng": Number (Estimate if available in search context, otherwise null)
  }
}
`;

export const fetchAIPlaces = async (query: string): Promise<Feature[]> => {
    // API Key configuration: process.env.API_KEY is prioritized, falling back to process.env.GEMINI_API_KEY
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("API Key is missing. Please ensure GEMINI_API_KEY is configured in your .env file.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Using gemini-2.5-flash as it is fast and supports search grounding
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.2, // Low temperature for deterministic output
                tools: [{ googleSearch: {} }] // Enable grounding
            }
        });

        let text = response.text || '';
        
        // Clean up markdown code blocks if the model ignores the "no markdown" rule
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let rawData: AIPlaceResult[] = [];
        try {
            rawData = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse AI JSON:", text);
            throw new Error("AI returned invalid data format.");
        }

        if (!Array.isArray(rawData)) {
            throw new Error("AI did not return a list of places.");
        }

        // Convert to GeoJSON Features
        const features: Feature[] = rawData
            .filter(item => item.coordinates && item.coordinates.lat && item.coordinates.lng) // Filter out items without coords
            .map((item, index) => {
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [item.coordinates!.lng!, item.coordinates!.lat!]
                    },
                    properties: {
                        id: `ai-place-${Date.now()}-${index}`,
                        name: item.name,
                        address: item.address,
                        category: item.category,
                        description: item.description,
                        source: 'Gemini AI'
                    }
                };
            });
            
        return features;

    } catch (error) {
        console.error("AI Agent Error:", error);
        throw error;
    }
};