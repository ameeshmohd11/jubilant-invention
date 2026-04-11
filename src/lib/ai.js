import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generatePresentationSummary(text, apiKey) {
  if (!apiKey) {
    throw new Error("API key is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Using the latest gemini-3-flash-preview model!
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `
You are an expert presentation designer and summarizer.
Your goal is to parse the following document text and convert it into a highly engaging, structured, and concise presentation deck.
The presentation should abstract the document into core, impactful ideas.

Important:
You MUST respond with ONLY a raw JSON array of slide objects. Do not wrap it in markdown block quotes (no \`\`\`json). Just the raw JSON format.

Each object in the JSON array must follow this exact structure:
{
  "title": "A short, punchy title for the slide",
  "emoji": "A single relevant emoji for this slide",
  "bulletPoints": [
    "A concise point capturing an important detail",
    "Another brief and impactful point",
    "Max 4-5 bullet points per slide"
  ],
  "detailedContent": "A thoroughly detailed, extensive text block containing ALL underlying data, statistics, facts, and nuanced context from the document related to this topic. This is used for comprehensive written reports."
}

The first slide should act as a Title/Overview slide. Make 5 to 10 slides depending on the length of the document.

Document Text:
${text.substring(0, 30000)} // Ensure we don't go too over context length, though 1.5 flash handles large
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonString = response.text().trim();
    
    // Attempt to parse, removing any markdown formatting if the model still outputs it
    const cleanJsonString = jsonString.replace(/^```json/g, '').replace(/```$/g, '').trim();
    
    return JSON.parse(cleanJsonString);
  } catch (error) {
    console.error("Error generating presentation:", error);
    throw error;
  }
}

export async function askDocumentQuestion(text, question, apiKey) {
  if (!apiKey) throw new Error("API key is required");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `You are a highly intelligent and helpful AI assistant.
Your task is to answer a user's question based strictly on the provided document text.

Document Text:
${text.substring(0, 35000)}

User Question: ${question}

Instructions:
1. Provide a concise, accurate, and direct answer.
2. ONLY use the information found in the document provided above.
3. If the user asks for a table, records, or structured data, MUST format it dynamically as a clean Markdown table. Example:
| Header | Header |
| --- | --- |
| Value | Value |
4. Use standard markdown for lists and bolding where applicable.
5. If the document does not contain the answer, politely state that you cannot find the answer in the document.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error asking question:", error);
    throw error;
  }
}

export async function generateQuiz(text, apiKey) {
  if (!apiKey) throw new Error("API key is required");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `Based strictly on the following document text, generate a short 3-question learning multiple-choice quiz.
Document Text:
${text.substring(0, 35000)}

You MUST respond with ONLY a raw JSON array. (Do not wrap it in markdown block quotes like \`\`\`json).
Structure:
[
  {
    "question": "The question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answerIndex": 0,
    "explanation": "Short 1-sentence explanation of why it is correct"
  }
]`;

  try {
    const result = await model.generateContent(prompt);
    let str = result.response.text().trim();
    if (str.startsWith("\`\`\`json")) str = str.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    if (str.startsWith("\`\`\`")) str = str.replace(/\`\`\`/g, '').trim();
    return JSON.parse(str);
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw error;
  }
}
