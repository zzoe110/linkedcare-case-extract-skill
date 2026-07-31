(()=>{
  const fr = Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail'));
  if(!fr) return JSON.stringify({ok:false, reason:'report iframe not found'});
  const d = fr.contentDocument;
  const txt = d.body.innerText;
  return JSON.stringify({
    ok: true,
    hasNoData: txt.includes('暂无相关数据'),
    hasTotal: txt.includes('总计'),
    sample: txt.slice(0, 200)
  });
})()
