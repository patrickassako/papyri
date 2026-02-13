-- Migration 001: Fix Users Insert Policy
-- Description: Ajoute une politique d'insertion pour permettre l'inscription publique
-- Dependencies: 000_initial_schema.sql
-- Created: 2026-02-07

-- Politique d'insertion pour les nouveaux utilisateurs (inscription publique)
-- Permet à tout le monde de créer un compte (pas besoin d'être authentifié pour s'inscrire)
CREATE POLICY "Allow public user registration" ON users
  FOR INSERT
  WITH CHECK (true);

-- Commentaire
COMMENT ON POLICY "Allow public user registration" ON users IS
  'Permet l''inscription publique de nouveaux utilisateurs via l''API backend';
