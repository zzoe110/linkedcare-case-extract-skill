// LinkedCare 全量提取（去重模式 A）
// 只抓 5 字段，后续由 dedupe.js 按 patientId 去重。
//
// ⚠️ 字段映射（已按用户纠正，2026-07-31）：
//   病例ID = patientId（≠ privateId）
//   电话   = mobile / 姓名 = patientName
//   患者网电咨询师 = onlineConsultantName / 专属客服 = attendantName
//
// 🚨 铁律：只改 pageSize / pageIndex 做翻页，绝不修改 body.criteria 筛选条件。
(()=>{
  const fr = Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail'));
  const w = fr.contentWindow;
  const reqs = w.__capturedReqs;
  if(!reqs || !reqs.length) return 'ERROR: no captured request — run install_hook.js then click_query.js first';
  const r = reqs[reqs.length-1];

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
            patientId: it.patientId,        // ← 病例ID（修正：patientId，≠ privateId）
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
