// 去重（模式 A）：按 patientId（病例ID）去重，每人保留首次出现
// 注意：病例ID = patientId，不是 privateId
(()=>{
  const fr = Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail'));
  const w = fr.contentWindow;
  const rows = w.__extract.rows;
  const map = new Map();
  rows.forEach(r=>{
    const k = (r.patientId||'').trim();   // ← 病例ID（patientId）作为去重键
    if(!k) return;
    if(!map.has(k)) map.set(k, r);   // 保留首次出现
  });
  const uniq = Array.from(map.values());
  w.__uniq = uniq;
  return JSON.stringify({
    raw: rows.length,
    unique: uniq.length,
    chunks: Math.ceil(uniq.length/1000),
    sample: uniq.slice(0,2)
  });
})()
