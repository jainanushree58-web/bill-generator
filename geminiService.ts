
import { GoogleGenAI, Type } from "@google/genai";
import { AIParsedInvoice } from "./types";

// Always use a named parameter for the API key from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses Gemini 3 Flash to parse invoice text into a structured JSON format.
 */
export const parseInvoiceText = async (text: string): Promise<AIParsedInvoice> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Parse this billing request into a structured JSON format: "${text}"`,
    config: {
      systemInstruction: `You are a professional invoice data extractor. 
      Your goal is to extract the customer's name and a list of goods/services (items).
      For each item, extract the description, quantity, and unit rate.
      
      Rules:
      1. If the user mentions "goods given to him", interpret the items correctly.
      2. If a quantity is missing, default to 1.
      3. If a rate/price is missing, default to 1.
      4. Try to clean up item descriptions (e.g., "2 apples" becomes description: "Apples", quantity: 2).
      5. Customer name should be the person receiving the bill.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          customerName: { type: Type.STRING, description: "The name of the customer" },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                rate: { type: Type.NUMBER }
              },
              required: ["description", "quantity", "rate"]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  try {
    const jsonStr = response.text?.trim();
    if (!jsonStr) {
      return { items: [] };
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return { items: [] };
  }
};
