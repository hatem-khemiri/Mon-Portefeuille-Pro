import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Récupérer tous les items actifs
    const response = await axios.get(
      'https://api.bridgeapi.io/v2/items',
      {
        headers: {
          'Bridge-Version': process.env.BRIDGE_VERSION,
          'Client-Id': process.env.BRIDGE_CLIENT_ID,
          'Client-Secret': process.env.BRIDGE_CLIENT_SECRET
        }
      }
    );

    const activeUsers = response.data.resources.filter(item => item.status === 'ok');
    const count = activeUsers.length;

    // Vérifier les seuils d'alerte
    const thresholds = process.env.ALERT_THRESHOLDS.split(',').map(Number);
    const maxUsers = parseInt(process.env.MAX_USERS);

    for (const threshold of thresholds) {
      if (count === threshold) {
        // Construire l'URL de base correctement
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000';

        // Envoyer une alerte
        await fetch(`${baseUrl}/api/email/alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count, threshold, maxUsers })
        });
      }
    }

    return res.status(200).json({ 
      count,
      maxUsers,
      percentage: ((count / maxUsers) * 100).toFixed(1),
      canConnect: count < 95
    });

  } catch (error) {
    console.error('Erreur Users Count:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Erreur lors du comptage',
      details: error.response?.data || error.message
    });
  }
}