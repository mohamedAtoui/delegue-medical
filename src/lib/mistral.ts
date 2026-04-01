const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

export async function askAboutVisits(context: string, question: string): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY non configuré");
  }

  const response = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content: `Tu es un assistant analytique pour Handson, une entreprise pharmaceutique algérienne. Tu analyses les données de visites médicales des délégués.

RÈGLES:
- Réponds en texte brut, PAS de markdown (pas de **, ##, -, *, etc.)
- Utilise des numéros (1. 2. 3.) pour les listes
- Sois concis, professionnel et actionnable
- Base tes réponses uniquement sur les données fournies
- Si la question ne peut pas être répondue avec les données, dis-le clairement`,
        },
        {
          role: "user",
          content: `Voici les notes de visites médicales:\n\n${context}\n\nQuestion du superviseur: ${question}`,
        },
      ],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur Mistral: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
