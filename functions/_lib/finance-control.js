import {respond,error,readBody,str} from "./security.js";
const q=(db,sql,...bind)=>db.prepare(sql).bind(...bind);
const uid=()=>crypto.randomUUID();
const iso=value=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00Z");
 return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
};
const cents=n=>Number.isSafeInteger(n)&&n>0&&n<=100000000;
const conflict=e=>/UNIQUE|constraint|immutable|bank debit|already|balance|cancel|not found/i.test(String(e));
const categories=["infrastructure","software","marketing","tax","contractor","office","other"];
export async function handleFinanceControl({request,db,user,route}){
 if(user.role!=="admin")return error("Acesso não autorizado.",404);
 const method=request.method;
 if(route==="admin/control/overview"&&method==="GET"){
   const url=new URL(request.url);
   const requested=url.searchParams.get("month");
   const dateParts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Porto_Velho",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
   const month=requested||dateParts.year+"-"+dateParts.month;
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return error("Competência inválida.",400);
   const [sales,services,expenses,bank,other,monthly,projectRows]=await db.batch([
     db.prepare("SELECT COALESCE(SUM(gross_cents),0) contracted_cents,COALESCE(SUM(received_cents),0) recorded_receipts_cents,COALESCE(SUM(CASE WHEN status IN ('pending','partially_paid') THEN gross_cents-received_cents ELSE 0 END),0) outstanding_cents,COUNT(*) contracts FROM sales"),
     db.prepare("SELECT COALESCE(SUM(amount_cents),0) charged_cents,COALESCE(SUM(received_cents),0) recorded_receipts_cents,COALESCE(SUM(amount_cents-received_cents),0) outstanding_cents FROM service_charges"),
     db.prepare("SELECT COALESCE(SUM(CASE WHEN status<>'cancelled' THEN amount_cents ELSE 0 END),0) approved_cents,COALESCE(SUM(paid_cents),0) bank_paid_cents,COALESCE(SUM(CASE WHEN status<>'cancelled' THEN amount_cents-paid_cents ELSE 0 END),0) payable_cents,COALESCE(SUM(CASE WHEN status<>'cancelled' AND due_on<date('now','-4 hours') THEN amount_cents-paid_cents ELSE 0 END),0) overdue_cents FROM expense_obligations"),
     db.prepare("SELECT (SELECT COALESCE(SUM(b.amount_cents),0) FROM bank_entries b JOIN bank_receipt_matches m ON m.entry_id=b.id) matched_receipts_cents,(SELECT COALESCE(SUM(amount_cents),0) FROM expense_payments) matched_expenses_cents,(SELECT COALESCE(SUM(amount_cents),0) FROM bank_refunds WHERE status='settled') matched_refunds_cents,(SELECT COUNT(*) FROM bank_receipt_matches) matched_count"),
     db.prepare("SELECT (SELECT COALESCE(SUM(amount_cents),0) FROM commissions WHERE status IN ('estimated','approved','due')) pending_commissions_cents,(SELECT COALESCE(SUM(amount_cents),0) FROM developer_payments WHERE status IN ('pending','approved')) pending_developers_cents,(SELECT COALESCE(SUM(amount_cents),0) FROM commissions WHERE status='paid') reported_paid_commissions_cents,(SELECT COALESCE(SUM(amount_cents),0) FROM developer_payments WHERE status='paid') reported_paid_developers_cents"),
     q(db,"SELECT (SELECT COALESCE(SUM(b.amount_cents),0) FROM bank_receipt_matches m JOIN bank_entries b ON b.id=m.entry_id WHERE substr(b.posted_on,1,7)=?) receipt_cents,(SELECT COALESCE(SUM(e.amount_cents),0) FROM expense_payments e JOIN bank_entries b ON b.id=e.bank_entry_id WHERE substr(b.posted_on,1,7)=?) expense_cents,(SELECT COALESCE(SUM(f.amount_cents),0) FROM bank_refunds f JOIN bank_entries b ON b.id=f.bank_entry_id WHERE f.status='settled' AND substr(b.posted_on,1,7)=?) refund_cents,(SELECT COALESCE(SUM(e.amount_cents-e.paid_cents),0) FROM expense_obligations e WHERE e.status<>'cancelled' AND substr(e.due_on,1,7)=?) forecast_expenses_cents,(SELECT COALESCE(SUM(c.amount_cents-c.received_cents),0) FROM service_charges c WHERE substr(c.due_on,1,7)=?) forecast_service_receivables_cents",month,month,month,month,month),
     db.prepare("SELECT s.id,o.company,s.gross_cents,s.received_cents,COALESCE((SELECT SUM(c.amount_cents) FROM commissions c WHERE c.sale_id=s.id AND c.status<>'reversed'),0) commission_allocated_cents,COALESCE((SELECT SUM(dp.amount_cents) FROM projects p JOIN developer_payments dp ON dp.project_id=p.id WHERE p.sale_id=s.id AND dp.status<>'cancelled'),0) developer_allocated_cents,COALESCE((SELECT SUM(e.amount_cents) FROM expense_obligations e WHERE e.sale_id=s.id AND e.status<>'cancelled'),0) direct_expense_cents FROM sales s JOIN opportunities o ON o.id=s.opportunity_id ORDER BY s.created_at DESC LIMIT 70")
   ]);
   const b=bank.results[0],m=monthly.results[0];
   const risk=await q(db,"SELECT (SELECT COUNT(*) FROM bank_refunds f JOIN sale_receipts sr ON sr.id=f.receipt_id AND f.receipt_kind='sale' JOIN commissions c ON c.sale_id=sr.sale_id WHERE f.status='settled' AND c.status<>'reversed') commissionsWithRefunds,(SELECT COUNT(*) FROM bank_refunds WHERE status IN ('requested','approved')) refundReviewsPending,(SELECT COUNT(*) FROM bank_entries b WHERE b.amount_cents>0 AND NOT EXISTS(SELECT 1 FROM bank_receipt_matches m WHERE m.entry_id=b.id)) unmatchedBankCredits").first();
   const metrics={
     grossContractedCents:sales.results[0].contracted_cents,
     siteRecordedCents:sales.results[0].recorded_receipts_cents,
     siteOutstandingCents:sales.results[0].outstanding_cents,
     serviceRecordedCents:services.results[0].recorded_receipts_cents,
     serviceOutstandingCents:services.results[0].outstanding_cents,
     expenseApprovedCents:expenses.results[0].approved_cents,
     expensePaidCents:expenses.results[0].bank_paid_cents,
     expensePayableCents:expenses.results[0].payable_cents,
     expenseOverdueCents:expenses.results[0].overdue_cents,
     verifiedByImportedStatementCents:b.matched_receipts_cents,
     matchedExpenseDebitsCents:b.matched_expenses_cents,
     matchedRefundDebitsCents:b.matched_refunds_cents,
     classifiedNetMovementCents:b.matched_receipts_cents-b.matched_expenses_cents-b.matched_refunds_cents,
     pendingCommissionsCents:other.results[0].pending_commissions_cents,
     pendingDevelopersCents:other.results[0].pending_developers_cents,
     separatelyReportedPaidCommissionsCents:other.results[0].reported_paid_commissions_cents,
     separatelyReportedPaidDevelopersCents:other.results[0].reported_paid_developers_cents,
     matchedCount:b.matched_count
   };
   const projects=projectRows.results.map(x=>({
     ...x,
     estimatedContributionCents:x.gross_cents-x.commission_allocated_cents-x.developer_allocated_cents-x.direct_expense_cents,
     disclaimer:"Projeção parcial: tributos, despesas fixas e pagamentos não vinculados podem estar ausentes."
   }));
   return respond({ok:true,month,metrics,exceptions:risk,monthly:{
     bankMatchedInCents:m.receipt_cents,
     bankMatchedExpenseOutCents:m.expense_cents,
     bankMatchedRefundOutCents:m.refund_cents,
     netClassifiedCents:m.receipt_cents-m.expense_cents-m.refund_cents,
     pendingSupplierBillsDueCents:m.forecast_expenses_cents,
     pendingServiceInvoicesDueCents:m.forecast_service_receivables_cents
   },projects,
   notes:[
    "Não é saldo bancário nem demonstração contábil: apenas movimentos classificados no sistema e vinculados a arquivos externos ainda não autenticados pelo banco.",
    "Pagamentos de comissões e desenvolvedores informados em outras áreas ainda não possuem conciliação bancária independente.",
    "Custo alocado e margem parcial não constituem lucro líquido.",
    "O cadastro de contas a pagar não efetua transferências ou boletos.",
    "Estornos não revertem automaticamente comissões, obrigações técnicas ou contratos: revisar e registrar ajuste compensatório antes do fechamento."
   ]});
 }
 if(route==="admin/control/fiscal"&&method==="GET"){
   const [documents,sales,charges,expenses]=await db.batch([
     db.prepare("SELECT id,source_kind,source_id,document_type,issuer_name,document_number,verification_code,issued_on,amount_cents,status,cancellation_reason,created_at FROM fiscal_documents ORDER BY issued_on DESC,created_at DESC LIMIT 200"),
     db.prepare("SELECT s.id,o.company,s.gross_cents FROM sales s JOIN opportunities o ON o.id=s.opportunity_id ORDER BY s.created_at DESC LIMIT 100"),
     db.prepare("SELECT c.id,o.company,a.kind,c.period,c.amount_cents FROM service_charges c JOIN service_agreements a ON a.id=c.agreement_id JOIN sales s ON s.id=a.sale_id JOIN opportunities o ON o.id=s.opportunity_id ORDER BY c.due_on DESC LIMIT 100"),
     db.prepare("SELECT id,supplier,document_reference,amount_cents FROM expense_obligations WHERE status<>'cancelled' ORDER BY created_at DESC LIMIT 100")
   ]);
   return respond({ok:true,documents:documents.results,
     sources:{sale:sales.results,service_charge:charges.results,expense:expenses.results},
     warning:"Registro documental interno, não emissão ou consulta de NFS-e no órgão oficial."});
 }
 if(route==="admin/control/fiscal-record"&&method==="POST"){
   const b=await readBody(request),sourceKind=str(b.sourceKind,20),sourceId=str(b.sourceId,60),
     documentType=str(b.documentType,30),issuerName=str(b.issuerName,160),
     number=str(b.documentNumber,120),verificationCode=str(b.verificationCode,180),
     issuedOn=str(b.issuedOn,10),amount=b.amountCents;
   if(b.confirmedExternalDocument!==true||!["sale","service_charge","expense"].includes(sourceKind)||
     !sourceId||!["nfse","supplier_invoice"].includes(documentType)||issuerName.length<3||number.length<3||
     verificationCode.length<3||!iso(issuedOn)||!cents(amount))
     return error("Confirme documento fiscal emitido externamente, vínculo, referência, data e valor.",400);
   const documentId=uid();
   try{await q(db,"INSERT INTO fiscal_documents(id,source_kind,source_id,document_type,issuer_name,document_number,verification_code,issued_on,amount_cents,recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
     documentId,sourceKind,sourceId,documentType,issuerName,number,verificationCode,issuedOn,amount,user.id).run();}
   catch(e){if(conflict(e)||/fiscal document/i.test(String(e)))return error("Documento duplicado, valor ou tipo incompatível com o contrato ou despesa.",409);throw e;}
   return respond({ok:true,id:documentId,status:"recorded"},201);
 }
 if(route==="admin/control/fiscal-cancel"&&method==="POST"){
   const b=await readBody(request),documentId=str(b.id,60),reason=str(b.reason,800);
   if(!documentId||reason.length<15||b.confirmedExternalCancellation!==true)
     return error("O cancelamento deve estar concluído no emissor oficial; informe justificativa e confirmação.",400);
   try{
     const result=await q(db,"UPDATE fiscal_documents SET status='cancelled',cancellation_reason=?,cancelled_by=?,cancelled_at=datetime('now') WHERE id=? AND status='recorded'",
       reason,user.id,documentId).run();
     if(result.meta?.changes!==1)return error("Documento inexistente ou já cancelado no controle interno.",409);
   }catch(e){if(conflict(e)||/fiscal/i.test(String(e)))return error("Registro fiscal não pode ser alterado; verifique a situação no emissor.",409);throw e;}
   return respond({ok:true,id:documentId,status:"cancelled",notice:"O registro não cancelou a NFS-e no órgão emissor."});
 }
 if(route==="admin/control/expenses"&&method==="GET"){
   const [rows,debits,sales]=await db.batch([
     db.prepare("SELECT e.*,s.gross_cents as sale_gross,p.title project_title FROM expense_obligations e LEFT JOIN sales s ON s.id=e.sale_id LEFT JOIN projects p ON p.id=e.project_id ORDER BY e.due_on DESC,e.created_at DESC LIMIT 200"),
     db.prepare("SELECT b.id,b.account_alias,b.external_id,b.posted_on,b.amount_cents,b.description FROM bank_entries b WHERE b.amount_cents<0 AND NOT EXISTS(SELECT 1 FROM expense_payments x WHERE x.bank_entry_id=b.id) AND NOT EXISTS(SELECT 1 FROM bank_refunds r WHERE r.bank_entry_id=b.id) ORDER BY b.posted_on DESC LIMIT 150"),
     db.prepare("SELECT s.id,o.company,s.gross_cents FROM sales s JOIN opportunities o ON o.id=s.opportunity_id ORDER BY s.created_at DESC LIMIT 150")
   ]);
   return respond({ok:true,expenses:rows.results,unassignedBankDebits:debits.results,eligibleSales:sales.results,limits:{expenses:200,debits:150,sales:150}});
 }
 if(route==="admin/control/expense"&&method==="POST"){
   const b=await readBody(request),supplier=str(b.supplier,160),label=str(b.label,260),category=str(b.category,40),
     initialSaleId=str(b.saleId,60),projectId=str(b.projectId,60),documentReference=str(b.documentReference,160),
     amount=b.amountCents,dueOn=str(b.dueOn,10);
   let saleId=initialSaleId;
   if(b.confirmedDocument!==true||supplier.length<3||label.length<8||!categories.includes(category)||
      documentReference.length<5||!cents(amount)||!iso(dueOn))
     return error("Documento, vencimento, fornecedor, categoria e valor devem ser conferidos.",400);
   if(projectId){
     const project=await q(db,"SELECT sale_id FROM projects WHERE id=?",projectId).first();
     if(!project||project.sale_id&&(saleId&&project.sale_id!==saleId))return error("Projeto e venda não correspondem.",409);
     if(!saleId&&project.sale_id)saleId=project.sale_id;
   }
   if(saleId&&!(await q(db,"SELECT id FROM sales WHERE id=?",saleId).first()))return error("Venda inexistente.",404);
   const expenseId=uid();
   try{await q(db,"INSERT INTO expense_obligations(id,supplier,label,category,sale_id,project_id,document_reference,amount_cents,due_on,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
     expenseId,supplier,label,category,saleId||null,projectId||null,documentReference,amount,dueOn,user.id).run();
   }catch(e){if(conflict(e))return error("Despesa duplicada ou documento inválido; confira fornecedor e referência.",409);throw e;}
   return respond({ok:true,id:expenseId,status:"approved",message:"Obrigação registrada. Nenhum dinheiro foi transferido."},201);
 }
 if(route==="admin/control/expense-payment"&&method==="POST"){
   const b=await readBody(request),expenseId=str(b.expenseId,60),bankEntryId=str(b.bankEntryId,60);
   if(!expenseId||!bankEntryId||b.confirmedBankDebit!==true)return error("Selecione obrigação e débito do extrato, confirmando a movimentação no banco.",400);
   const debit=await q(db,"SELECT id,amount_cents FROM bank_entries WHERE id=?",bankEntryId).first();
   if(!debit||debit.amount_cents>=0)return error("Use um débito real importado do extrato.",400);
   const expense=await q(db,"SELECT id,status,amount_cents,paid_cents FROM expense_obligations WHERE id=?",expenseId).first();
   if(!expense||!["approved","partially_paid"].includes(expense.status)||expense.paid_cents-debit.amount_cents>expense.amount_cents)
     return error("Despesa encerrada ou débito superior ao saldo.",409);
   const paymentId=uid();
   try{await q(db,"INSERT INTO expense_payments(id,expense_id,bank_entry_id,amount_cents,actor_id) VALUES (?,?,?,?,?)",
     paymentId,expenseId,bankEntryId,-debit.amount_cents,user.id).run();
   }catch(e){if(conflict(e))return error("Débito já utilizado, referente a reembolso ou valor acima do devido.",409);throw e;}
   const updated=await q(db,"SELECT paid_cents,status FROM expense_obligations WHERE id=?",expenseId).first();
   return respond({ok:true,id:paymentId,paidCents:updated.paid_cents,status:updated.status});
 }
 if(route==="admin/control/expense-cancel"&&method==="POST"){
   const b=await readBody(request),expenseId=str(b.id,60),reason=str(b.reason,800);
   if(!expenseId||reason.length<12||b.confirmedCancel!==true)return error("Informe justificativa detalhada e confirme o cancelamento.",400);
   try{
     const result=await q(db,"UPDATE expense_obligations SET status='cancelled',cancelled_by=?,cancel_reason=?,cancelled_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='approved' AND paid_cents=0",
       user.id,reason,expenseId).run();
     if(result.meta?.changes!==1)return error("Somente uma obrigação ainda não paga pode ser cancelada.",409);
   }catch(e){if(conflict(e))return error("Cancelamento não permitido; histórico e pagamentos preservados.",409);throw e;}
   return respond({ok:true,id:expenseId,status:"cancelled"});
 }
 return error("Operação financeira não encontrada.",404);
}
