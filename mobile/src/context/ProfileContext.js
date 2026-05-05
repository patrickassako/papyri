/**
 * ProfileContext — état global du profil famille actif.
 *
 * Équivalent mobile de profileStorage.js (web) :
 * - Le web broadcast avec window.dispatchEvent('papyri:profile-changed')
 * - Le mobile broadcast via React Context (activeProfile state partagé)
 *
 * Les écrans abonnés rechargent leurs données quand activeProfile.id change.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getActiveProfile,
  saveActiveProfile,
  clearActiveProfile,
} from '../services/family.service';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [activeProfile, setActiveProfileState] = useState(null);
  // true une fois que AsyncStorage a été lu au démarrage
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    getActiveProfile()
      .then((profile) => setActiveProfileState(profile || null))
      .finally(() => setProfileLoaded(true));
  }, []);

  /**
   * Sélectionner un profil : sauvegarde AsyncStorage + notifie tous les abonnés.
   */
  const switchProfile = async (profile) => {
    await saveActiveProfile(profile);
    setActiveProfileState(profile);
  };

  /**
   * Effacer le profil actif (retour au compte principal).
   */
  const clearProfile = async () => {
    await clearActiveProfile();
    setActiveProfileState(null);
  };

  /**
   * True si aucun profil actif (compte solo) OU si le profil actif est le profil principal.
   * Sert à autoriser les sections owner-only : abonnement, préférences, gestion famille.
   */
  const isOwnerContext = !activeProfile || Boolean(activeProfile?.is_owner_profile);

  return (
    <ProfileContext.Provider value={{ activeProfile, switchProfile, clearProfile, profileLoaded, isOwnerContext }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
