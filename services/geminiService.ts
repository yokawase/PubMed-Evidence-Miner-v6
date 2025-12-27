
import { GoogleGenAI, Type } from "@google/genai";
import { MeshTerm, PubMedArticle } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const extractMeshTerms = async (text: string): Promise<string[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract the most relevant Medical Subject Headings (MeSH terms) from the following medical text/keywords. Return ONLY a JSON array of strings. Text: "${text}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  
  try {
    return JSON.parse(response.text.trim());
  } catch (e) {
    console.error("Failed to parse MeSH terms", e);
    return [];
  }
};

export const translateAndAnalyzeArticle = async (article: PubMedArticle, targetTopic: string): Promise<Partial<PubMedArticle>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Topic of Interest: ${targetTopic}
      
      Analyze the following PubMed article:
      Title: ${article.title}
      Abstract: ${article.abstract}
      
      Tasks:
      1. Translate the Title and Abstract into professional medical Japanese.
      2. Analyze its relevance to the "Topic of Interest" (Target).
      
      Return as JSON with keys: translatedTitle, translatedAbstract, relevanceAnalysis.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translatedTitle: { type: Type.STRING },
          translatedAbstract: { type: Type.STRING },
          relevanceAnalysis: { type: Type.STRING }
        },
        required: ["translatedTitle", "translatedAbstract", "relevanceAnalysis"]
      }
    }
  });
  
  try {
    return JSON.parse(response.text.trim());
  } catch (e) {
    console.error("Analysis failed", e);
    return {};
  }
};

export const synthesizeFinalReport = async (articles: PubMedArticle[], target: string): Promise<string> => {
  const context = articles.map(a => `Title: ${a.title}\nAnalysis: ${a.relevanceAnalysis}`).join("\n\n---\n\n");
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `
      You are a world-class medical researcher. 
      Synthesize a final report based on the following analyzed papers and their relevance to the target topic: "${target}".
      The report should be in professional Japanese, structured with an Introduction, Key Findings from the selected evidence, Clinical Implications, and a Conclusion.
      
      Articles Data:
      ${context}
    `,
    config: {
      thinkingConfig: { thinkingBudget: 2000 }
    }
  });
  
  return response.text;
};
