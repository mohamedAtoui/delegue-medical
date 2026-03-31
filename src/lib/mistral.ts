const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

export async function summarizeVisitNotes(notes: string[]): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY non configure");
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
          content: `Tu es un assistant pour une entreprise pharmaceutique algerienne appelee Handson. Analyse les notes de visites medicales suivantes et fournis:

1. Un resume concis des points cles
2. Les tendances observees (retours frequents des medecins)
3. Les remarques importantes sur les produits
4. Les points d'action recommandes

Reponds en francais de maniere professionnelle et structuree.`,
        },
        {
          role: "user",
          content: `Voici les notes de visites a resumer:\n\n${notes
            .map((n, i) => `${i + 1}. ${n}`)
            .join("\n")}`,
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
