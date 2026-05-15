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
import { DeviceEventEmitter } from 'react-native';
import {
  getActiveProfile,
  saveActiveProfile,
  clearActiveProfile,
} from '../services/family.service';
import { AUTH_LOST_EVENT } from '../services/auth.service';

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

  // The provider sits above the navigator, so it survives the navigation
  // reset that happens on logout. Without this listener the in-memory
  // activeProfile (name, avatar…) would leak into the next account that
  // signs in. Reset it whenever the session is lost.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTH_LOST_EVENT, () => {
      setActiveProfileState(null);
    });
    return () => sub.remove();
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
