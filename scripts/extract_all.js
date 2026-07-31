(()=>{
  const fr = Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail'));
  const w = fr.contentWindow;
  const r = w.__capturedReqs && w.__capturedReqs[0];
  if(!r) return 'ERROR: no captured request — run install_hook.js then click_query.js first';

  w.__extract = {status:'running', page:0, fetched:0, rows:[], error:null};
  const body = JSON.parse(r.body);
  body.criteria.pageSize = 100;

  async function run(){
    try{
      for(let p=1; p<=200; p++){
        body.criteria.pageIndex = p;
        const res = await w.fetch(r.url, {method:'POST', headers:r.headers, body: JSON.stringify(body)});
        if(!res.ok){ w.__extract.error = 'HTTP '+res.status; break; }
        const j = await res.json();
        const items = j.items || [];
        w.__extract.page = p;
        w.__extract.fetched += items.length;
        items.forEach(it=>{
          w.__extract.rows.push({
            name:      it.patientName,
            mobile:    it.mobile,
            privateId: it.privateId,
            online:    it.onlineConsultantName,
            attendant: it.attendantName
          });
        });
        if(items.length < 100) break;          // 唯一可靠的终止条件
        await new Promise(rs=>setTimeout(rs, 400));
      }
      w.__extract.status = w.__extract.error ? 'error' : 'done';
    }catch(e){ w.__extract.status='error'; w.__extract.error=String(e); }
  }
  run();
  return 'extraction started (max 200 pages; use extract_resume.js if it stops exactly at 200)';
})()
