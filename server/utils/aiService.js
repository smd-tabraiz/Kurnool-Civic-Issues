const { GoogleGenAI } = require('@google/genai');

let ai;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const parseIssueWithAI = async (text) => {
  if (!ai || !text) return null;

  const prompt = `You are a civic issue classification AI for a local portal in Kurnool.

The user may type in:
- Pure Telugu (తెలుగు)
- English
- Mixed Telugu-English (Tanglish, Telugu words written in English)

The user is likely from a village, so:
- Grammar may be incorrect
- Spelling may be informal
- Sentences may be short or unclear

Your task:
1. Understand the complaint correctly regardless of language.
2. Convert or translate it into simple, clear English.
3. Do NOT change the meaning.
4. Keep the description short and accurate.
5. Identify the correct category exactly from below:

Categories:
- water
- road
- power
- health
- sanitation
- other

6. Determine urgency level exactly from below:
- urgent → life-threatening, immediate health risk, mass danger
- high → active health risk, major danger, severe issue
- medium → moderate inconvenience, civic nuisance
- low → minor issue

Output format MUST be EXACTLY valid JSON like this, with NO markdown formatting around it:
{
  "description": "The translated english description.",
  "category": "water",
  "priority": "high"
}

User Input:
${text}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const outputText = response.text;
    // Strip markdown JSON wrapping if present
    const cleanJsonString = outputText.replace(/```json\n?|\n?```/gi, '').trim();
    
    return JSON.parse(cleanJsonString);
  } catch (error) {
    console.error('AI Parsing Error:', error.message);
    return null;
  }
};

module.exports = { parseIssueWithAI };
