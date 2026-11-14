import dotenv from 'dotenv'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { developmentDatabaseTarget } from './lib/database-target.mjs'

// Narrow, repeatable fixture for the Aurora development preview; never production.
dotenv.config({ path: ['.env.local', '.env'], quiet: true })
if (process.env.NODE_ENV === 'production') throw new Error('Development fixture only')
const target = developmentDatabaseTarget(process.env)
const connection = new URL(target.databaseUrl)
connection.searchParams.delete('sslmode')
const pool = new pg.Pool({
  connectionString: connection.href,
  ssl: { rejectUnauthorized: true, ca: readFileSync(new URL('./ops/fixtures/supabase-prod-ca.crt', import.meta.url), 'utf8') },
  max: 1,
  connectionTimeoutMillis: 10000,
})
const client = await pool.connect()
try {
  await client.query('BEGIN')
  const tenant = await client.query("SELECT id FROM tenants WHERE slug = 'aurora'")
  if (tenant.rowCount !== 1) throw new Error('Expected exactly one Aurora development tenant')
  if (process.argv.includes('--apply')) {
    // Fictional US demo identity, including a reserved 555-01xx phone number.
    const result = await client.query(`UPDATE tenant_settings SET
      phone = $2, whatsapp = NULL, instagram = $3, address = $4,
      city = $5, region = $6, postal_code = $7, country = $8,
      currency = $9, latitude = NULL, longitude = NULL,
      whatsapp_orders_enabled = false
      WHERE tenant_id = $1`, [tenant.rows[0].id, '+16175550142', 'aurora.kitchen.demo',
      '125 Harbor Street, Boston, MA 02110, USA', 'Boston', 'MA', '02110', 'US', 'USD'])
    if (result.rowCount !== 1) throw new Error('Expected exactly one Aurora settings row')
  }
  const result = await client.query(`SELECT phone, whatsapp, instagram, address,
    city, region, postal_code, country, currency, whatsapp_orders_enabled
    FROM tenant_settings WHERE tenant_id = $1`, [tenant.rows[0].id])
  await client.query(process.argv.includes('--apply') ? 'COMMIT' : 'ROLLBACK')
  console.log(JSON.stringify({ applied: process.argv.includes('--apply'), demo: result.rows[0] }, null, 2))
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
