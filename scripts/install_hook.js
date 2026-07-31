(()=>{
  const fr = Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail'));
  const w = fr.contentWindow;
  if (w.__hookInstalled) return 'already';
  w.__capturedReqs = [];

  const of = w.fetch;
  w.fetch = function(url, opts){
    try{
      if(String(url).includes('complex-report')) {
        w.__capturedReqs.push({type:'fetch', url:String(url), body: opts&&opts.body, headers: opts&&opts.headers});
      }
    }catch(e){}
    return of.apply(this, arguments);
  };

  const oo  = w.XMLHttpRequest.prototype.open;
  const os  = w.XMLHttpRequest.prototype.send;
  const osh = w.XMLHttpRequest.prototype.setRequestHeader;

  w.XMLHttpRequest.prototype.open = function(m,u){ this.__u=u; this.__m=m; this.__h={}; return oo.apply(this,arguments); };
  w.XMLHttpRequest.prototype.setRequestHeader = function(k,v){ if(this.__h) this.__h[k]=v; return osh.apply(this,arguments); };
  w.XMLHttpRequest.prototype.send = function(b){
    try{
      if(String(this.__u).includes('complex-report')){
        const x = this;
        x.addEventListener('load', function(){
          w.__capturedReqs.push({type:'xhr', url:String(x.__u), method:x.__m, body:b, headers:x.__h, status:x.status});
        });
      }
    }catch(e){}
    return os.apply(this,arguments);
  };

  w.__hookInstalled = true;
  return 'hooked';
})()
