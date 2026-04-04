/**
 * AdminJS Supabase REST Adapter
 * Connects AdminJS to Supabase via REST API (no DATABASE_URL needed)
 *
 * Implements AdminJS's BaseResource, BaseDatabase, BaseProperty interfaces
 */

const AdminJSModule = require('adminjs');
const { BaseResource, BaseDatabase, BaseProperty, BaseRecord } = AdminJSModule;
const { supabaseAdmin } = require('../config/database');

// ─── Table Schemas ───────────────────────────────────────────────────────────
// Define column schemas for each table exposed in the admin panel

const TABLE_SCHEMAS = {
  profiles: [
    { path: 'id', type: 'id', isId: true },
    { path: 'email', type: 'string', isTitle: true, isRequired: true },
    { path: 'password', type: 'password', isVirtual: true },
    { path: 'full_name', type: 'string' },
    { path: 'role', type: 'string' },
    { path: 'is_active', type: 'boolean' },
    { path: 'avatar_url', type: 'string' },
    { path: 'onboarding_completed', type: 'boolean' },
    { path: 'analytics_consent', type: 'boolean' },
    { path: 'created_at', type: 'datetime', isEditable: false },
    { path: 'updated_at', type: 'datetime', isEditable: false },
  ],
  subscriptions: [
    { path: 'id', type: 'id', isId: true },
    { path: 'user_id', type: 'reference', reference: 'profiles' },
    { path: 'plan_id', type: 'reference', reference: 'subscription_plans' },
    { path: 'plan_type', type: 'string' },
    { path: 'amount', type: 'number' },
    { path: 'currency', type: 'string' },
    { path: 'status', type: 'string' },
    { path: 'provider', type: 'string' },
    { path: 'provider_subscription_id', type: 'string' },
    { path: 'provider_customer_id', type: 'string' },
    { path: 'current_period_start', type: 'datetime' },
    { path: 'current_period_end', type: 'datetime' },
    { path: 'cancel_at_period_end', type: 'boolean' },
    { path: 'cancelled_at', type: 'datetime' },
    { path: 'users_limit', type: 'number' },
    { path: 'metadata', type: 'mixed' },
    { path: 'plan_snapshot', type: 'mixed' },
    { path: 'created_at', type: 'datetime', isEditable: false },
    { path: 'updated_at', type: 'datetime', isEditable: false },
  ],
  contents: [
    { path: 'id', type: 'id', isId: true },
    { path: 'title', type: 'string', isTitle: true, isRequired: true },
    { path: 'author', type: 'string', isRequired: true },
    { path: 'description', type: 'textarea' },
    { path: 'content_type', type: 'string', isRequired: true },
    { path: 'format', type: 'string' },
    { path: 'language', type: 'string', isRequired: true },
    { path: 'cover_url', type: 'string' },
    { path: 'file_key', type: 'string' },
    { path: 'file_size_bytes', type: 'number' },
    { path: 'duration_seconds', type: 'number' },
    { path: 'rights_holder_id', type: 'string' },
    { path: 'is_published', type: 'boolean' },
    { path: 'published_at', type: 'datetime' },
    { path: 'access_type', type: 'string' },
    { path: 'is_purchasable', type: 'boolean' },
    { path: 'price_cents', type: 'number' },
    { path: 'price_currency', type: 'string' },
    { path: 'subscription_discount_percent', type: 'number' },
    { path: 'created_at', type: 'datetime', isEditable: false },
    { path: 'updated_at', type: 'datetime', isEditable: false },
    { path: 'deleted_at', type: 'datetime', isEditable: false },
  ],
  content_categories: [
    { path: 'id', type: 'id', isId: true, isVirtual: true }, // composite: content_id::category_id
    { path: 'content_id', type: 'reference', reference: 'contents' },
    { path: 'category_id', type: 'reference', reference: 'categories' },
  ],
  audit_logs: [
    { path: 'id', type: 'id', isId: true },
    { path: 'admin_id', type: 'reference', reference: 'profiles' },
    { path: 'action', type: 'string' },
    { path: 'resource', type: 'string', isTitle: true },
    { path: 'resource_id', type: 'string' },
    { path: 'details', type: 'mixed' },
    { path: 'ip_address', type: 'string' },
    { path: 'user_agent', type: 'string' },
    { path: 'created_at', type: 'datetime', isEditable: false },
  ],
  categories: [
    { path: 'id', type: 'id', isId: true },
    { path: 'name', type: 'string', isTitle: true },
    { path: 'slug', type: 'string' },
    { path: 'description', type: 'textarea' },
    { path: 'created_at', type: 'datetime', isEditable: false },
  ],
  reading_history: [
    { path: 'id', type: 'id', isId: true },
    { path: 'user_id', type: 'reference', reference: 'profiles' },
    { path: 'content_id', type: 'reference', reference: 'contents' },
    { path: 'progress_percent', type: 'number' },
    { path: 'last_position', type: 'string' },
    { path: 'total_time_seconds', type: 'number' },
    { path: 'is_completed', type: 'boolean' },
    { path: 'started_at', type: 'datetime', isEditable: false },
    { path: 'last_read_at', type: 'datetime', isEditable: false },
    { path: 'completed_at', type: 'datetime' },
    { path: 'created_at', type: 'datetime', isEditable: false },
    { path: 'updated_at', type: 'datetime', isEditable: false },
  ],
  content_unlocks: [
    { path: 'id', type: 'id', isId: true },
    { path: 'user_id', type: 'reference', reference: 'profiles' },
    { path: 'content_id', type: 'reference', reference: 'contents' },
    { path: 'source', type: 'string' },
    { path: 'base_price_cents', type: 'number' },
    { path: 'paid_amount_cents', type: 'number' },
    { path: 'currency', type: 'string' },
    { path: 'discount_applied_percent', type: 'number' },
    { path: 'unlocked_at', type: 'datetime', isEditable: false },
  ],
  rights_holders: [
    { path: 'id', type: 'id', isId: true },
    { path: 'name', type: 'string', isTitle: true, isRequired: true },
    { path: 'email', type: 'string' },
    { path: 'website', type: 'string' },
    { path: 'created_at', type: 'datetime', isEditable: false },
    { path: 'updated_at', type: 'datetime', isEditable: false },
  ],
  payments: [
    { path: 'id',                   type: 'id',        isId: true },
    { path: 'user_id',              type: 'reference', reference: 'profiles', isTitle: true },
    { path: 'subscription_id',      type: 'reference', reference: 'subscriptions' },
    { path: 'amount',               type: 'number' },
    { path: 'currency',             type: 'string' },
    { path: 'status',               type: 'string' },
    { path: 'provider',             type: 'string' },
    { path: 'provider_payment_id',  type: 'string' },
    { path: 'payment_method',       type: 'string' },
    { path: 'metadata',             type: 'mixed' },
    { path: 'error_message',        type: 'string' },
    { path: 'paid_at',              type: 'datetime', isEditable: false },
    { path: 'failed_at',            type: 'datetime', isEditable: false },
    { path: 'created_at',           type: 'datetime', isEditable: false },
    { path: 'updated_at',           type: 'datetime', isEditable: false },
  ],
  app_settings: [
    { path: 'id', type: 'id', isId: true },
    // Company
    { path: 'company_name',    type: 'string',   isTitle: true },
    { path: 'company_tagline', type: 'string' },
    { path: 'company_address', type: 'string' },
    { path: 'company_email',   type: 'string' },
    { path: 'company_website', type: 'string' },
    { path: 'company_phone',   type: 'string' },
    { path: 'company_vat_id',  type: 'string' },
    // Invoice
    { path: 'invoice_prefix',        type: 'string' },
    { path: 'invoice_footer_text',   type: 'textarea' },
    { path: 'invoice_primary_color', type: 'string' },
    { path: 'invoice_accent_color',  type: 'string' },
    { path: 'invoice_logo_url',      type: 'string' },
    { path: 'invoice_notes',         type: 'textarea' },
    // Meta
    { path: 'updated_by', type: 'reference', reference: 'profiles', isEditable: false },
    { path: 'updated_at', type: 'datetime',  isEditable: false },
  ],
  subscription_plans: [
    { path: 'id', type: 'id', isId: true },
    { path: 'slug', type: 'string' },
    { path: 'display_name', type: 'string', isTitle: true },
    { path: 'description', type: 'textarea' },
    { path: 'is_active', type: 'boolean' },
    { path: 'duration_days', type: 'number' },
    { path: 'base_price_cents', type: 'number' },
    { path: 'currency', type: 'string' },
    { path: 'included_users', type: 'number' },
    { path: 'extra_user_price_cents', type: 'number' },
    { path: 'text_quota_per_user', type: 'number' },
    { path: 'audio_quota_per_user', type: 'number' },
    { path: 'paid_books_discount_percent', type: 'number' },
    { path: 'bonus_trigger', type: 'string' },
    { path: 'bonus_type', type: 'string' },
    { path: 'bonus_quantity_per_user', type: 'number' },
    { path: 'bonus_validity_days', type: 'number' },
    { path: 'metadata', type: 'mixed' },
    { path: 'created_at', type: 'datetime', isEditable: false },
    { path: 'updated_at', type: 'datetime', isEditable: false },
  ],
  promo_codes: [
    { path: 'id',                   type: 'id',       isId: true },
    { path: 'code',                 type: 'string',   isTitle: true, isRequired: true },
    { path: 'description',          type: 'textarea' },
    { path: 'discount_type',        type: 'string',   isRequired: true },
    { path: 'discount_value',       type: 'number',   isRequired: true },
    { path: 'max_uses',             type: 'number' },
    { path: 'used_count',           type: 'number',   isEditable: false },
    { path: 'valid_from',           type: 'datetime' },
    { path: 'valid_until',          type: 'datetime' },
    { path: 'applicable_plans',     type: 'mixed' },
    { path: 'is_active',            type: 'boolean' },
    { path: 'created_at',           type: 'datetime', isEditable: false },
    { path: 'updated_at',           type: 'datetime', isEditable: false },
    // Champs virtuels enrichis (show view uniquement)
    { path: '__status',             type: 'string',   isEditable: false, isVirtual: true },
    { path: '__remaining_uses',     type: 'string',   isEditable: false, isVirtual: true },
    { path: '__total_discount_eur', type: 'string',   isEditable: false, isVirtual: true },
    { path: '__recent_usages',      type: 'textarea', isEditable: false, isVirtual: true },
  ],
  promo_code_usages: [
    { path: 'id',               type: 'id',       isId: true },
    { path: 'promo_code_id',    type: 'reference', reference: 'promo_codes' },
    { path: 'user_id',          type: 'reference', reference: 'profiles', isTitle: true },
    { path: 'subscription_id',  type: 'reference', reference: 'subscriptions' },
    { path: 'discount_applied', type: 'number' },
    { path: 'used_at',          type: 'datetime', isEditable: false },
  ],
  publishers: [
    { path: 'id',               type: 'id', isId: true },
    { path: 'user_id',          type: 'string' },
    { path: 'company_name',     type: 'string', isTitle: true, isRequired: true },
    { path: 'contact_name',     type: 'string', isRequired: true },
    { path: 'email',            type: 'string', isRequired: true },
    { path: 'description',      type: 'textarea' },
    { path: 'status',           type: 'string' },
    { path: 'revenue_grid',     type: 'mixed' },
    { path: 'payout_method',    type: 'mixed' },
    { path: 'invitation_token', type: 'string', isEditable: false },
    { path: 'token_expires_at', type: 'datetime', isEditable: false },
    { path: 'activated_at',     type: 'datetime', isEditable: false },
    { path: 'created_at',       type: 'datetime', isEditable: false },
    { path: 'updated_at',       type: 'datetime', isEditable: false },
  ],
  publisher_books: [
    { path: 'id',                 type: 'id', isId: true },
    { path: 'publisher_id',       type: 'string', isRequired: true },
    { path: 'content_id',         type: 'string', isRequired: true },
    { path: 'validation_status',  type: 'string' },
    { path: 'rejection_reason',   type: 'textarea' },
    { path: 'reviewed_by',        type: 'string' },
    { path: 'submitted_at',       type: 'datetime', isEditable: false },
    { path: 'reviewed_at',        type: 'datetime', isEditable: false },
  ],
  publisher_revenue: [
    { path: 'id',                   type: 'id', isId: true },
    { path: 'publisher_id',         type: 'string' },
    { path: 'content_id',           type: 'string' },
    { path: 'payment_id',           type: 'string' },
    { path: 'sale_type',            type: 'string' },
    { path: 'sale_amount_cad',      type: 'number' },
    { path: 'publisher_amount_cad', type: 'number' },
    { path: 'payout_id',            type: 'string' },
    { path: 'created_at',           type: 'datetime', isEditable: false },
  ],
  publisher_payouts: [
    { path: 'id',             type: 'id', isId: true },
    { path: 'publisher_id',   type: 'string', isRequired: true },
    { path: 'amount_cad',     type: 'number' },
    { path: 'status',         type: 'string' },
    { path: 'period_start',   type: 'datetime' },
    { path: 'period_end',     type: 'datetime' },
    { path: 'notes',          type: 'textarea' },
    { path: 'paid_at',        type: 'datetime' },
    { path: 'created_at',     type: 'datetime', isEditable: false },
    { path: 'updated_at',     type: 'datetime', isEditable: false },
  ],
};

