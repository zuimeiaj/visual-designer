
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Shape } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Initializing with direct process.env.API_KEY as per guidelines
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async getDesignSuggestions(currentShapes: Shape[], prompt: string) {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current Canvas State: ${JSON.stringify(currentShapes)}. User request: ${prompt}`,
      config: {
        systemInstruction: "You are a professional UI/UX and Graphic Design assistant. Based on the current shapes on a canvas, provide a structured suggestion. Suggest color improvements, layout changes, or new shapes to add. Return JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thought: { type: Type.STRING },
            suggestedAction: { type: Type.STRING },
            newElements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                  fill: { type: Type.STRING },
                  text: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    try {
      // Accessing response.text as a property, not a method
      const text = response.text;
      return text ? JSON.parse(text) : null;
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return null;
    }
  }

  async generateAsset(prompt: string): Promise<string | null> {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Generate a high-quality creative asset or icon for: ${prompt}. Minimalist, professional style.` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    // Iterating through all parts to find the image part
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  }
}

export const geminiService = new GeminiService();
