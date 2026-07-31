#!/usr/bin/env python3
"""合并 /tmp/lc_chunk_*.json 分块，全局去重，导出 CSV + Excel。

用法：
    python merge_export.py [输出目录]
默认输出目录：~/病例提取（可用第一个参数覆盖，如 python merge_export.py /path/to/out）
"""
import json, glob, csv, os, sys, re
from datetime import datetime

OUTDIR = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/病例提取")
COLS = ["姓名", "电话", "病例ID", "患者网电咨询师", "专属客服"]


def load_chunks():
    paths = sorted(
        glob.glob("/tmp/lc_chunk_*.json"),
        key=lambda p: int(re.search(r"lc_chunk_(\d+)", p).group(1)),
    )
    if not paths:
        sys.exit("没有找到 /tmp/lc_chunk_*.json，请先执行分批导出")
    rows = []
    for p in paths:
        with open(p, encoding="utf-8") as f:
            txt = f.read().strip()
        if not txt:
            continue
        rows.extend(json.loads(txt))
    return rows


def main():
    rows = load_chunks()
    seen, out = set(), []
    for r in rows:
        pid = (r.get("privateId") or "").strip()
        if not pid or pid in seen:
            continue
        seen.add(pid)
        out.append({
            "姓名":           r.get("name") or "",
            "电话":           r.get("mobile") or "",
            "病例ID":         pid,
            "患者网电咨询师":  r.get("online") or "",
            "专属客服":       r.get("attendant") or "",
        })

    os.makedirs(OUTDIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    csv_path = os.path.join(OUTDIR, f"病例提取_去重_{stamp}.csv")
    xlsx_path = os.path.join(OUTDIR, f"病例提取_去重_{stamp}.xlsx")

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(out)

    xlsx_ok = False
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "去重病例"
        ws.append(COLS)
        for r in out:
            ws.append([r[c] for c in COLS])
        for col, width in zip("ABCDE", [18, 15, 18, 16, 14]):
            ws.column_dimensions[col].width = width
        ws.freeze_panes = "A2"
        wb.save(xlsx_path)
        xlsx_ok = True
    except Exception as e:
        print("xlsx 生成失败:", e)

    print(json.dumps({
        "原始明细":      len(rows),
        "去重后":        len(out),
        "有电话":        sum(1 for r in out if r["电话"]),
        "有网电咨询师":  sum(1 for r in out if r["患者网电咨询师"]),
        "有专属客服":    sum(1 for r in out if r["专属客服"]),
        "csv":          csv_path,
        "xlsx":         xlsx_path if xlsx_ok else None,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
