import {respond,error,readBody,str} from "./security.js";
import {parseBankCSV,BankCSVError} from "./bank-csv.js";

const query=(db,sql,...values)=>db.prepare(sql).bind(...values);
const uid=()=>crypto.randomUUID();
const asMoney=n=>Number.isSafeInteger(n)&&n>0&&n<=100000000;
const handled=e=>/UNIQUE|constraint|immutable|invalid|bank match|refund total|status transition|bank debit|bank account|requires|receipt|metadata|not match/i.test(String(e));
const refusal=(message)=>error(message,409);
const types=["sale","service"];
async function original(db,kind,receiptId){
 if(!types.includes(kind)||!receiptId)return null;
 return kind==="sale"
   ?query(db,"SELECT id,reference,amount_cents FROM sale_receipts WHERE id=?",receiptId).first()
   :query(db,"SELECT id,reference,amount_cents FROM service_receipts WHERE id=?",receiptId).first();
}
async function digest(content){
 const buffer=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(content));
 return Array.from(new Uint8Array(buffer)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
export async function handleBank({request,db,user,route}){
 if(user.role!=="admin")return error("Acesso não autorizado.",404);
 const method=request.method;
 if(route==="admin/bank/overview"&&method==="GET"){
   const [batches,entries,matches,refunds,sales,services,totals]=await db.batch([
     db.prepare("SELECT id,account_alias,filename,substr(sha256,1,12) sha_prefix,row_count,imported_by,created_at FROM bank_imports ORDER BY created_at DESC,rowid DESC LIMIT 30"),
     db.prepare("SELECT b.id,b.account_alias,b.external_id,b.posted_on,b.amount_cents,b.description,m.receipt_kind,m.receipt_id,CASE WHEN f.id IS NOT NULL THEN 'settled-refund' WHEN m.id IS NOT NULL THEN 'matched-receipt' ELSE 'unmatched' END match_status FROM bank_entries b LEFT JOIN bank_receipt_matches m ON m.entry_id=b.id LEFT JOIN bank_refunds f ON f.bank_entry_id=b.id AND f.status='settled' ORDER BY b.posted_on DESC,b.rowid DESC LIMIT 200"),
     db.prepare("SELECT m.id,m.entry_id,m.receipt_kind,m.receipt_id,m.matched_at,b.external_id,b.account_alias,b.amount_cents FROM bank_receipt_matches m JOIN bank_entries b ON b.id=m.entry_id ORDER BY m.matched_at DESC,m.rowid DESC LIMIT 150"),
     db.prepare("SELECT r.*,CASE WHEN r.receipt_kind='sale' THEN (SELECT reference FROM sale_receipts sr WHERE sr.id=r.receipt_id) ELSE (SELECT reference FROM service_receipts sr WHERE sr.id=r.receipt_id) END original_reference FROM bank_refunds r ORDER BY r.created_at DESC,r.rowid DESC LIMIT 150"),
     db.prepare("SELECT 'sale' receipt_kind,r.id,r.reference,r.amount_cents,r.received_at received_at,o.company FROM sale_receipts r JOIN sales s ON s.id=r.sale_id JOIN opportunities o ON o.id=s.opportunity_id LEFT JOIN bank_receipt_matches m ON m.receipt_kind='sale' AND m.receipt_id=r.id WHERE m.id IS NULL ORDER BY r.received_at DESC,r.rowid DESC LIMIT 150"),
     db.prepare("SELECT 'service' receipt_kind,r.id,r.reference,r.amount_cents,r.received_at received_at,o.company FROM service_receipts r JOIN service_charges c ON c.id=r.charge_id JOIN service_agreements a ON a.id=c.agreement_id JOIN sales s ON s.id=a.sale_id JOIN opportunities o ON o.id=s.opportunity_id LEFT JOIN bank_receipt_matches m ON m.receipt_kind='service' AND m.receipt_id=r.id WHERE m.id IS NULL ORDER BY r.received_at DESC,r.rowid DESC LIMIT 150"),
     db.prepare("SELECT (SELECT COUNT(*) FROM bank_entries WHERE amount_cents>0) credits_imported,(SELECT COUNT(*) FROM bank_entries WHERE amount_cents<0) debits_imported,(SELECT COUNT(*) FROM bank_receipt_matches) matched_credits,(SELECT COUNT(*) FROM bank_entries e WHERE e.amount_cents>0 AND NOT EXISTS(SELECT 1 FROM bank_receipt_matches m WHERE m.entry_id=e.id)) unmatched_credits,(SELECT COUNT(*) FROM bank_refunds WHERE status IN ('requested','approved')) pending_refunds,(SELECT COALESCE(SUM(amount_cents),0) FROM bank_refunds WHERE status='settled') settled_refund_cents,(SELECT COUNT(*) FROM sale_receipts r WHERE NOT EXISTS(SELECT 1 FROM bank_receipt_matches m WHERE m.receipt_kind='sale' AND m.receipt_id=r.id)) unmatched_sale_receipts,(SELECT COUNT(*) FROM service_receipts r WHERE NOT EXISTS(SELECT 1 FROM bank_receipt_matches m WHERE m.receipt_kind='service' AND m.receipt_id=r.id)) unmatched_service_receipts")
   ]);
   return respond({ok:true,batches:batches.results,entries:entries.results,matches:matches.results,
     refunds:refunds.results,unmatchedReceipts:[...sales.results,...services.results],totals:totals.results[0],limits:{entries:200,receipts:300,refunds:150},
     sourceWarning:"CSV importado manualmente: não comprova autenticidade bancária. Confirme o arquivo diretamente no banco antes de efetuar qualquer devolução."});
 }
 if(route==="admin/bank/import"&&method==="POST"){
   const b=await readBody(request,140000),account=str(b.accountAlias,60).toUpperCase(),
     filename=str(b.filename,120),content=b.csv;
   if(b.confirmedSource!==true||!/^[A-Z0-9][A-Z0-9_-]{3,59}$/.test(account)||
     !/^[a-zA-Z0-9][\w. -]{2,119}\.csv$/i.test(filename)||typeof content!=="string")
     return error("Informe apelido da conta, arquivo CSV e confirme a origem do extrato.",400);
   let rows;
   try{rows=parseBankCSV(content);}catch(e){if(e instanceof BankCSVError)return error(e.message,400);throw e;}
   const importedId=uid(),sha=await digest(content);
   const stmts=[query(db,"INSERT INTO bank_imports(id,account_alias,filename,sha256,row_count,imported_by) VALUES (?,?,?,?,?,?)",
     importedId,account,filename,sha,rows.length,user.id)];
   for(const x of rows)stmts.push(query(db,
     "INSERT INTO bank_entries(id,import_id,account_alias,external_id,posted_on,amount_cents,description) VALUES (?,?,?,?,?,?,?)",
     uid(),importedId,account,x.externalId.toUpperCase(),x.postedOn,x.amountCents,x.description));
   try{await db.batch(stmts);}catch(e){
     if(handled(e))return refusal("Arquivo repetido ou identificador bancário já importado. Nenhuma linha foi adicionada.");
     throw e;
   }
   return respond({ok:true,id:importedId,rows:rows.length,credits:rows.filter(x=>x.amountCents>0).length,
     debits:rows.filter(x=>x.amountCents<0).length},201);
 }
 if(route==="admin/bank/match"&&method==="POST"){
   const b=await readBody(request),entryId=str(b.entryId,60),kind=str(b.receiptKind,10),receiptId=str(b.receiptId,60);
   if(!entryId||!types.includes(kind)||!receiptId||b.confirmedComparison!==true)
     return error("Escolha transação de crédito e recibo, conferindo os valores e identificadores.",400);
   const bank=await query(db,"SELECT id,external_id,amount_cents FROM bank_entries WHERE id=?",entryId).first();
   const receipt=await original(db,kind,receiptId);
   if(!bank||!receipt||bank.amount_cents<=0||receipt.amount_cents!==bank.amount_cents||
     receipt.reference.toUpperCase()!==bank.external_id.toUpperCase())
     return refusal("Conciliação recusada: tipo, valor ou referência bancária não correspondem exatamente ao recibo.");
   try{
     await query(db,"INSERT INTO bank_receipt_matches(id,entry_id,receipt_kind,receipt_id,matched_by) VALUES (?,?,?,?,?)",
       uid(),entryId,kind,receiptId,user.id).run();
   }catch(e){if(handled(e))return refusal("Recibo ou transação já conciliado, ou inconsistência na identificação bancária.");throw e;}
   return respond({ok:true,status:"matched"});
 }
 if(route==="admin/bank/refund-request"&&method==="POST"){
   const b=await readBody(request),kind=str(b.receiptKind,10),receiptId=str(b.receiptId,60),
     amount=b.amountCents,reason=str(b.reason,800);
   if(!types.includes(kind)||!receiptId||!asMoney(amount)||reason.length<15||b.confirmedCase!==true)
     return error("Informe o recibo original, valor, justificativa de pelo menos 15 caracteres e confirmação.",400);
   const rec=await original(db,kind,receiptId);
   if(!rec||amount>rec.amount_cents)return refusal("O reembolso não pode exceder o recebimento original.");
   const refundId=uid();
   try{await query(db,"INSERT INTO bank_refunds(id,receipt_kind,receipt_id,amount_cents,reason,requested_by) VALUES (?,?,?,?,?,?)",
     refundId,kind,receiptId,amount,reason,user.id).run();
   }catch(e){if(handled(e))return refusal("Reembolso duplicado ou o total solicitado excede o recibo original.");throw e;}
   return respond({ok:true,id:refundId,status:"requested",message:"Pedido registrado, sem movimentação de dinheiro."},201);
 }
 if(route==="admin/bank/refund-review"&&method==="POST"){
   const b=await readBody(request),refundId=str(b.id,60),decision=str(b.decision,12);
   if(!refundId||!["approved","rejected"].includes(decision)||b.confirmedReview!==true)
     return error("Confirme explicitamente a aprovação ou a rejeição do reembolso.",400);
   const item=await query(db,"SELECT id,status FROM bank_refunds WHERE id=?",refundId).first();
   if(!item||!["requested","approved"].includes(item.status)||(item.status==="approved"&&decision!=="rejected"))
     return refusal("Pedido não permite esta decisão.");
   try{
     const r=await query(db,"UPDATE bank_refunds SET status=?,approved_by=?,reviewed_at=datetime('now') WHERE id=? AND status=?",
       decision,user.id,refundId,item.status).run();
     if(r.meta?.changes!==1)return refusal("Pedido alterado em outra sessão.");
   }catch(e){if(handled(e))return refusal("A aprovação exige que o recebimento original esteja conciliado com o extrato importado.");throw e;}
   return respond({ok:true,id:refundId,status:decision});
 }
 if(route==="admin/bank/refund-settle"&&method==="POST"){
   const b=await readBody(request),refundId=str(b.id,60),entryId=str(b.bankEntryId,60);
   if(!refundId||!entryId||b.confirmedBankDebit!==true)
     return error("Confirme o débito de devolução no extrato antes de dar baixa.",400);
   const item=await query(db,"SELECT id,status,amount_cents FROM bank_refunds WHERE id=?",refundId).first();
   if(!item||item.status!=="approved")return refusal("O pedido precisa estar aprovado e ainda não liquidado.");
   const entry=await query(db,"SELECT id,amount_cents FROM bank_entries WHERE id=?",entryId).first();
   if(!entry||entry.amount_cents!==-item.amount_cents)return refusal("O débito bancário deve corresponder exatamente ao valor da devolução.");
   try{
     const updated=await query(db,"UPDATE bank_refunds SET status='settled',bank_entry_id=?,settled_by=?,settled_at=datetime('now') WHERE id=? AND status='approved'",
       entryId,user.id,refundId).run();
     if(updated.meta?.changes!==1)return refusal("Reembolso já liquidado ou alterado por outra sessão.");
   }catch(e){if(handled(e))return refusal("Débito já utilizado ou conta/valor incompatível com o recebimento original.");throw e;}
   return respond({ok:true,id:refundId,status:"settled",message:"Devolução reconciliada com débito no extrato. Recibo original preservado."});
 }
 return error("Operação de conciliação não encontrada.",404);
}
