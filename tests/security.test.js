import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('Postgres RLS enforces ownership, approval, payments and private file access', async () => {
  const db = new PGlite();
  const a='10000000-0000-4000-8000-000000000001';
  const b='10000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public,storage to anon,authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select on storage.objects to authenticated;
      insert into auth.users values ('${a}'),('${b}');
    `);
    const schema=readFileSync('supabase/schema.sql','utf8');
    await db.exec(schema);
    await db.exec(schema); // migrations are re-runnable
    async function asStudent(id) { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${id}';`); }
    await asStudent(a);
    await assert.rejects(db.query(`insert into applications(user_id,full_name,phone,payment_plan,status) values ($1,'Amina','0742330046','full','approved')`,[a]));
    await assert.rejects(db.query(`insert into applications(user_id,full_name,phone,payment_plan) values ($1,'Amina','0742330046','full')`,[b]));
    await db.query(`insert into applications(user_id,full_name,phone,payment_plan) values ($1,'Amina','0742330046','instalments')`,[a]);
    assert.equal((await db.query('select status from applications')).rows[0].status,'pending');
    await assert.rejects(db.exec(`update applications set status='approved'`));
    await assert.rejects(db.query(`insert into payments(user_id,amount_kes,reference) values ($1,10000,'fake')`,[a]));
    await asStudent(b);
    assert.equal((await db.query('select * from applications')).rows.length,0);
    await db.query(`insert into applications(user_id,full_name,phone,payment_plan) values ($1,'Brian','0711223344','full')`,[b]);
    await db.exec('reset role');
    await db.exec(`insert into course_resources(title,file_path,published) values ('First lesson','lesson.pdf',true),('Unpublished','draft.pdf',false);
      insert into storage.objects(bucket_id,name) values ('course-materials','lesson.pdf'),('course-materials','draft.pdf'),('certificates','a.pdf'),('certificates','b.pdf');`);
    await db.query(`insert into certificates(user_id,file_path,released) values ($1,'a.pdf',true),($2,'b.pdf',true)`,[a,b]);
    await asStudent(a);
    assert.equal((await db.query('select * from course_resources')).rows.length,0);
    assert.equal((await db.query('select * from storage.objects')).rows.length,0);
    await db.exec('reset role');
    await db.query(`update applications set status='approved' where user_id=$1`,[a]);
    await db.query(`insert into payments(user_id,amount_kes,reference) values ($1,5000,'verified-1')`,[a]);
    await asStudent(a);
    assert.equal((await db.query('select title from course_resources')).rows[0].title,'First lesson');
    assert.equal((await db.query('select * from certificates')).rows.length,0);
    assert.deepEqual((await db.query('select name from storage.objects')).rows.map(x=>x.name),['lesson.pdf']);
    await db.exec('reset role');
    await db.query(`insert into payments(user_id,amount_kes,reference) values ($1,5000,'verified-2')`,[a]);
    await asStudent(a);
    assert.equal((await db.query('select * from certificates')).rows.length,1);
    assert.deepEqual((await db.query('select name from storage.objects order by name')).rows.map(x=>x.name),['a.pdf','lesson.pdf']);
    await asStudent(b);
    assert.equal((await db.query('select * from payments')).rows.length,0);
    assert.equal((await db.query('select * from certificates')).rows.length,0);
    assert.equal((await db.query('select * from storage.objects')).rows.length,0);
    await db.exec(`reset role; set role anon;`);
    for (const table of ['applications','payments','course_resources','certificates','storage.objects']) await assert.rejects(db.query(`select * from ${table}`));
  } finally { await db.close(); }
});
