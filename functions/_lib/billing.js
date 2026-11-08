import {respond,error,readBody,str} from "./security.js";

const query=(db,sql,...values)=>db.prepare(sql).bind(...values);
const id=()=>crypto.randomUUID();
const money=n=>Number.isSafeInteger(n)&&n>0&&n<=100000000;
const dateOK=s=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+"T00:00:00Z");
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
};
const periodOK=(period,cadence,due)=>cadence==="monthly"
  ?/^\d{4}-(0[1-9]|1[0-2])$/.test(period)&&due.slice(0,7)===period
  :/^\d{4}$/.test(period)&&due.slice(0,4)===period;
const auditSQL="INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))";
const duplicate=e=>/UNIQUE|constraint|immutable|reference already|receipt exceeds|does not match/i.test(String(e));

export async function handleBilling({request,db,user,route}){
  const method=request.method;
  if(user.role!=="admin")return error("Acesso não autorizado.",404);
  if(route==="admin/billing/overview"&&method==="GET"){
    const [agreements,charges,receipts,eligible]=await db.batch([
      db.prepare("SELECT a.*,o.company,o.contact,s.status sale_status FROM service_agreements a JOIN sales s ON s.id=a.sale_id JOIN opportunities o ON o.id=s.opportunity_id ORDER BY a.created_at DESC LIMIT 300"),
      db.prepare("SELECT c.*,a.kind,a.cadence,a.contract_reference,o.company FROM service_charges c JOIN service_agreements a ON a.id=c.agreement_id JOIN sales s ON s.id=a.sale_id JOIN opportunities o ON o.id=s.opportunity_id ORDER BY c.due_on DESC,c.created_at DESC LIMIT 400"),
      db.prepare("SELECT r.id,r.charge_id,r.amount_cents,r.reference,r.received_at,u.name actor_name FROM service_receipts r LEFT JOIN users u ON u.id=r.actor_id ORDER BY r.received_at DESC LIMIT 400"),
      db.prepare("SELECT s.id,o.company,s.gross_cents,s.received_cents FROM sales s JOIN opportunities o ON o.id=s.opportunity_id WHERE s.status='paid' ORDER BY s.created_at DESC LIMIT 200")
    ]);
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Porto_Velho',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    const date=parts.year+'-'+parts.month+'-'+parts.day;
    const summary=await query(db,"SELECT (SELECT COUNT(*) FROM service_agreements WHERE status='active') agreements_active,COALESCE(SUM(CASE WHEN status<>'paid' THEN amount_cents-received_cents ELSE 0 END),0) open_cents,COALESCE(SUM(CASE WHEN status<>'paid' AND due_on<? THEN amount_cents-received_cents ELSE 0 END),0) overdue_cents,COALESCE(SUM(received_cents),0) received_cents,COALESCE(SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END),0) paid_count FROM service_charges",date).first();
    const totals={
      agreementsActive:summary.agreements_active,
      openCents:summary.open_cents,
      overdueCents:summary.overdue_cents,
      receivedCents:summary.received_cents,
      paidCount:summary.paid_count
    };
    return respond({ok:true,agreements:agreements.results,charges:charges.results,receipts:receipts.results,eligibleSales:eligible.results,totals,today:date,listsLimitedTo:400});
  }
  if(route==="admin/billing/agreement"&&method==="POST"){
    const b=await readBody(request),saleId=str(b.saleId,60),kind=str(b.kind,12),cadence=str(b.cadence,12),
      amount=b.amountCents,startOn=str(b.startOn,10),reference=str(b.contractReference,120),terms=str(b.termsSummary,1600);
    if(!saleId||!["support","hosting"].includes(kind)||!["monthly","annual"].includes(cadence)||
      !money(amount)||!dateOK(startOn)||reference.length<8||terms.length<30||b.confirmedSigned!==true)
      return error("Confira serviço, valor, periodicidade, data e referência do contrato assinado.",400);
    const sale=await query(db,"SELECT id,status FROM sales WHERE id=?",saleId).first();
    if(!sale||sale.status!=="paid")return error("Só é permitido registrar serviço recorrente após venda integralmente recebida e conferência contratual.",409);
    const agreementId=id();
    try{
      await db.batch([
        query(db,"INSERT INTO service_agreements(id,sale_id,kind,amount_cents,cadence,start_on,contract_reference,terms_summary,created_by) VALUES (?,?,?,?,?,?,?,?,?)",agreementId,saleId,kind,amount,cadence,startOn,reference,terms,user.id),
        query(db,auditSQL,id(),user.id,"service.agreement.create","service_agreement",agreementId,"kind="+kind+" cadence="+cadence+" amount="+amount+" contract="+reference)
      ]);
    }catch(e){if(duplicate(e))return error("Já existe um serviço desse tipo para esta venda ou os dados são inválidos. Confira o registro antes de repetir.",409);throw e;}
    return respond({ok:true,id:agreementId,status:"active"},201);
  }
  if(route==="admin/billing/agreement-status"&&method==="POST"){
    const b=await readBody(request),agreementId=str(b.id,60),next=str(b.status,12),reason=str(b.reason,500);
    if(!["active","paused","cancelled"].includes(next)||reason.length<8||b.confirmedReview!==true)
      return error("Confirme a decisão e informe uma justificativa com pelo menos 8 caracteres.",400);
    const agreement=await query(db,"SELECT id,status,contract_reference FROM service_agreements WHERE id=?",agreementId).first();
    if(!agreement)return error("Contrato de serviço não encontrado.",404);
    if(!((agreement.status==="active"&&["paused","cancelled"].includes(next))||
      (agreement.status==="paused"&&["active","cancelled"].includes(next))))
      return error("Mudança não permitida para este contrato; um cancelamento não pode ser revertido.",409);
    try{
      const updates=await db.batch([
        query(db,"UPDATE service_agreements SET status=?,updated_at=datetime('now') WHERE id=? AND status=?",next,agreementId,agreement.status),
        query(db,auditSQL,id(),user.id,"service.agreement.status","service_agreement",agreementId,agreement.status+" -> "+next+" | "+reason)
      ]);
      if(updates[0].meta?.changes!==1)return error("Contrato alterado em outra sessão.",409);
    }catch(e){if(duplicate(e))return error("Não foi possível alterar o status do serviço.",409);throw e;}
    return respond({ok:true,id:agreementId,status:next});
  }
  if(route==="admin/billing/charge"&&method==="POST"){
    const b=await readBody(request),agreementId=str(b.agreementId,60),period=str(b.period,7),dueOn=str(b.dueOn,10);
    if(b.confirmedManual!==true||!dateOK(dueOn))return error("Confira a competência, vencimento e confirmação manual.",400);
    const a=await query(db,"SELECT id,status,cadence,start_on,amount_cents FROM service_agreements WHERE id=?",agreementId).first();
    if(!a||a.status!=="active")return error("Serviço não encontrado ou não está ativo.",409);
    if(!periodOK(period,a.cadence,dueOn)||dueOn<a.start_on)return error("Competência ou vencimento incompatíveis com a vigência do contrato.",400);
    const chargeId=id();
    try{
      await db.batch([
        query(db,"INSERT INTO service_charges(id,agreement_id,period,due_on,amount_cents,created_by) VALUES (?,?,?,?,?,?)",chargeId,agreementId,period,dueOn,a.amount_cents,user.id),
        query(db,auditSQL,id(),user.id,"service.charge.create","service_charge",chargeId,"agreement="+agreementId+" period="+period+" due="+dueOn+" amount="+a.amount_cents)
      ]);
    }catch(e){if(duplicate(e))return error("Competência já registrada ou cobrança não corresponde ao contrato. Não duplique lançamentos.",409);throw e;}
    return respond({ok:true,id:chargeId,status:"pending",amountCents:a.amount_cents},201);
  }
  if(route==="admin/billing/receipt"&&method==="POST"){
    const b=await readBody(request),chargeId=str(b.chargeId,60),reference=str(b.reference,120),amount=b.amountCents;
    if(b.confirmedBank!==true||!money(amount)||reference.length<3)return error("Confirme a conciliação real e informe valor e referência bancária.",400);
    const receiptId=id();
    try{
      await db.batch([
        query(db,"INSERT INTO service_receipts(id,charge_id,amount_cents,reference,actor_id) VALUES (?,?,?,?,?)",receiptId,chargeId,amount,reference,user.id),
        query(db,auditSQL,id(),user.id,"service.receipt","service_charge",chargeId,"amount="+amount+" reference="+reference)
      ]);
    }catch(e){if(duplicate(e))return error("Recebimento duplicado, saldo insuficiente ou referência já utilizada em outra venda. Revise a conciliação.",409);throw e;}
    const updated=await query(db,"SELECT received_cents,status,amount_cents FROM service_charges WHERE id=?",chargeId).first();
    return respond({ok:true,id:receiptId,chargeId,status:updated.status,receivedCents:updated.received_cents});
  }
  return error("Operação financeira não encontrada.",404);
}
