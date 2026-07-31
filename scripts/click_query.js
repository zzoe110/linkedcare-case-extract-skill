(()=>{
  const fr = Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail'));
  const d = fr.contentDocument;
  const q = Array.from(d.querySelectorAll('button, .el-button, [class*=btn], span, a'))
              .find(b=>b.textContent.trim()==='查询');
  if(q){ q.click(); return JSON.stringify({clicked:true}); }
  return JSON.stringify({clicked:false, hint:'查询按钮未找到，检查页面是否加载完成'});
})()
