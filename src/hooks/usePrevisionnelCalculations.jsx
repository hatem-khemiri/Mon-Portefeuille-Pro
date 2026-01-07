import { useMemo } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { MONTHS } from '../utils/constants';
import { isCategorieSortie } from '../utils/calculations';

export const usePrevisionnelCalculations = () => {
  const { 
    chargesFixes, 
    comptes,
    categoriesRevenus,
    categoriesDepenses,
    categoriesEpargnes,
    budgetPrevisionnel 
  } = useFinance();

  const calculerPrevisionnelAutomatique = () => {
    const previsionnel = {
      revenus: Array(12).fill(0),
      epargnes: Array(12).fill(0),
      factures: Array(12).fill(0),
      depenses: Array(12).fill(0)
    };

    chargesFixes.forEach(charge => {
      for (let mois = 0; mois < 12; mois++) {
        let inclure = true;
        
        if (charge.frequence === 'trimestrielle' && mois % 3 !== 0) {
          inclure = false;
        }
        if (charge.frequence === 'annuelle' && mois !== 0) {
          inclure = false;
        }
        
        if (inclure) {
          const montant = Math.abs(charge.montant);
          
          if (charge.type === 'transfert') {
            const compteDestination = comptes.find(c => c.nom === charge.compteDestination);
            if (compteDestination && compteDestination.type === 'epargne') {
              previsionnel.epargnes[mois] += montant;
            }
          } else if (charge.montant > 0) {
            previsionnel.revenus[mois] += montant;
          } else {
            if (charge.categorie === 'Factures' || categoriesDepenses.includes(charge.categorie)) {
              if (charge.categorie === 'Factures') {
                previsionnel.factures[mois] += montant;
              } else {
                previsionnel.depenses[mois] += montant;
              }
            } else {
              previsionnel.depenses[mois] += montant;
            }
          }
        }
      }
    });

    return previsionnel;
  };

  const previsionnelData = useMemo(() => {
    return MONTHS.map((month, idx) => {
      let soldeCumule = 0;
      let epargnesCumulees = 0;
      
      for (let i = 0; i <= idx; i++) {
        soldeCumule += budgetPrevisionnel.revenus[i] - 
                       budgetPrevisionnel.epargnes[i] - 
                       budgetPrevisionnel.factures[i] - 
                       budgetPrevisionnel.depenses[i];
        epargnesCumulees += budgetPrevisionnel.epargnes[i];
      }
      
      return {
        mois: month,
        revenus: budgetPrevisionnel.revenus[idx],
        epargnes: budgetPrevisionnel.epargnes[idx],
        epargnesCumulees: epargnesCumulees,
        factures: budgetPrevisionnel.factures[idx],
        depenses: budgetPrevisionnel.depenses[idx],
        soldeMensuel: budgetPrevisionnel.revenus[idx] - 
                      budgetPrevisionnel.epargnes[idx] - 
                      budgetPrevisionnel.factures[idx] - 
                      budgetPrevisionnel.depenses[idx],
        solde: soldeCumule
      };
    });
  }, [budgetPrevisionnel]);

  return {
    calculerPrevisionnelAutomatique,
    previsionnelData
  };
};