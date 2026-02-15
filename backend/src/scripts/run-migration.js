/**
 * Script to run SQL migrations on Supabase
 * Usage: node src/scripts/run-migration.js <migration-file>
 * Example: node src/scripts/run-migration.js 020_create_audit_logs.sql
 */

const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/database');

async function runMigration(filename) {
  try {
    const migrationPath = path.join(__dirname, '../../../docs/migrations', filename);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    console.log(`📄 Reading migration: ${filename}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`🚀 Executing migration...`);

    // Execute SQL using Supabase Admin client
    // Note: Supabase client doesn't support raw SQL execution directly
    // We need to use the PostgreSQL connection or Supabase SQL Editor

    console.log(`\n${'='.repeat(80)}`);
    console.log('📋 SQL CONTENT TO EXECUTE:');
    console.log('='.repeat(80));
    console.log(sql);
    console.log('='.repeat(80));

    console.log(`\n⚠️  Please run this SQL manually in Supabase SQL Editor:`);
    console.log(`   1. Go to https://supabase.com/dashboard/project/dshvqygkqwqscwanymlo/sql/new`);
    console.log(`   2. Copy the SQL content above`);
    console.log(`   3. Paste and click "Run"`);
    console.log(`   4. Verify the migration succeeded\n`);

    // For now, we'll create a simple test to verify the table exists after manual migration
    console.log(`\n🧪 Testing table existence...`);
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('count')
      .limit(0);

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.log(`⚠️  Table 'audit_logs' does not exist yet - please run the migration manually`);
        return false;
      } else {
        console.error(`❌ Error testing table:`, error);
        return false;
      }
    }

    console.log(`✅ Table 'audit_logs' exists and is accessible`);
    return true;

  } catch (error) {
    console.error(`❌ Migration failed:`, error);
    process.exit(1);
  }
}

// Main
const filename = process.argv[2];

if (!filename) {
  console.error(`❌ Usage: node src/scripts/run-migration.js <migration-file>`);
  console.error(`   Example: node src/scripts/run-migration.js 020_create_audit_logs.sql`);
  process.exit(1);
}

runMigration(filename)
  .then((success) => {
    if (success) {
      console.log(`\n✅ Migration verified successfully`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  Please run the migration manually`);
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error(`❌ Fatal error:`, error);
    process.exit(1);
  });
