import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SupabaseAuthenticator } from '../dist/services/auth/auth.service.js';

test('Supabase token validation fails closed and does not trust an unverified token payload', async () => {
  const beforeUrl = process.env.SUPABASE_URL, beforeKey = process.env.SUPABASE_ANON_KEY;
  try {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY;
    await assert.rejects(() => new SupabaseAuthenticator(async()=>{throw Error('must not run');}).verify('token'), e => e.code === 'AUTH_NOT_CONFIGURED');
    process.env.SUPABASE_URL='https://project.example'; process.env.SUPABASE_ANON_KEY='test-public-key';
    const userId=randomUUID();
    const verified=new SupabaseAuthenticator(async(url,options)=>{
      assert.equal(url.toString(),'https://project.example/auth/v1/user');
      assert.equal(options.headers.Authorization,'Bearer supplied-token');
      assert.equal(options.headers.apikey,'test-public-key');
      return new Response(JSON.stringify({id:userId}));
    });
    assert.equal(await verified.verify('supplied-token'),userId);
    await assert.rejects(()=>new SupabaseAuthenticator(async()=>new Response('private server message',{status:401})).verify('expired'), e=>e.status===401 && !e.message.includes('private'));
    await assert.rejects(()=>new SupabaseAuthenticator(async()=>new Response('{}',{status:500})).verify('token'), e=>e.code==='AUTH_UNAVAILABLE');
    await assert.rejects(()=>new SupabaseAuthenticator(async()=>new Response('{"id":"not-a-uuid"}')).verify('token'), e=>e.code==='AUTH_UNAVAILABLE');
    await assert.rejects(()=>new SupabaseAuthenticator(async()=>{throw Error('private network detail');}).verify('token'), e=>e.status===503 && !e.message.includes('private'));
  } finally {
    if(beforeUrl===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=beforeUrl;
    if(beforeKey===undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY=beforeKey;
  }
});