// ─── SupabaseProperty ────────────────────────────────────────────────────────

class SupabaseProperty extends BaseProperty {
  constructor(def) {
    super({ path: def.path, type: def.type, isId: def.isId || false });
    this._def = def;
  }

  isEditable() {
    if (this._def.isId) return false;
    if (this._def.isEditable === false) return false;
    return true;
  }

  isId() { return !!this._def.isId; }
  isTitle() { return !!this._def.isTitle; }
  isSortable() { return true; }
  isRequired() { return !!this._def.isRequired; }
  isArray() { return false; }

  reference() { return this._def.reference || null; }

  availableValues() { return this._def.availableValues || null; }
}

// ─── SupabaseResource ────────────────────────────────────────────────────────

class SupabaseResource extends BaseResource {
  // Composite key definitions for tables without a single 'id' column
  static COMPOSITE_KEYS = {
    content_categories: ['content_id', 'category_id'],
  };

  constructor(tableName) {
    super(tableName);
    this._tableName = tableName;
    this._schema = TABLE_SCHEMAS[tableName] || [];
    this._properties = this._schema.map(def => new SupabaseProperty(def));
    this._compositeKey = SupabaseResource.COMPOSITE_KEYS[tableName] || null;
  }

  static isAdapterFor(rawResource) {
    return typeof rawResource === 'string' && TABLE_SCHEMAS[rawResource];
  }

