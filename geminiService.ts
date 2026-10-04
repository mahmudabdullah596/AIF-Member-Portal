
import { GoogleGenAI } from "@google/genai";

// Always use process.env.API_KEY directly when initializing GoogleGenAI client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getForumSupport = async (prompt: string, memberContext: any) => {
  try {
    const contextStr = JSON.stringify(memberContext);
    const systemInstruction = `
      You are an AI assistant for "Forum Connect", a community savings group of 50 members.
      Each member saves money monthly, which is invested in businesses like Super Shops and Agriculture.
      The user is a member with the following data: ${contextStr}.
      Respond in Bengali language. Be polite, helpful, and transparent.
      Explain savings, due amounts, and investment progress.
    `;

    // Ensure model name is correct and contents is passed directly
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    // Directly access the text property as per guidelines
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে পরে চেষ্টা করুন।";
  }
};
