import axios from 'axios';

export default async function handler(req, res) {
  // Autoriser uniquement POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    // Vérifier le nombre d'utilisateurs actifs
    const countResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/bridge/users-count`);
    const { count } = await countResponse.json();

    // Bloquer si >= 95 utilisateurs
    if (count >= 95) {
      return res.status(403).json({ 
        error: 'Limite atteinte', 
        message: 'Le service de synchronisation bancaire a atteint sa capacité maximale. Veuillez réessayer plus tard.' 
      });
    }

    // Générer un lien de connexion Bridge
    const response = await axios.post(
      'https://api.bridgeapi.io/v2/connect/items/add',
      {
        user: {
          external_id: userId
        },
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

    return res.status(200).json({
      connectUrl: response.data.redirect_url,
      userId: userId
    });

  } catch (error) {
    console.error('Erreur Bridge Connect:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Erreur lors de la connexion bancaire',
      details: error.response?.data || error.message
    });
  }
}