  databaseName() { return 'supabase'; }
  databaseType() { return 'Supabase REST'; }
  id() { return this._tableName; }
  name() { return this._tableName; }

  properties() { return this._properties; }

  property(path) {
    return this._properties.find(p => p.path() === path) || null;
  }

  async count(filter) {
    try {
      let query = supabaseAdmin
        .from(this._tableName)
        .select('*', { count: 'exact', head: true });

      query = this._applyFilters(query, filter);

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error(`AdminJS count error (${this._tableName}):`, err.message);
      return 0;
    }
  }

  async find(filter, options = {}) {
    try {
      let query = supabaseAdmin.from(this._tableName).select('*');

      query = this._applyFilters(query, filter);

      // Sort
      if (options.sort && options.sort.sortBy) {
        query = query.order(options.sort.sortBy, {
          ascending: options.sort.direction === 'asc',
        });
      } else if (this._schema.some(s => s.path === 'created_at')) {
        query = query.order('created_at', { ascending: false });
      } else if (this._compositeKey) {
        query = query.order(this._compositeKey[0], { ascending: true });
      }

      // Pagination
      const limit = options.limit || 10;
      const offset = options.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(row => {
        // Inject composite id for tables without a single 'id' column
        if (this._compositeKey) {
          row.id = this._compositeKey.map(k => row[k]).join('::');
        }
        return new BaseRecord(row, this);
      });
    } catch (err) {
      console.error(`AdminJS find error (${this._tableName}):`, err.message);
      return [];
    }
  }

