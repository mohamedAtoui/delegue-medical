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

SOURCES DE DONNÉES:
- AGRÉGATS — pour toute question quantitative (combien, %, total, top). Ces nombres
  couvrent l'ENSEMBLE du filtre, utilise-les exclusivement.
- RÉPERTOIRE — pour les questions sur le catalogue produits (stock, prix, laboratoire),
  les médecins/pharmaciens les plus visités, ou les visites planifiées (en attente / en
  retard).
- ÉCHANTILLON DÉTAILLÉ — pour les questions qualitatives (qui a dit quoi, retours
  patients, marques mentionnées, contenu des commentaires, arguments rencontrés).

RÈGLES D'HONNÊTETÉ:
- Si une question demande un détail qualitatif sur des visites hors de l'ÉCHANTILLON,
  dis-le ("L'échantillon ne couvre que la période X→Y").
- Si l'ÉCHANTILLON ne couvre qu'une fraction du filtre, ajoute une brève mise en garde
  quand ta réponse repose dessus.
- Si une question demande quelque chose qui n'est dans aucune section (notifications,
  invitations, etc.), dis "Cette information n'est pas accessible".
- Ne jamais inventer un nom, chiffre, ou détail. Si tu n'es pas sûr, dis-le.`,
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
