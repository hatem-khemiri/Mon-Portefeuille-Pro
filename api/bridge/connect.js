import axios from 'axios';

export default async function handler(req, res) {
  console.log("REQ BODY:", req.body);
  console.log("ENV CHECK:", {
    id: !!process.env.BRIDGE_CLIENT_ID,
    secret: !!process.env.BRIDGE_CLIENT_SECRET,
    version: process.env.BRIDGE_VERSION,
    vercelUrl: process.env.VERCEL_URL
  });

  // Autoriser uniquement POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 🔍 Vérifier que les variables d'environnement sont présentes
    if (
      !process.env.BRIDGE_CLIENT_ID ||
      !process.env.BRIDGE_CLIENT_SECRET ||
      !process.env.BRIDGE_VERSION
    ) {
      console.error("ENV MANQUANTE", {
        id: !!process.env.BRIDGE_CLIENT_ID,
        secret: !!process.env.BRIDGE_CLIENT_SECRET,
        version: process.env.BRIDGE_VERSION
      });

      return res.status(500).json({ error: "Configuration serveur manquante" });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    // 🌍 URL BASE CORRECTE (local ou Vercel)
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    // 👥 Vérifier le nombre d'utilisateurs
    const countResponse = await axios.get(`${baseUrl}/api/bridge/users-count`);
    const { count } = countResponse.data;

    if (count >= 95) {
      return res.status(403).json({
        error: 'Limite atteinte',
        message: 'Le service de synchronisation bancaire a atteint sa capacité maximale.'
      });
    }

    // 🔐 Générer un lien de connexion Bridge
    const response = await axios.post(
      'https://api.bridgeapi.io/v2/connect/items/add',
      {
        user: { external_id: userId },
        prefill_email: null
      },
      {
        headers: {
          'Bridge-Version': process.env.BRIDGE_VERSION,
          'Client-Id': process.env.BRIDGE_CLIENT_ID,
          'Client-Secret': process.env.BRIDGE_CLIENT_SECRET,
          'Content-Type': 'application/json'
        }
      }
    );

    // ✅ Retourner le lien
    return res.status(200).json({
      connectUrl: response.data.redirect_url,
      userId
    });

  } catch (error) {
    console.error(
      'Erreur Bridge Connect:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: 'Erreur lors de la connexion bancaire',
      details: error.response?.data || error.message
    });
  }
}
