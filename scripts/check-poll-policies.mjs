import fs from 'node:fs';
import pg from 'pg';
const pass = fs.readFileSync('pas data.txt', 'utf8').trim();
const client = new pg.Client({
  connectionString: 'postgresql://postgres.qpaoucyjitbmfcahxrqu:' + encodeURIComponent(pass) + '@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
await client.connect();
const res = await client.query("select tablename, policyname, roles, cmd, qual, with_check from pg_policies where tablename in ('cdilv_posts', 'cdilv_score_events')");
console.log(JSON.stringify(res.rows, null, 2));
await client.end();