  /**
   * Parse a composite id (e.g. "uuid1::uuid2") into filter conditions
   */
  _parseCompositeId(id) {
    if (!this._compositeKey) return null;
    const parts = id.split('::');
    if (parts.length !== this._compositeKey.length) return null;
    const conditions = {};
    this._compositeKey.forEach((key, i) => { conditions[key] = parts[i]; });
    return conditions;
  }

  async findOne(id) {
    try {
      let query = supabaseAdmin.from(this._tableName).select('*');

      const composite = this._parseCompositeId(id);
      if (composite) {
        for (const [key, val] of Object.entries(composite)) {
          query = query.eq(key, val);
        }
      } else {
        query = query.eq('id', id);
      }

      const { data, error } = await query.single();
      if (error) throw error;

      // Inject composite id
      if (this._compositeKey) {
        data.id = this._compositeKey.map(k => data[k]).join('::');
      }
      return new BaseRecord(data, this);
    } catch (err) {
      console.error(`AdminJS findOne error (${this._tableName}):`, err.message);
      return null;
    }
  }

  async findMany(ids) {
    try {
      const { data, error } = await supabaseAdmin
        .from(this._tableName)
        .select('*')
        .in('id', ids);

      if (error) throw error;
      return (data || []).map(row => new BaseRecord(row, this));
    } catch (err) {
      console.error(`AdminJS findMany error (${this._tableName}):`, err.message);
      return [];
    }
  }

