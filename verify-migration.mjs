import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const usersResult = await pool.query(`
    SELECT email, role, is_admin, role_id
    FROM app_users
    ORDER BY email
    LIMIT 10
  `);

  console.log('Users after migration:');
  console.table(usersResult.rows);

  const rolesResult = await pool.query(`
    SELECT SUBSTRING(id, 1, 8) || '...' as id, name, is_system
    FROM app_roles
    ORDER BY name
  `);

  console.log('\nAvailable roles:');
  console.table(rolesResult.rows);

  await pool.end();
} catch(e) {
  console.error('Error:', e.message);
  await pool.end();
  process.exit(1);
}
