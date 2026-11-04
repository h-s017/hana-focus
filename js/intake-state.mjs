export const receiptTime=r=>r.submitted_at||r.created_at;
export function intakeState(rows){
 const saved=rows.filter(r=>r.status==='saved'),historical=saved.filter(r=>r.receipt_kind==='historical');
 const unread=saved.filter(r=>r.receipt_kind!=='historical'&&!r.seen_at);
 const latest=[...saved].sort((a,b)=>(Date.parse(receiptTime(b))||0)-(Date.parse(receiptTime(a))||0))[0]||null;
 return {saved,historical,unread,latest,pending:rows.filter(r=>r.status!=='saved')};
}
