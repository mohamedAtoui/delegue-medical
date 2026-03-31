const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

export async function summarizeVisitNotes(notes: string[]): Promise<string> {
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
          content: `Tu es un assistant pour une entreprise pharmaceutique algérienne appelée Handson. Analyse les notes de visites médicales suivantes.

RÈGLES DE FORMAT IMPORTANTES:
- Réponds en texte brut uniquement, PAS de markdown
- N'utilise PAS de caractères comme **, ##, -, *, etc.
- Utilise des numéros (1. 2. 3.) pour les listes
- Sépare les sections par des lignes vides
- Sois concis et professionnel

Structure ta réponse ainsi:

POINTS CLÉS
(résumé des observations principales)

TENDANCES
(retours fréquents des médecins)

REMARQUES SUR LES PRODUITS
(feedback spécifique aux produits)

ACTIONS RECOMMANDÉES
(ce que les délégués devraient faire)`,
        },
        {
          role: "user",
          content: `Voici les notes de visites à résumer:\n\n${notes
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
