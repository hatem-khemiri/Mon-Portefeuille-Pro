import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, Calendar, Tag, Search, Download, Upload } from 'lucide-react';
import { bridgeService } from './services/bridgeService';

function App() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([
    'Alimentation', 'Transport', 'Logement', 'Loisirs', 'Santé', 
    'Shopping', 'Éducation', 'Services', 'Autres'
  ]);
  const [loading, setLoading] = useState(false);
  const [bridgeUser, setBridgeUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('Toutes');
  const [filterType, setFilterType] = useState('Toutes');

  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense',
    category: 'Alimentation'
  });

  // Charger les données sauvegardées au démarrage
  useEffect(() => {
    const savedTransactions = localStorage.getItem('transactions');
    const savedUser = localStorage.getItem('bridgeUser');
    const savedAccounts = localStorage.getItem('accounts');

    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    }
    if (savedUser) {
      setBridgeUser(JSON.parse(savedUser));
    }
    if (savedAccounts) {
      setAccounts(JSON.parse(savedAccounts));
    }
  }, []);

  // Sauvegarder les transactions à chaque modification
  useEffect(() => {
    if (transactions.length > 0) {
      localStorage.setItem('transactions', JSON.stringify(transactions));
    }
  }, [transactions]);

  // Fonction pour connecter un compte bancaire via Bridge
  const connectBankAccount = async () => {
    try {
      setLoading(true);
      
      // 1. Créer un utilisateur Bridge
      const email = `user-${Date.now()}@test.com`; // Email unique pour chaque test
      console.log('📧 Création utilisateur avec email:', email);
      
      const userData = await bridgeService.createUser(email);
      
      console.log('✅ Utilisateur créé:', userData);
      setBridgeUser(userData.user);
      localStorage.setItem('bridgeUser', JSON.stringify(userData.user));

      // 2. Initialiser Bridge Connect
      if (!window.Bridge) {
        alert('Bridge SDK non chargé. Vérifiez que le script est bien dans index.html');
        setLoading(false);
        return;
      }

      const bridge = window.Bridge({
        clientId: 'sandbox_id_9bdaff1c51f04097ba9b621e5ff75af7', 
        user_uuid: userData.user.uuid,
        
        onSuccess: async (item) => {
          console.log('✅ Connexion bancaire réussie:', item);
          
          // 3. Récupérer les données bancaires
          await loadBankData(userData.user.uuid);
        },
        
        onExit: (error) => {
          console.log('❌ Utilisateur a fermé Bridge:', error);
          setLoading(false);
        }
      });

      bridge.open();
      
    } catch (error) {
      console.error('❌ Erreur connexion bancaire:', error);
      alert('Erreur lors de la connexion bancaire: ' + error.message);
      setLoading(false);
    }
  };

  // Fonction pour charger les données bancaires
  const loadBankData = async (userUuid) => {
    try {
      console.log('🔄 Chargement des données bancaires...');
      
      // Récupérer les comptes
      const accountsData = await bridgeService.getAccounts(userUuid);
      console.log('✅ Comptes récupérés:', accountsData);
      
      const fetchedAccounts = accountsData.resources || [];
      setAccounts(fetchedAccounts);
      localStorage.setItem('accounts', JSON.stringify(fetchedAccounts));

      // Récupérer les transactions
      const transactionsData = await bridgeService.getTransactions(userUuid);
      console.log('✅ Transactions récupérées:', transactionsData);
      
      const fetchedTransactions = transactionsData.resources || [];
      
      // Convertir les transactions Bridge en format de l'app
      const convertedTransactions = fetchedTransactions.map(tx => ({
        id: tx.id,
        date: tx.date,
        description: tx.description || tx.clean_description || 'Transaction',
        amount: Math.abs(tx.amount),
        type: tx.amount < 0 ? 'expense' : 'income',
        category: categorizeTransaction(tx.description || ''),
        source: 'bridge'
      }));

      // Fusionner avec les transactions existantes (manuelles)
      const manualTransactions = transactions.filter(t => t.source !== 'bridge');
      const allTransactions = [...manualTransactions, ...convertedTransactions];
      
      setTransactions(allTransactions);
      setLoading(false);
      
      alert(`✅ ${fetchedAccounts.length} compte(s) et ${convertedTransactions.length} transaction(s) synchronisés !`);
      
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
      alert('Erreur lors du chargement des données bancaires');
      setLoading(false);
    }
  };

  // Fonction pour catégoriser automatiquement une transaction
  const categorizeTransaction = (description) => {
    const desc = description.toLowerCase();
    
    if (desc.includes('supermarché') || desc.includes('carrefour') || desc.includes('auchan')) {
      return 'Alimentation';
    }
    if (desc.includes('uber') || desc.includes('sncf') || desc.includes('essence')) {
      return 'Transport';
    }
    if (desc.includes('loyer') || desc.includes('edf') || desc.includes('eau')) {
      return 'Logement';
    }
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('cinéma')) {
      return 'Loisirs';
    }
    if (desc.includes('pharmacie') || desc.includes('médecin') || desc.includes('hopital')) {
      return 'Santé';
    }
    
    return 'Autres';
  };

  // Fonction pour ajouter une transaction manuelle
  const handleAddTransaction = (e) => {
    e.preventDefault();
    
    const transaction = {
      id: Date.now(),
      ...newTransaction,
      amount: parseFloat(newTransaction.amount),
      source: 'manual'
    };

    setTransactions([...transactions, transaction]);
    
    setNewTransaction({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      type: 'expense',
      category: 'Alimentation'
    });
    
    setShowAddModal(false);
  };

  // Fonction pour supprimer une transaction
  const handleDeleteTransaction = (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer cette transaction ?')) {
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  // Calculs
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  const totalBankBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  // Filtrage des transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'Toutes' || t.category === filterCategory;
    const matchesType = filterType === 'Toutes' || 
      (filterType === 'Revenus' && t.type === 'income') ||
      (filterType === 'Dépenses' && t.type === 'expense');
    
    return matchesSearch && matchesCategory && matchesType;
  });

  // Transactions par catégorie
  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  // Export CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Description', 'Montant', 'Type', 'Catégorie', 'Source'];
    const rows = transactions.map(t => [
      t.date,
      t.description,
      t.amount,
      t.type === 'income' ? 'Revenu' : 'Dépense',
      t.category,
      t.source === 'bridge' ? 'Banque' : 'Manuel'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800">💼 Mon Portefeuille Pro</h1>
            <div className="flex gap-2">
              <button
                onClick={connectBankAccount}
                disabled={loading}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
              >
                <Upload size={20} />
                {loading ? 'Connexion...' : 'Connecter ma banque'}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2"
              >
                <Plus size={20} />
                Ajouter
              </button>
              <button
                onClick={exportToCSV}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-200 flex items-center gap-2"
              >
                <Download size={20} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Info utilisateur Bridge */}
          {bridgeUser && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800">
                ✅ Connecté à Bridge | Email: <strong>{bridgeUser.email}</strong> | 
                UUID: <code className="text-xs">{bridgeUser.uuid}</code>
              </p>
            </div>
          )}

          {/* Comptes bancaires */}
          {accounts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {accounts.map(account => (
                <div key={account.id} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-4">
                  <p className="text-sm opacity-90">{account.name}</p>
                  <p className="text-2xl font-bold">{account.balance?.toFixed(2)} €</p>
                  <p className="text-xs opacity-75">{account.type}</p>
                </div>
              ))}
            </div>
          )}

          {/* Cartes de statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg p-6 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Revenus</p>
                  <p className="text-2xl font-bold">{totalIncome.toFixed(2)} €</p>
                </div>
                <TrendingUp size={32} />
              </div>
            </div>

            <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg p-6 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Dépenses</p>
                  <p className="text-2xl font-bold">{totalExpenses.toFixed(2)} €</p>
                </div>
                <TrendingDown size={32} />
              </div>
            </div>

            <div className={`bg-gradient-to-r ${balance >= 0 ? 'from-blue-500 to-indigo-600' : 'from-orange-500 to-red-600'} text-white rounded-lg p-6 shadow-md`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Solde</p>
                  <p className="text-2xl font-bold">{balance.toFixed(2)} €</p>
                </div>
                <DollarSign size={32} />
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg p-6 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Solde bancaire</p>
                  <p className="text-2xl font-bold">{totalBankBalance.toFixed(2)} €</p>
                </div>
                <DollarSign size={32} />
              </div>
            </div>
          </div>
        </header>

        {/* Filtres */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher une transaction..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Toutes">Toutes les catégories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Toutes">Tous les types</option>
              <option value="Revenus">Revenus</option>
              <option value="Dépenses">Dépenses</option>
            </select>
          </div>
        </div>

        {/* Graphique des dépenses par catégorie */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Dépenses par catégorie</h2>
          <div className="space-y-3">
            {Object.entries(expensesByCategory).map(([category, amount]) => {
              const percentage = (amount / totalExpenses) * 100;
              return (
                <div key={category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{category}</span>
                    <span className="text-gray-600">{amount.toFixed(2)} € ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Liste des transactions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Transactions ({filteredTransactions.length})</h2>
          
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Aucune transaction trouvée</p>
              <p className="text-sm mt-2">Ajoutez une transaction manuellement ou connectez votre banque</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date)).map(transaction => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {transaction.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{transaction.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(transaction.date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag size={14} />
                          {transaction.category}
                        </span>
                        {transaction.source === 'bridge' && (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                            🏦 Banque
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`text-lg font-bold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)} €
                    </span>
                    
                    {transaction.source !== 'bridge' && (
                      <button
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal d'ajout de transaction */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Ajouter une transaction</h3>
            
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Courses au supermarché"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newTransaction.type}
                  onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="expense">Dépense</option>
                  <option value="income">Revenu</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;