  async create(params) {
    try {
      const cleanParams = this._cleanParams(params);

      // For profiles: trigger handle_new_user() may have already created the row
      // Use upsert to handle this gracefully
      if (this._tableName === 'profiles' && params.id) {
        cleanParams.id = params.id;
        const { data, error } = await supabaseAdmin
          .from(this._tableName)
          .upsert(cleanParams, { onConflict: 'id' })
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      const { data, error } = await supabaseAdmin
        .from(this._tableName)
        .insert(cleanParams)
        .select()
        .single();

      if (error) throw error;

      // Inject composite id for tables without 'id' column
      if (this._compositeKey && data) {
        data.id = this._compositeKey.map(k => data[k]).join('::');
      }
      return data;
    } catch (err) {
      console.error(`AdminJS create error (${this._tableName}):`, err.message);
      throw err;
    }
  }

  async update(id, params) {
    try {
      const cleanParams = this._cleanParams(params);
      const { data, error } = await supabaseAdmin
        .from(this._tableName)
        .update(cleanParams)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error(`AdminJS update error (${this._tableName}):`, err.message);
      throw err;
    }
  }

  async delete(id) {
    try {
      let query = supabaseAdmin.from(this._tableName).delete();

      const composite = this._parseCompositeId(id);
      if (composite) {
        for (const [key, val] of Object.entries(composite)) {
          query = query.eq(key, val);
        }
      } else {
        query = query.eq('id', id);
      }

      const { error } = await query;
      if (error) throw error;
    } catch (err) {
      console.error(`AdminJS delete error (${this._tableName}):`, err.message);
      throw err;
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────

  _applyFilters(query, filter) {
    if (!filter || !filter.filters) return query;

    for (const [key, filterObj] of Object.entries(filter.filters)) {
      const value = filterObj.value;
      if (value === undefined || value === null || value === '') continue;

      // Virtual search field: OR across multiple columns
      if (key === '__search') {
        if (this._tableName === 'profiles') {
          query = query.or(`email.ilike.%${value}%,full_name.ilike.%${value}%`);
        } else if (this._tableName === 'contents') {
          query = query.or(`title.ilike.%${value}%,author.ilike.%${value}%`);
        }
        continue;
      }

      const prop = this.property(key);
      const type = prop ? prop.type() : 'string';

      if (type === 'boolean') {
        query = query.eq(key, value === 'true' || value === true);
      } else if (type === 'number' || type === 'float') {
        query = query.eq(key, Number(value));
      } else if (type === 'reference' || type === 'id') {
        query = query.eq(key, value);
      } else {
        // String: use ilike for partial match
        query = query.ilike(key, `%${value}%`);
      }
    }

    return query;
  }

  _cleanParams(params) {
    const clean = {};
    const editableProps = this._schema
      .filter(def => !def.isId && def.isEditable !== false && !def.isVirtual)
      .map(def => def.path);

    for (const key of editableProps) {
      if (key in params) {
        clean[key] = params[key];
      }
    }
    return clean;
  }
}

// ─── SupabaseDatabase ────────────────────────────────────────────────────────

class SupabaseDatabase extends BaseDatabase {
  constructor(tableNames) {
    super(tableNames);
    this._tableNames = tableNames;
    this._resources = tableNames.map(name => new SupabaseResource(name));
  }

  static isAdapterFor(rawResource) {
    return Array.isArray(rawResource) && rawResource.every(t => TABLE_SCHEMAS[t]);
  }

  resources() { return this._resources; }
}

module.exports = {
  SupabaseDatabase,
  SupabaseResource,
  SupabaseProperty,
  TABLE_SCHEMAS,
};
