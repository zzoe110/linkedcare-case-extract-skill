/* 续跑：当 extract_all.js 恰好停在 200 页（撞上限）时使用。
   使用前修改下面的 START_PAGE / END_PAGE。 */
(()=>{
  const START_PAGE = 201;
  const END_PAGE   = 600;

  const fr = Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail'));
  const w = fr.contentWindow;
  const r = w.__capturedReqs[0];
  const body = JSON.parse(r.body);
  body.criteria.pageSize = 100;
  w.__extract.status = 'running';

  async function run(){
    try{
      for(let p=START_PAGE; p<=END_PAGE; p++){
        body.criteria.pageIndex = p;
        const res = await w.fetch(r.url, {method:'POST', headers:r.headers, body: JSON.stringify(body)});
        if(!res.ok){ w.__extract.error='HTTP '+res.status; break; }
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
        if(items.length < 100) break;
        await new Promise(rs=>setTimeout(rs, 400));
      }
      w.__extract.status = w.__extract.error ? 'error' : 'done';
    }catch(e){ w.__extract.status='error'; w.__extract.error=String(e); }
  }
  run();
  return 'resumed from page ' + START_PAGE;
})()
