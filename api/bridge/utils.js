import axios from 'axios';

/**
 * Récupère le nombre d'utilisateurs actifs depuis Bridge API
 */
export async function getUsersCount() {
  try {
    const response = await axios.get(
      'https://api.bridgeapi.io/v3/aggregation/items',
      {
        headers: {
          'Bridge-Version': process.env.BRIDGE_VERSION,
          'Client-Id': process.env.BRIDGE_CLIENT_ID,
          'Client-Secret': process.env.BRIDGE_CLIENT_SECRET
        }
      }
    );

    const activeUsers = response.data.resources.filter(item => item.status === 'valid');
    return activeUsers.length;
  } catch (error) {
    // Si 404, c'est qu'il n'y a pas encore d'utilisateurs
    if (error.response?.status === 404) {
      console.log('Aucun utilisateur Bridge trouvé (normal au début)');
      return 0;
    }
    
    console.error('Erreur getUsersCount:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Génère un access token pour un utilisateur
 */
export async function getAccessToken(userId) {
  try {
    const response = await axios.post(
      'https://api.bridgeapi.io/v3/aggregation/authorization/token',
      {
        external_user_id: userId
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

    return response.data.access_token;
  } catch (error) {
    // Si l'utilisateur n'existe pas, le créer d'abord
    if (error.response?.status === 404) {
      console.log('Utilisateur inexistant, création...');
      await axios.post(
        'https://api.bridgeapi.io/v3/aggregation/users',
        {
          external_user_id: userId
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
      
      // Réessayer d'obtenir le token
      return getAccessToken(userId);
    }
    
    console.error('Erreur getAccessToken:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Envoie une alerte email si un seuil est atteint
 */
export async function sendAlertIfNeeded(count) {
  const maxUsers = parseInt(process.env.MAX_USERS) || 100;
  const thresholds = process.env.ALERT_THRESHOLDS 
    ? process.env.ALERT_THRESHOLDS.split(',').map(Number)
    : [25, 50, 75, 90, 95];

  for (const threshold of thresholds) {
    if (count === threshold) {
      try {
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000';

        await fetch(`${baseUrl}/api/email/alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count, threshold, maxUsers })
        }).catch(err => {
          console.error('Erreur envoi alerte:', err.message);
        });
      } catch (alertError) {
        console.error('Erreur lors de l\'alerte:', alertError.message);
      }
    }
  }
}