const fs=require('fs');const env=fs.readFileSync('.env','utf8');
const tk=((env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)||[])[1]||process.env.SUPABASE_ACCESS_TOKEN||'').trim();
(async()=>{
 const r=await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/functions/phone-auto-login',{headers:{Authorization:'Bearer '+tk}});
 console.log('DETAIL',r.status,(await r.text()).slice(0,400));
 const anon=env.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)[1].trim();
 const call=await fetch('https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/phone-auto-login',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({name:'QA W52',phone:'+66990000003',latitude:10.7031,longitude:102.1444,address_detail:'QA TEST ADDRESS'})});
 console.log('CALL',call.status,(await call.text()).slice(0,250));
})().catch(e=>{console.error('F',String(e).slice(0,200));process.exit(1)})
