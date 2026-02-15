/**
 * Audit Trail Service - AdminJS Epic 10
 * Logs all admin actions to audit_logs table
 */

const { supabaseAdmin } = require('../config/database');

/**
 * Log an audit event
 * @param {string} adminId - UUID of admin user
 * @param {string} action - Action type: 'create', 'update', 'delete', 'login', 'logout', 'export', 'custom'
 * @param {string} resource - Resource name: 'users', 'profiles', 'contents', 'subscriptions', etc.
 * @param {string|null} resourceId - UUID of affected resource (optional for bulk operations)
 * @param {object} details - Additional context (before/after values, filters, etc.)
 * @param {object} metadata - Optional: ip_address, user_agent
 * @returns {Promise<void>}
 */
async function logAuditEvent(adminId, action, resource, resourceId = null, details = {}, metadata = {}) {
  try {
    // Validate required fields
    if (!adminId || !action || !resource) {
      console.error('Audit log error: Missing required fields (adminId, action, or resource)');
      return;
    }

    // Validate action type
    const validActions = ['create', 'update', 'delete', 'login', 'logout', 'export', 'custom'];
    if (!validActions.includes(action)) {
      console.warn(`Audit log warning: Invalid action type '${action}', defaulting to 'custom'`);
      action = 'custom';
    }

    // Prepare audit log entry
    const auditEntry = {
      admin_id: adminId,
      action,
      resource,
      resource_id: resourceId,
      details: details || {},
      ip_address: metadata.ip_address || null,
      user_agent: metadata.user_agent || null,
    };

    // Insert into audit_logs table
    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert(auditEntry);

    if (error) {
      console.error('Failed to insert audit log:', error);
      // Don't throw - audit logging should not block the main operation
      return;
    }

    console.log(`✅ Audit: ${action} on ${resource}${resourceId ? ` (${resourceId})` : ''} by admin ${adminId}`);

  } catch (error) {
    console.error('Audit service error:', error);
    // Don't throw - audit logging should be resilient and not crash the app
  }
}

/**
 * Log admin login
 * @param {string} adminId
 * @param {string} email
 * @param {object} metadata - ip_address, user_agent
 */
async function logAdminLogin(adminId, email, metadata = {}) {
  await logAuditEvent(
    adminId,
    'login',
    'admin_session',
    null,
    { email, timestamp: new Date().toISOString() },
    metadata
  );
}

/**
 * Log admin logout
 * @param {string} adminId
 * @param {object} metadata
 */
async function logAdminLogout(adminId, metadata = {}) {
  await logAuditEvent(
    adminId,
    'logout',
    'admin_session',
    null,
    { timestamp: new Date().toISOString() },
    metadata
  );
}

/**
 * Log resource creation
 * @param {string} adminId
 * @param {string} resource
 * @param {string} resourceId
 * @param {object} data - The created resource data
 * @param {object} metadata
 */
async function logResourceCreated(adminId, resource, resourceId, data = {}, metadata = {}) {
  await logAuditEvent(
    adminId,
    'create',
    resource,
    resourceId,
    { after: data },
    metadata
  );
}

/**
 * Log resource update
 * @param {string} adminId
 * @param {string} resource
 * @param {string} resourceId
 * @param {object} before - Data before update
 * @param {object} after - Data after update
 * @param {object} metadata
 */
async function logResourceUpdated(adminId, resource, resourceId, before = {}, after = {}, metadata = {}) {
  await logAuditEvent(
    adminId,
    'update',
    resource,
    resourceId,
    { before, after },
    metadata
  );
}

/**
 * Log resource deletion
 * @param {string} adminId
 * @param {string} resource
 * @param {string} resourceId
 * @param {object} data - The deleted resource data
 * @param {object} metadata
 */
async function logResourceDeleted(adminId, resource, resourceId, data = {}, metadata = {}) {
  await logAuditEvent(
    adminId,
    'delete',
    resource,
    resourceId,
    { before: data },
    metadata
  );
}

/**
 * Log bulk operations
 * @param {string} adminId
 * @param {string} action - 'create' | 'update' | 'delete'
 * @param {string} resource
 * @param {number} count - Number of affected resources
 * @param {object} filters - Filters applied
 * @param {object} metadata
 */
async function logBulkOperation(adminId, action, resource, count, filters = {}, metadata = {}) {
  await logAuditEvent(
    adminId,
    action,
    resource,
    null,
    { bulk: true, count, filters },
    metadata
  );
}

/**
 * Log data export
 * @param {string} adminId
 * @param {string} resource
 * @param {object} filters
 * @param {string} format - 'csv' | 'json' | 'excel'
 * @param {number} rowCount
 * @param {object} metadata
 */
async function logDataExport(adminId, resource, filters = {}, format = 'csv', rowCount = 0, metadata = {}) {
  await logAuditEvent(
    adminId,
    'export',
    resource,
    null,
    { format, rowCount, filters },
    metadata
  );
}

/**
 * Get audit logs for a specific admin
 * @param {string} adminId
 * @param {object} options - { limit, offset, startDate, endDate, action, resource }
 * @returns {Promise<Array>}
 */
async function getAuditLogs(adminId, options = {}) {
  try {
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (options.action) query = query.eq('action', options.action);
    if (options.resource) query = query.eq('resource', options.resource);
    if (options.startDate) query = query.gte('created_at', options.startDate);
    if (options.endDate) query = query.lte('created_at', options.endDate);

    // Apply pagination
    if (options.limit) query = query.limit(options.limit);
    if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('Get audit logs error:', error);
    return [];
  }
}

/**
 * Get recent audit logs (all admins)
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getRecentAuditLogs(limit = 100) {
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent audit logs:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('Get recent audit logs error:', error);
    return [];
  }
}

/**
 * Get audit statistics
 * @param {string} adminId - Optional: filter by admin
 * @param {object} dateRange - { startDate, endDate }
 * @returns {Promise<object>}
 */
async function getAuditStats(adminId = null, dateRange = {}) {
  try {
    let query = supabaseAdmin
      .from('audit_logs')
      .select('action, resource, created_at');

    if (adminId) query = query.eq('admin_id', adminId);
    if (dateRange.startDate) query = query.gte('created_at', dateRange.startDate);
    if (dateRange.endDate) query = query.lte('created_at', dateRange.endDate);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit stats:', error);
      return {};
    }

    // Calculate statistics
    const stats = {
      total: data.length,
      byAction: {},
      byResource: {},
      byDate: {},
    };

    data.forEach(log => {
      // By action
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

      // By resource
      stats.byResource[log.resource] = (stats.byResource[log.resource] || 0) + 1;

      // By date
      const date = log.created_at.split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;
    });

    return stats;

  } catch (error) {
    console.error('Get audit stats error:', error);
    return {};
  }
}

module.exports = {
  // Core function
  logAuditEvent,

  // Convenience functions
  logAdminLogin,
  logAdminLogout,
  logResourceCreated,
  logResourceUpdated,
  logResourceDeleted,
  logBulkOperation,
  logDataExport,

  // Query functions
  getAuditLogs,
  getRecentAuditLogs,
  getAuditStats,
};
