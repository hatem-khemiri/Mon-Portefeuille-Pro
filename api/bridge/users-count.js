import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vérifier que toutes les variables d'environnement sont présentes
    if (!process.env.BRIDGE_CLIENT_ID || !process.env.BRIDGE_CLIENT_SECRET || !process.env.BRIDGE_VERSION) {
      console.error('Variables d\'environnement manquantes:', {
        hasClientId: !!process.env.BRIDGE_CLIENT_ID,
        hasClientSecret: !!process.env.BRIDGE_CLIENT_SECRET,
        hasVersion: !!process.env.BRIDGE_VERSION
      });
      return res.status(500).json({ error: 'Configuration serveur manquante' });
    }

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
    const maxUsers = parseInt(process.env.MAX_USERS) || 100;
    const thresholds = process.env.ALERT_THRESHOLDS 
      ? process.env.ALERT_THRESHOLDS.split(',').map(Number)
      : [25, 50, 75, 90, 95];

    // Envoyer une alerte si un seuil est atteint
    for (const threshold of thresholds) {
      if (count === threshold) {
        try {
          // Construire l'URL de base correctement
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000';

          // Envoyer une alerte (ne pas bloquer si ça échoue)
          await fetch(`${baseUrl}/api/email/alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count, threshold, maxUsers })
          }).catch(err => {
            console.error('Erreur envoi alerte email:', err.message);
          });
        } catch (alertError) {
          // Ne pas faire échouer toute la requête si l'alerte échoue
          console.error('Erreur lors de l\'envoi d\'alerte:', alertError.message);
        }
      }
    }

    return res.status(200).json({ 
      count,
      maxUsers,
      percentage: ((count / maxUsers) * 100).toFixed(1),
      canConnect: count < 95
    });

  } catch (error) {
    console.error('Erreur Users Count:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(500).json({ 
      error: 'Erreur lors du comptage',
      details: error.response?.data || error.message
    });
  }
}