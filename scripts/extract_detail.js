// LinkedCare 交易级明细提取（电商模板）
// 不去重，每笔收费一行，仅保留网电咨询师非空的行
//
// ⚠️ 字段映射（已按用户纠正+实测验证，2026-07-31 / 最终修正于 2026-08-01）：
//   病例id  → patientId   （注意：patientId 才是病例ID，≠ privateId）
//   【清洗后表头只保留「病例id」(patientId)，不再输出「病历号」(privateId)】
//   现金类实收 → actualPrice（优先，= 网页"现金类实收"列=折后实收）；
//                 兜底 totalActualPrice（=应收/折前，无折扣时与 actualPrice 相等）
//     ⚠️ 实测验证（2026-08-01，读取 ag-Grid 实际渲染列）：网页"现金类实收" = actualPrice
//     - 有折扣的记录：actualPrice = totalActualPrice - payDiscount，网页显示 actualPrice
//       （例：3800→2666 记录，网页=2218.82=actualPrice，totalActualPrice=2666 偏高一截折扣）
//     - 无折扣记录：actualPrice == totalActualPrice，二者一致
//     - incomePrice 对 isDeduction=是(分期)记录返回0，错误
//     - 历史误用顺序：paymentType1Subtotal(大量0) → incomePrice(分期0) → totalActualPrice(折扣时偏高) → actualPrice(✓最终)
//   其余：患者网电咨询师=onlineConsultantName / 患者姓名=patientName
//        收费时间=payDateTime / 收费机构=orderOfficeName
//
// 结果存入 w.__extract2.rows
//
// 🚨 铁律：只改 pageSize / pageIndex 做翻页，绝不修改 body.criteria 里的
//    日期范围 / 诊所 / 诊断 等筛选条件（那是用页面上用户自己设好的）。
(()=>{
const fr = Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail'));
if(!fr) return 'ERROR: iframe not found';
const w = fr.contentWindow;
const reqs = w.__capturedReqs;
if(!reqs || !reqs.length) return 'ERROR: no captured request. Run install_hook.js + click_query.js first.';
const r = reqs[reqs.length-1];   // 取最后一次查询（= 用户设好的条件）

w.__extract2 = {status:'running', page:0, fetched:0, kept:0, rows:[], error:null};
const body = JSON.parse(r.body);
body.criteria.pageSize = 100;   // 仅改分页大小，不动筛选条件

async function run(){
  try{
    const MAX_PAGE = 600; // 上限保护，够跑约6万条
    for(let p=1; p<=MAX_PAGE; p++){
      body.criteria.pageIndex = p;
      const res = await w.fetch(r.url, {method:'POST', headers:r.headers, body: JSON.stringify(body)});
      if(!res.ok){ w.__extract2.error='HTTP '+res.status; break; }
      const j = await res.json();
      const items = j.items || [];
      w.__extract2.page = p;
      w.__extract2.fetched += items.length;
      items.forEach(it=>{
        // 核心过滤：只保留网电咨询师非空的行
        const oc = (it.onlineConsultantName||'').trim();
        if(!oc) return;
        w.__extract2.kept++;
        w.__extract2.rows.push({
          onlineConsultantName: oc,
          patientName: it.patientName||'',
          patientId: it.patientId||'',        // ← 病例ID（修正：patientId，唯一标识）
          payDateTime: it.payDateTime||'',
          // 现金类实收：优先 actualPrice（=网页"现金类实收"列=折后实收），兜底 totalActualPrice
          cashActualReceived: (it.actualPrice!==undefined && it.actualPrice!=='') ? it.actualPrice
            : (it.totalActualPrice!==undefined && it.totalActualPrice!=='') ? it.totalActualPrice
            : '',
          chargeOrg: it.orderOfficeName||''
        });
      });
      // 终止条件：返回条数 < pageSize
      if(items.length < body.criteria.pageSize) break;
      // 节流：每页间隔 400ms
      await new Promise(rs=>setTimeout(rs, 400));
    }
    w.__extract2.status = w.__extract2.error ? 'error' : 'done';
  }catch(e){
    w.__extract2.status = 'error';
    w.__extract2.error = String(e);
  }
}
run();
return 'detail extraction started (mode B, 病例ID=patientId, filter onlineConsultantName non-empty)';
})()
