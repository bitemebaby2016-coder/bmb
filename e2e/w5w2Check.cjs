const fs=require('fs');const env=fs.readFileSync('.env','utf8');
const tk=((env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)||[])[1]||process.env.SUPABASE_ACCESS_TOKEN||'').trim();
(async()=>{
 const q=(sql)=>fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query',{method:'POST',headers:{Authorization:'Bearer '+tk,'Content-Type':'application/json'},body:JSON.stringify({query:sql})}).then(async r=>[r.status,await r.text()]);
 let [s,b]=await q("select payment_intent_id, status, amount, created_at, completed_at from public.payment_intents where order_number='PO-20260929-131' order by created_at");
 console.log('PI',s,b);
 [s,b]=await q("select from_status, to_status, actor_type, changed_at from public.order_status_history where order_number='PO-20260929-131' order by changed_at");
 console.log('HIST',s,b);
 [s,b]=await q("select payment_status, status from public.orders where order_number='PO-20260929-131'");
 console.log('ORDER',s,b);
})().catch(e=>{console.error('F',String(e).slice(0,200));process.exit(1)})
