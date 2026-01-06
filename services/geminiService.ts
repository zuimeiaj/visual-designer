
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Shape } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Initialize Google GenAI with API key from environment variables
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Provides UI/UX design suggestions based on the current canvas state.
   */
  async getDesignSuggestions(currentShapes: Shape[], prompt: string, lang: 'en' | 'zh' = 'en') {
    const langInstruction = lang === 'zh' ? "请用中文回答。" : "Please answer in English.";
    const response: GenerateContentResponse = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current Canvas State: ${JSON.stringify(currentShapes)}. User request: ${prompt}`,
      config: {
        systemInstruction: `You are a professional UI/UX and Graphic Design assistant. Based on the current shapes on a canvas, provide a structured suggestion. Suggest color improvements, layout changes, or new shapes to add. Return JSON only. ${langInstruction}`,
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
      return JSON.parse(response.text || '{}');
    } catch (e) {
      return null;
    }
  }

  /**
   * Fix: Implemented generateLayout to handle explicit design generation requests from AICopilot.
   * This method uses the Pro model for more complex spatial reasoning and design tasks.
   */
  async generateLayout(prompt: string, canvasWidth: number, canvasHeight: number) {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `The user wants to generate a UI design for: "${prompt}". The target canvas size is ${canvasWidth}x${canvasHeight}.`,
      config: {
        systemInstruction: "You are a world-class UI designer. Generate a cohesive set of UI components (shapes) that fulfill the user's design request. Use modern colors and clear typography. Ensure all elements fit within the canvas boundaries. Respond with JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shapes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "Type of shape: 'rect', 'circle', 'text', 'diamond'" },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                  fill: { type: Type.STRING, description: "Hex color code for fill" },
                  text: { type: Type.STRING, description: "Text content for labels or buttons" },
                  fontSize: { type: Type.NUMBER },
                  stroke: { type: Type.STRING },
                  strokeWidth: { type: Type.NUMBER }
                },
                required: ["type", "x", "y", "width", "height", "fill"]
              }
            }
          },
          required: ["shapes"]
        }
      }
    });
    try {
      return JSON.parse(response.text || '{"shapes":[]}');
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return { shapes: [] };
    }
  }
}

export const geminiService = new GeminiService();
