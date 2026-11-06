import {respond,error,readBody,checkOrigin,str,email} from "../../_lib/security.js";
import {authenticatedUser} from "../../_lib/auth.js";
const statuses=new Set(["received","review","requested","interview","preapproved","documentation","approved","rejected","withdrawn"]);
const repStages=new Set(["new","contact","interested","qualified","proposal","negotiation","lost"]);
const projectStages=new Set(["proposed","accepted","in_progress","review","changes","approved","done","cancelled"]);
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
const positive=(v,max=100000000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const fresh=()=>crypto.randomUUID();
const audit=async(db,user,action,entity,id,details="")=>query(db,"INSERT INTO audit_events (id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",fresh(),user.id,action,entity,id,details).run();
const allowed=(user,...roles)=>roles.includes(user.role);
export async function onRequest(context){
  const {request,env}=context;
  const method=request.method,route=new URL(request.url).pathname.replace(/^\/api\/private\/?/,"").replace(/\/$/,"");
  if(!["GET","POST"].includes(method))return error("Método não permitido.",405);
  if(method==="POST"&&!checkOrigin(request))return error("Origem não autorizada.",403);
  let user;
  try{user=await authenticatedUser(request,env);}catch{return error("Acesso restrito. Faça login e confirme que sua conta está ativa.",403);}
  const db=env.DB;
  try{
    if(route==="me"&&method==="GET")return respond({ok:true,user});
    if(route==="admin/overview"&&method==="GET"&&allowed(user,"admin")){
      const [applicants,reps,devs,opportunities,received,commissions,inquiries,overdue,receivables,staleLeads]=await db.batch([
        db.prepare("SELECT status,COUNT(*) total FROM applications GROUP BY status"),
        db.prepare("SELECT role,COUNT(*) total FROM users WHERE status='active' GROUP BY role"),
        db.prepare("SELECT stage,COUNT(*) total FROM projects GROUP BY stage"),
        db.prepare("SELECT stage,COUNT(*) total FROM opportunities GROUP BY stage"),
        db.prepare("SELECT COALESCE(SUM(received_cents),0) total FROM sales WHERE status IN ('paid','partially_paid')"),
        db.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM commissions WHERE status IN ('due','approved')"),
        db.prepare("SELECT status,COUNT(*) total FROM studio_inquiries GROUP BY status"),
        db.prepare("SELECT COUNT(*) total FROM projects WHERE due_at IS NOT NULL AND date(due_at)<date('now') AND stage NOT IN ('done','cancelled')"),
        db.prepare("SELECT COUNT(*) total,COALESCE(SUM(gross_cents-received_cents),0) amount FROM sales WHERE status IN ('pending','partially_paid')"),
        db.prepare("SELECT COUNT(*) total FROM opportunities WHERE updated_at<datetime('now','-7 days') AND stage NOT IN ('paid','cancelled','lost')")
      ]);
      const total=(list,status)=>list.find(x=>x.status===status)?.total||0;
      return respond({
        ok:true,applications:applicants.results,users:reps.results,projects:devs.results,
        opportunities:opportunities.results,receivedCents:received.results[0].total,
        commissionsPendingCents:commissions.results[0].total,
        studioInquiries:inquiries.results,
        tasks:{
          candidates:applicants.results.filter(x=>['received','review','requested','interview','preapproved','documentation'].includes(x.status)).reduce((n,x)=>n+x.total,0),
          newCandidates:total(applicants.results,'received'),
          studioNew:total(inquiries.results,'new'),
          studioOpen:inquiries.results.filter(x=>['new','review','qualified','proposal'].includes(x.status)).reduce((n,x)=>n+x.total,0),
          overdueProjects:overdue.results[0].total,
          salesAwaitingPayment:receivables.results[0].total,
          accountsReceivableCents:receivables.results[0].amount,
          dormantOpportunities:staleLeads.results[0].total
        }
      });
    }
    if(route==="admin/studio-inquiries"&&method==="GET"&&allowed(user,"admin")){
      const entries=await db.prepare("SELECT i.id,i.protocol,i.name,i.company,i.email,i.phone,i.goal,i.notes,i.briefing,i.product,i.estimate_cents,i.status,i.assigned_partner_id,i.opportunity_id,i.reviewer_note,i.created_at,i.updated_at,u.name partner_name FROM studio_inquiries i LEFT JOIN users u ON u.id=i.assigned_partner_id ORDER BY i.created_at DESC LIMIT 250").all();
      return respond({ok:true,inquiries:entries.results});
    }
    if(route==="admin/studio-status"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.id,60),status=str(b.status,20),note=str(b.note,1200);
      const transitions={
        new:["review","archived"],
        review:["qualified","archived"],
        qualified:["proposal","archived"],
        proposal:["closed","archived"],
        closed:[],archived:[]
      };
      const item=await query(db,"SELECT id,status FROM studio_inquiries WHERE id=?",id).first();
      if(!item)return error("Solicitação não encontrada.",404);
      if(!(transitions[item.status]||[]).includes(status))return error("Etapa de atendimento inválida.",409);
      const update=await query(db,"UPDATE studio_inquiries SET status=?,reviewer_note=?,updated_at=datetime('now') WHERE id=? AND status=?",status,note,id,item.status).run();
      if(update.meta?.changes!==1)return error("Solicitação atualizada por outra operação.",409);
      await audit(db,user,"studio.review","studio_inquiry",id,item.status+" -> "+status);
      return respond({ok:true,status});
    }
    if(route==="admin/studio-assign"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.inquiryId,60),partnerId=str(b.partnerId,60);
      if(!id||!partnerId)return error("Solicitação e representante obrigatórios.");
      const entry=await query(db,"SELECT * FROM studio_inquiries WHERE id=?",id).first();
      if(!entry||!["new","review","qualified","proposal"].includes(entry.status))return error("Solicitação indisponível para atribuição.",404);
      if(entry.opportunity_id)return error("Solicitação já vinculada a uma oportunidade.",409);
      const partner=await query(db,"SELECT id FROM users WHERE id=? AND role='representante' AND status='active'",partnerId).first();
      if(!partner)return error("Escolha um representante aprovado e ativo.",400);
      const oppId=fresh(),contact=entry.email||entry.phone,company=entry.company||entry.name;
      const note=("USBRIN Studio "+entry.protocol+" | Objetivo: "+entry.goal+" | Briefing em solicitações Studio.").slice(0,1200);
      try{
        await db.batch([
          query(db,"INSERT INTO opportunities(id,partner_id,company,contact,segment,product,estimated_cents,stage,note) VALUES (?,?,?,?,?,?,?,'new',?)",oppId,partnerId,company,contact,"Studio",entry.product,entry.estimate_cents,note),
          query(db,"INSERT INTO studio_inquiry_assignments(inquiry_id,opportunity_id,partner_id,assigned_by) VALUES (?,?,?,?)",id,oppId,partnerId,user.id),
          query(db,"UPDATE studio_inquiries SET assigned_partner_id=?,opportunity_id=?,updated_at=datetime('now') WHERE id=? AND opportunity_id IS NULL",partnerId,oppId,id),
          query(db,"INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",fresh(),user.id,"studio.assign","studio_inquiry",id,"opportunity="+oppId+" partner="+partnerId)
        ]);
      }catch(e){
        if(/UNIQUE|constraint/i.test(String(e)))return error("Esta solicitação já foi atribuída. Atualize a página.",409);
        throw e;
      }
      return respond({ok:true,opportunityId:oppId});
    }
    if(route==="admin/applications"&&method==="GET"&&allowed(user,"admin")){
      const records=await db.prepare("SELECT * FROM applications ORDER BY created_at DESC LIMIT 250").all();return respond({ok:true,applications:records.results});
    }
    if(route==="admin/review"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),status=str(b.status,30),id=str(b.id,50),note=str(b.note,1200);
      if(!statuses.has(status)||!id)return error("Dados inválidos.");
      const original=await query(db,"SELECT id,status FROM applications WHERE id=?",id).first();if(!original)return error("Candidatura não localizada.",404);
      const transitions={
        received:["review","rejected","withdrawn"],
        review:["requested","interview","preapproved","rejected","withdrawn"],
        requested:["review","rejected","withdrawn"],
        interview:["preapproved","rejected","withdrawn"],
        preapproved:["documentation","rejected","withdrawn"],
        documentation:["approved","rejected","withdrawn"],
        approved:[],rejected:[],withdrawn:[]
      };
      if(!(transitions[original.status]||[]).includes(status))return error("Etapa de seleção inválida. Siga o processo de avaliação e formalização.",409);
      const updated=await query(db,"UPDATE applications SET status=?,reviewer_note=?,updated_at=datetime('now') WHERE id=? AND status=?",status,note,id,original.status).run();
      if(updated.meta?.changes!==1)return error("Candidatura já foi alterada. Atualize a lista.",409);
      await audit(db,user,"application.review","application",id,original.status+" -> "+status);return respond({ok:true});
    }
    if(route==="admin/activate"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.applicationId,50);
      const contractReference=str(b.contractReference,120);
      if(b.contractVerified!==true||contractReference.length<5)return error("Confirme a assinatura e informe a referência documental do contrato.");
      const a=await query(db,"SELECT id,name,email,type,status FROM applications WHERE id=?",id).first();
      if(!a||a.status!=="approved")return error("A candidatura ainda não está aprovada.");
      const role=a.type;
      const existing=await query(db,"SELECT id FROM users WHERE email=?",a.email).first();
      if(existing)return error("Esta identidade já possui conta; revisão administrativa necessária.",409);
      await query(db,"INSERT INTO users(id,email,name,role,status,application_id,contract_reference,contract_verified_at,created_at) VALUES (?,?,?,?, 'active',?,?,datetime('now'),datetime('now'))",fresh(),a.email,a.name,role,a.id,contractReference).run();
      await audit(db,user,"user.activate","application",id,role+" contract="+contractReference);return respond({ok:true});
    }
    if(route==="admin/finance"&&method==="GET"&&allowed(user,"admin")){
      const [commissions,sales,receivableSales]=await db.batch([
        db.prepare("SELECT c.*,u.name partner_name FROM commissions c JOIN users u ON u.id=c.partner_id ORDER BY c.created_at DESC LIMIT 200"),
        db.prepare("SELECT s.id,s.received_cents,s.status,s.gross_cents,o.company FROM sales s JOIN opportunities o ON o.id=s.opportunity_id WHERE s.status='paid' AND NOT EXISTS(SELECT 1 FROM commissions c WHERE c.sale_id=s.id) ORDER BY s.created_at DESC LIMIT 200"),
        db.prepare("SELECT s.id,s.received_cents,s.gross_cents,o.company FROM sales s JOIN opportunities o ON o.id=s.opportunity_id WHERE s.status IN ('pending','partially_paid') AND s.received_cents<s.gross_cents ORDER BY s.updated_at DESC LIMIT 200")
      ]);
      return respond({ok:true,commissions:commissions.results,sales:sales.results,receivableSales:receivableSales.results});
    }
    if(route==="admin/users"&&method==="GET"&&allowed(user,"admin")){
      const rows=await db.prepare("SELECT id,name,email,role,status FROM users ORDER BY created_at DESC LIMIT 250").all();
      return respond({ok:true,users:rows.results});
    }
    if(route==="admin/goal"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.partnerId,60),period=str(b.period,7),value=b.goalCents;
      if(!/^\\d{4}-\\d{2}$/.test(period)||!positive(value))return error("Meta inválida.");
      const rep=await query(db,"SELECT id FROM users WHERE id=? AND role='representante' AND status='active'",id).first();
      if(!rep)return error("Representante não encontrado.");
      await query(db,"INSERT INTO goals(id,partner_id,period,goal_cents) VALUES (?,?,?,?) ON CONFLICT(partner_id,period) DO UPDATE SET goal_cents=excluded.goal_cents",fresh(),id,period,value).run();
      await audit(db,user,"goal.update","user",id,period+" "+value);return respond({ok:true});
    }
    if(route==="admin/opportunities"&&method==="GET"&&allowed(user,"admin")){
      const rows=await db.prepare("SELECT o.*,u.name representative FROM opportunities o JOIN users u ON u.id=o.partner_id ORDER BY o.updated_at DESC LIMIT 200").all();return respond({ok:true,opportunities:rows.results});
    }
    if(route==="admin/sale"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.opportunityId,50),gross=b.grossCents,received=b.receivedCents,reference=str(b.reference,120);
      if(!positive(gross)||gross===0||!positive(received)||received>gross)return error("Valores inválidos: envie centavos inteiros.");
      if(received>0&&reference.length<3)return error("Informe a referência do recebimento conciliado.");
      const lead=await query(db,"SELECT id,stage FROM opportunities WHERE id=?",id).first();
      if(!lead||["lost","cancelled"].includes(lead.stage))return error("Oportunidade não encontrada ou encerrada.",404);
      const saleId=fresh(),status=received===gross?"paid":received>0?"partially_paid":"pending";
      try{
        const statements=[
          query(db,"INSERT INTO sales(id,opportunity_id,gross_cents,received_cents,receipt_reference,status) VALUES (?,?,?,?,?,?)",saleId,id,gross,received,reference||null,status),
          query(db,"UPDATE opportunities SET stage=?,updated_at=datetime('now') WHERE id=?",received===gross?"paid":"contracted",id)
        ];
        if(received>0)statements.push(query(db,"INSERT INTO sale_receipts (id,sale_id,amount_cents,reference,actor_id) VALUES (?,?,?,?,?)",fresh(),saleId,received,reference,user.id));
        statements.push(query(db,"INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",fresh(),user.id,"sale.create","sale",saleId,"received="+received));
        await db.batch(statements);
      }catch(e){
        if(/UNIQUE|constraint/i.test(String(e)))return error("Venda ou referência já registrada. Verifique os lançamentos.",409);
        throw e;
      }
      return respond({ok:true,saleId,status});
    }
    if(route==="admin/sale-receipt"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),saleId=str(b.saleId,60),amount=b.amountCents,reference=str(b.reference,120);
      if(!positive(amount)||amount===0||reference.length<3)return error("Recebimento ou referência inválida.");
      const sale=await query(db,"SELECT id,gross_cents,received_cents,status,opportunity_id FROM sales WHERE id=?",saleId).first();
      if(!sale||!["pending","partially_paid"].includes(sale.status)||sale.received_cents+amount>sale.gross_cents)return error("Recebimento excede o saldo ou venda não permite novos lançamentos.");
      const newTotal=sale.received_cents+amount,final=newTotal===sale.gross_cents?"paid":"partially_paid";
      try{
        const results=await db.batch([
          query(db,"INSERT INTO sale_receipts(id,sale_id,amount_cents,reference,actor_id) VALUES (?,?,?,?,?)",fresh(),saleId,amount,reference,user.id),
          query(db,"UPDATE sales SET received_cents=?,status=?,updated_at=datetime('now') WHERE id=? AND received_cents=? AND status=?",newTotal,final,saleId,sale.received_cents,sale.status),
          query(db,"UPDATE opportunities SET stage=?,updated_at=datetime('now') WHERE id=?",final==="paid"?"paid":"contracted",sale.opportunity_id),
          query(db,"INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",fresh(),user.id,"sale.receipt","sale",saleId,"amount="+amount+" reference="+reference)
        ]);
        if(results[1]?.meta?.changes!==1)throw Error("Conflito de atualização, revise o saldo da venda.");
      }catch(e){
        if(/UNIQUE|constraint/i.test(String(e)))return error("Referência duplicada ou falha de integridade.",409);
        throw e;
      }
      return respond({ok:true,saleId,receivedCents:newTotal,status:final});
    }
    if(route==="admin/commission"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),saleId=str(b.saleId,50),rate=b.rateBps;
      if(!Number.isInteger(rate)||rate<0||rate>5000)return error("Taxa inválida em pontos-base.");
      const s=await query(db,"SELECT s.id,s.received_cents,s.status,o.partner_id FROM sales s JOIN opportunities o ON o.id=s.opportunity_id WHERE s.id=?",saleId).first();
      if(!s||s.status!=="paid")return error("A venda precisa estar integralmente recebida.");
      const existing=await query(db,"SELECT id FROM commissions WHERE sale_id=?",saleId).first();if(existing)return error("Comissão existente, revise o registro.",409);
      const cents=Math.round(s.received_cents*rate/10000),id=fresh();
      try{await query(db,"INSERT INTO commissions(id,sale_id,partner_id,basis_cents,rate_bps,amount_cents,status) VALUES (?,?,?,?,?,?,'estimated')",id,saleId,s.partner_id,s.received_cents,rate,cents).run();}catch(e){if(/UNIQUE|constraint/i.test(String(e)))return error("Comissão já registrada.",409);throw e;}
      await audit(db,user,"commission.create","commission",id,"bps="+rate);
      return respond({ok:true,id,amountCents:cents});
    }
    if(route==="admin/commission-status"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.id,50),status=str(b.status,20),reference=str(b.reference,120);
      if(!["approved","due","paid","reversed"].includes(status))return error("Estado inválido.");
      const c=await query(db,"SELECT id,status FROM commissions WHERE id=?",id).first();
      if(!c)return error("Comissão não encontrada.",404);
      if(!({estimated:["approved","reversed"],approved:["due","reversed"],due:["paid","reversed"],paid:[],reversed:[]}[c.status]||[]).includes(status))return error("Transição de comissão não permitida.");
      if(status==="paid"&&reference.length<3)return error("Informe a referência bancária do pagamento.");
      const results=await db.batch([
        query(db,"UPDATE commissions SET status=?,payment_reference=CASE WHEN ?='paid' THEN ? ELSE payment_reference END,paid_at=CASE WHEN ?='paid' THEN datetime('now') ELSE paid_at END WHERE id=? AND status=?",status,status,reference,status,id,c.status),
        query(db,"INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",fresh(),user.id,"commission.status","commission",id,c.status+" -> "+status+" "+(status==="paid"?reference:""))
      ]);
      if(results[0]?.meta?.changes!==1)return error("Comissão alterada por outra operação. Atualize a página.",409);
      return respond({ok:true});
    }
    if(route==="representante/dashboard"&&method==="GET"&&allowed(user,"representante")){
      const [leads,commissions,goals,sales]=await db.batch([
        query(db,"SELECT * FROM opportunities WHERE partner_id=? ORDER BY updated_at DESC LIMIT 200",user.id),
        query(db,"SELECT c.*,s.gross_cents,s.received_cents FROM commissions c JOIN sales s ON s.id=c.sale_id WHERE c.partner_id=? ORDER BY c.created_at DESC LIMIT 100",user.id),
        query(db,"SELECT period,goal_cents FROM goals WHERE partner_id=? ORDER BY period DESC LIMIT 12",user.id),
        query(db,"SELECT r.amount_cents,r.received_at FROM sale_receipts r JOIN sales s ON s.id=r.sale_id JOIN opportunities o ON o.id=s.opportunity_id WHERE o.partner_id=? AND s.status!='reversed' ORDER BY r.received_at DESC LIMIT 500",user.id)
      ]);
      return respond({ok:true,leads:leads.results,commissions:commissions.results,goals:goals.results,sales:sales.results});
    }
    if(route==="representante/lead"&&method==="POST"&&allowed(user,"representante")){
      const b=await readBody(request),company=str(b.company,160),contact=str(b.contact,160),value=Number(b.estimatedCents||0);
      if(company.length<3||contact.length<3||!positive(value))return error("Empresa, contato e valor precisam ser válidos.");
      const id=fresh();
      await query(db,"INSERT INTO opportunities(id,partner_id,company,contact,city,segment,product,estimated_cents,stage,note) VALUES (?,?,?,?,?,?,?,?, 'new',?)",id,user.id,company,contact,str(b.city,120),str(b.segment,120),str(b.product,80),value,str(b.note,1200)).run();
      await audit(db,user,"lead.create","opportunity",id);return respond({ok:true,id},201);
    }
    if(route==="representante/lead-stage"&&method==="POST"&&allowed(user,"representante")){
      const b=await readBody(request),id=str(b.id,50),stage=str(b.stage,30);
      if(!repStages.has(stage))return error("O parceiro não pode confirmar contratos nem pagamentos.");
      const result=await query(db,"UPDATE opportunities SET stage=?,updated_at=datetime('now') WHERE id=? AND partner_id=? AND stage NOT IN ('contracted','paid','cancelled','lost')",stage,id,user.id).run();
      if(!result.meta?.changes)return error("Oportunidade inexistente ou bloqueada.",404);
      await audit(db,user,"lead.stage","opportunity",id,stage);return respond({ok:true});
    }
    if(route==="admin/projects"&&method==="GET"&&allowed(user,"admin")){
      const rows=await db.prepare("SELECT p.*,u.name developer FROM projects p LEFT JOIN users u ON u.id=p.developer_id ORDER BY p.created_at DESC LIMIT 200").all();
      return respond({ok:true,projects:rows.results});
    }
    if(route==="admin/project"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),title=str(b.title,160),description=str(b.description,5000),developerId=str(b.developerId,60),amount=b.compensationCents;
      if(title.length<3||description.length<15||!positive(amount)||!developerId)return error("Projeto inválido.");
      const dev=await query(db,"SELECT id FROM users WHERE id=? AND role='desenvolvedor' AND status='active'",developerId).first();
      if(!dev)return error("Desenvolvedor não habilitado.");
      const id=fresh();
      await query(db,"INSERT INTO projects(id,title,description,developer_id,compensation_cents,due_at) VALUES (?,?,?,?,?,?)",id,title,description,developerId,amount,str(b.dueAt,30)||null).run();
      await audit(db,user,"project.create","project",id);return respond({ok:true,id},201);
    }
    if(route==="admin/project-stage"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.id,50),stage=str(b.stage,25);
      if(!projectStages.has(stage))return error("Etapa inválida.");
      const project=await query(db,"SELECT id,stage FROM projects WHERE id=?",id).first();
      if(!project)return error("Projeto não encontrado.",404);
      const allowedTransitions={proposed:["cancelled"],accepted:["cancelled"],in_progress:["changes","cancelled"],review:["changes","approved","cancelled"],changes:["review","cancelled"],approved:["done"],done:[],cancelled:[]};
      if(!(allowedTransitions[project.stage]||[]).includes(stage))return error("Mudança de etapa inválida para o projeto.",409);
      const result=await query(db,"UPDATE projects SET stage=?,updated_at=datetime('now') WHERE id=? AND stage=?",stage,id,project.stage).run();
      if(result.meta?.changes!==1)return error("Projeto alterado por outra operação. Atualize os dados.",409);
      await audit(db,user,"project.stage","project",id,stage);return respond({ok:true});
    }
    if(route==="admin/developer-payment"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),projectId=str(b.projectId,60),value=b.amountCents,status=str(b.status,20);
      if(!positive(value)||value===0||!["pending","approved"].includes(status))return error("Dados de remuneração inválidos.");
      const p=await query(db,"SELECT id,developer_id,compensation_cents,stage FROM projects WHERE id=?",projectId).first();
      if(!p||!p.developer_id||!["approved","done"].includes(p.stage))return error("Projeto precisa estar aprovado ou concluído.");
      const existing=await query(db,"SELECT COALESCE(SUM(amount_cents),0) total FROM developer_payments WHERE project_id=? AND status!='cancelled'",projectId).first();
      if(existing.total+value>p.compensation_cents)return error("Remuneração excede o valor contratado.");
      const id=fresh();
      await query(db,"INSERT INTO developer_payments(id,project_id,developer_id,amount_cents,status) VALUES (?,?,?,?,?)",id,projectId,p.developer_id,value,status).run();
      await audit(db,user,"developer.payment.create","developer_payment",id);return respond({ok:true,id});
    }
    if(route==="admin/developer-payment-status"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.id,60),next=str(b.status,20),reference=str(b.reference,120);
      const old=await query(db,"SELECT id,status FROM developer_payments WHERE id=?",id).first();
      if(!old||!({pending:["approved","cancelled"],approved:["paid","cancelled"],paid:[],cancelled:[]}[old.status]||[]).includes(next))return error("Atualização de pagamento não permitida.");
      if(next==="paid"&&!reference)return error("Referência financeira obrigatória.");
      const update=await query(db,"UPDATE developer_payments SET status=?,payment_reference=CASE WHEN ?='paid' THEN ? ELSE payment_reference END,paid_at=CASE WHEN ?='paid' THEN datetime('now') ELSE paid_at END WHERE id=? AND status=?",next,next,reference,next,id,old.status).run();if(update.meta?.changes!==1)return error("Pagamento alterado por outra operação.",409);
      await audit(db,user,"developer.payment.status","developer_payment",id,old.status+" -> "+next);return respond({ok:true});
    }
    if(route==="admin/developer-payments"&&method==="GET"&&allowed(user,"admin")){
      const p=await db.prepare("SELECT d.*,p.title,u.name developer FROM developer_payments d JOIN projects p ON p.id=d.project_id JOIN users u ON u.id=d.developer_id ORDER BY d.created_at DESC LIMIT 200").all();
      return respond({ok:true,payments:p.results});
    }
    if(route==="desenvolvedor/dashboard"&&method==="GET"&&allowed(user,"desenvolvedor")){
      const [p,payments]=await db.batch([
        query(db,"SELECT * FROM projects WHERE developer_id=? ORDER BY updated_at DESC LIMIT 200",user.id),
        query(db,"SELECT id,project_id,amount_cents,status,paid_at FROM developer_payments WHERE developer_id=? ORDER BY created_at DESC LIMIT 200",user.id)
      ]);
      return respond({ok:true,projects:p.results,payments:payments.results});
    }
    if(route==="desenvolvedor/project"&&method==="POST"&&allowed(user,"desenvolvedor")){
      const b=await readBody(request),id=str(b.id,50),stage=str(b.stage,25);
      if(!["accepted","in_progress","review"].includes(stage))return error("Etapa não permitida ao desenvolvedor.");
      const project=await query(db,"SELECT id,stage FROM projects WHERE id=? AND developer_id=?",id,user.id).first();
      if(!project||!({proposed:["accepted"],accepted:["in_progress"],in_progress:["review"],changes:["in_progress"]}[project.stage]||[]).includes(stage))return error("Transição não autorizada.");
      const preview=str(b.previewUrl,350);
      if(preview&&!/^https:\/\//.test(preview))return error("A prévia precisa usar HTTPS.");
      const updated=await query(db,"UPDATE projects SET stage=?,preview_url=CASE WHEN ?='' THEN preview_url ELSE ? END,updated_at=datetime('now') WHERE id=? AND developer_id=? AND stage=?",stage,preview,preview,id,user.id,project.stage).run();
      if(updated.meta?.changes!==1)return error("Projeto alterado por outra operação.",409);
      await audit(db,user,"project.progress","project",id,stage);return respond({ok:true});
    }
    return error("Recurso não encontrado ou acesso insuficiente.",404);
  }catch(e){return error(e instanceof SyntaxError?"JSON inválido.":"Não foi possível executar a operação.",e instanceof SyntaxError?400:500);}
}
