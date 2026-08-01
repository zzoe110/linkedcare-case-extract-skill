// LinkedCare 登录态快速判断
// 仅做"是否已登录并进入报表页"的快速判定，不读取/不修改任何业务数据。
//
// 判定逻辑：
//   1) 目标报表在 iframe(src 含 reportCenter.dealDetail) 内。
//      - 若该 iframe 存在且其内部已渲染报表 UI（含"查询"/"总计"/"重置"/"暂无相关数据"字样，且无登录关键字）→ loggedIn=true
//      - 若 iframe 存在但内部仍是登录内容（含登录关键字）→ loggedIn=false（未真正进入报表）
//      - 若 iframe 存在但内容为空（刚加载/跨域不可读）→ 给一次机会：跨域无法读内部时假设已登录并提示人工核实；同源但空白则视为未就绪
//   2) 若目标 iframe 不存在 → 在主文档层面判断：
//      - 存在 password 输入框 → loggedIn=false（登录表单）
//      - 页面含"登录/请输入/账号/密码/未登录/请先登录"等登录关键字 → loggedIn=false
//      - 当前 URL 是 login/signin/auth/oauth/sso 路由 → loggedIn=false
//      - 否则 → loggedIn=false（target iframe 缺失，未进入报表页）
(()=>{
  const TARGET = 'reportCenter.dealDetail';
  const fr = Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes(TARGET));
  const out = {loggedIn:false, onTargetPage:false, reason:'', hasPasswordInput:false, url:location.href};

  if(fr){
    try{
      const d = fr.contentDocument;
      const txt = (d && d.body) ? d.body.innerText : '';
      const hasReportMark = txt.includes('查询') || txt.includes('总计') || txt.includes('暂无相关数据') || txt.includes('重置');
      const loginKw = /登录|请输入|账号|密码|Sign in|LOGIN|未登录|请先登录/i.test(txt);
      if(hasReportMark && !loginKw){
        out.loggedIn = true; out.onTargetPage = true;
        out.reason = 'report iframe present and rendered with report UI';
        return JSON.stringify(out);
      }
      if(loginKw){
        out.loggedIn = false; out.onTargetPage = false;
        out.reason = 'iframe present but shows login content';
        return JSON.stringify(out);
      }
      // iframe 存在但内容空（刚加载或跨域）
      out.reason = 'iframe present but content not yet rendered (still loading or cross-origin)';
      return JSON.stringify(out);
    }catch(e){
      // 跨域无法读取内部：iframe 指向报表页，较可能已登录，给一次机会并提示人工核实
      out.loggedIn = true; out.onTargetPage = true; out.crossOrigin = true;
      out.reason = 'report iframe present; cannot read inner (cross-origin) — assume logged in, verify report UI manually';
      return JSON.stringify(out);
    }
  }

  // 主文档层面判断
  const fullText = document.body ? document.body.innerText : '';
  const hasPwd = !!document.querySelector('input[type=password]');
  const loginKw = /登录|请输入|账号|密码|Sign in|LOGIN|未登录|请先登录/i.test(fullText);
  const loginRoute = /login|signin|auth|oauth|sso/i.test(location.href);

  out.hasPasswordInput = hasPwd;
  if(hasPwd)            out.reason = 'login form detected (password input present on main page)';
  else if(loginKw)      out.reason = 'login-related keyword found on main page';
  else if(loginRoute)   out.reason = 'current url looks like a login route';
  else                  out.reason = 'target report iframe missing (not on report page)';
  return JSON.stringify(out);
})()
