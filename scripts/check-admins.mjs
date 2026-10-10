import fs from 'node:fs';
import pg from 'pg';
const pass = fs.readFileSync('pas data.txt', 'utf8').trim();
const client = new pg.Client({
  connectionString: 'postgresql://postgres.qpaoucyjitbmfcahxrqu:' + encodeURIComponent(pass) + '@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
await client.connect();
const res = await client.query("select id, full_name, role, approval_status from public.cdilv_profiles where role = 'admin'");
console.log('Admins in cdilv_profiles:', JSON.stringify(res.rows, null, 2));
await client.end();
