// API Configuration for Mobile
// Pour tester sur émulateur : localhost
// Pour tester sur device physique : remplacer par l'IP de votre machine

// Android Emulator : 10.0.2.2:3001 (redirige vers localhost de l'hôte)
// iOS Simulator : localhost:3001
// Device physique : 192.168.x.x:3001 (IP de votre machine sur le réseau local)

const API_BASE_URL = __DEV__
  ? 'http://192.168.8.108:3001' // Development - IP de votre Mac sur le réseau local
  : 'https://api.votre-domaine.com'; // Production (à configurer plus tard)

export default API_BASE_URL;
