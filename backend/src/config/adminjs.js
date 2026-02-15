const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const { supabaseAdmin } = require('./database');
const { logAuditEvent } = require('../services/audit.service');

// Configuration des ressources AdminJS personnalisées
// Utilise Supabase Admin client au lieu de PostgreSQL natif

/**
 * Ressource personnalisée pour AdminJS utilisant Supabase
 */
class SupabaseResource {
  constructor(tableName, properties = {}) {
    this.tableName = tableName;
    this.properties = properties;
  }

  async find(filters, options) {
    let query = supabaseAdmin.from(this.tableName).select('*');

    // Pagination
    if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    if (options.limit) query = query.limit(options.limit);

    // Tri
    if (options.sort?.sortBy) {
      query = query.order(options.sort.sortBy, {
        ascending: options.sort.direction === 'asc'
      });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async count(filters) {
    const { count, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  }

  async findOne(id) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findMany(ids) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .in('id', ids);

    if (error) throw error;
    return data || [];
  }

  async create(params) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .insert(params)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, params) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .update(params)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabaseAdmin
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static isAdapterFor(rawResource) {
    return rawResource instanceof SupabaseResource;
  }

  id() {
    return this.tableName;
  }

  properties() {
    return this.properties;
  }

  property(path) {
    return this.properties[path];
  }

  databaseName() {
    return 'supabase';
  }

  databaseType() {
    return 'supabase';
  }
}

// Options de configuration AdminJS
const adminOptions = {
  rootPath: '/admin',
  branding: {
    companyName: 'Bibliotheque Numerique Privee',
    softwareBrothers: false,
    logo: false,
    theme: {
      colors: {
        primary100: '#B5651D',  // Terre d'Afrique
        primary80: '#D4A017',   // Or du Sahel
        primary60: '#2E4057',   // Indigo Adire
        love: '#B5651D',
      },
    },
  },
  locale: {
    language: 'fr',
    translations: {
      fr: {
        labels: {
          loginWelcome: 'Connexion Back-Office',
          navigation: 'Navigation',
        },
        actions: {
          list: 'Liste',
          show: 'Voir',
          edit: 'Modifier',
          delete: 'Supprimer',
          new: 'Nouveau',
          bulkDelete: 'Supprimer selection',
        },
        buttons: {
          save: 'Enregistrer',
          cancel: 'Annuler',
          confirmRemovalMany: 'Confirmer suppression',
          confirmRemovalMany_1: 'Confirmer suppression de {{count}} element',
          confirmRemovalMany_2: 'Confirmer suppression de {{count}} elements',
        },
        messages: {
          successfullyCreated: 'Element cree avec succes',
          successfullyUpdated: 'Element modifie avec succes',
          successfullyDeleted: 'Element supprime avec succes',
        },
        resources: {
          profiles: {
            name: 'Utilisateurs',
            properties: {
              id: 'ID',
              email: 'Email',
              full_name: 'Nom complet',
              role: 'Role',
              is_active: 'Actif',
              created_at: 'Date creation',
              updated_at: 'Date modification',
            },
          },
          subscriptions: {
            name: 'Abonnements',
            properties: {
              id: 'ID',
              user_id: 'ID Utilisateur',
              plan: 'Plan',
              status: 'Statut',
              current_period_end: 'Fin periode',
              created_at: 'Date creation',
            },
          },
          contents: {
            name: 'Contenus',
            properties: {
              id: 'ID',
              title: 'Titre',
              author: 'Auteur',
              content_type: 'Type',
              format: 'Format',
              is_published: 'Publie',
              created_at: 'Date creation',
            },
          },
        },
      },
    },
  },
  resources: [],
  dashboard: {
    component: null,
  },
};

/**
 * Configure les ressources AdminJS avec hooks d'audit
 */
function configureResources(currentAdmin) {
  return [
    {
      resource: new SupabaseResource('profiles', {
        id: { type: 'uuid', isId: true },
        email: { type: 'string' },
        full_name: { type: 'string' },
        role: { type: 'string', availableValues: ['user', 'admin'] },
        is_active: { type: 'boolean' },
        created_at: { type: 'datetime' },
        updated_at: { type: 'datetime' },
      }),
      options: {
        navigation: {
          name: 'Gestion',
          icon: 'User',
        },
        listProperties: ['email', 'full_name', 'role', 'is_active', 'created_at'],
        showProperties: ['id', 'email', 'full_name', 'role', 'is_active', 'created_at', 'updated_at'],
        editProperties: ['email', 'full_name', 'role', 'is_active'],
        filterProperties: ['email', 'full_name', 'role', 'is_active'],
        actions: {
          // Actions read-only pour cette story
          list: { isVisible: true },
          show: { isVisible: true },
          edit: { isVisible: false }, // Sera active dans Story 10.2
          new: { isVisible: false },
          delete: { isVisible: false },
        },
      },
    },
    {
      resource: new SupabaseResource('subscriptions', {
        id: { type: 'uuid', isId: true },
        user_id: { type: 'uuid', reference: 'profiles' },
        plan: { type: 'string' },
        status: { type: 'string' },
        current_period_end: { type: 'datetime' },
        created_at: { type: 'datetime' },
      }),
      options: {
        navigation: {
          name: 'Gestion',
          icon: 'CreditCard',
        },
        listProperties: ['user_id', 'plan', 'status', 'current_period_end', 'created_at'],
        showProperties: ['id', 'user_id', 'plan', 'status', 'current_period_end', 'created_at'],
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          edit: { isVisible: false },
          new: { isVisible: false },
          delete: { isVisible: false },
        },
      },
    },
    {
      resource: new SupabaseResource('contents', {
        id: { type: 'uuid', isId: true },
        title: { type: 'string' },
        author: { type: 'string' },
        content_type: { type: 'string' },
        format: { type: 'string' },
        is_published: { type: 'boolean' },
        created_at: { type: 'datetime' },
      }),
      options: {
        navigation: {
          name: 'Contenu',
          icon: 'Book',
        },
        listProperties: ['title', 'author', 'content_type', 'format', 'is_published', 'created_at'],
        showProperties: ['id', 'title', 'author', 'content_type', 'format', 'is_published', 'created_at'],
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          edit: { isVisible: false },
          new: { isVisible: false },
          delete: { isVisible: false },
        },
      },
    },
  ];
}

module.exports = {
  adminOptions,
  configureResources,
  SupabaseResource,
};
