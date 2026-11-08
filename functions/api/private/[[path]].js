import {respond,error,readBody,checkOrigin,str,email} from "../../_lib/security.js";
import {authenticatedIdentity,AuthError} from "../../_lib/auth.js";
import {portalSessionEnabled,requirePortalSession} from "../../_lib/portal-session.js";
import {handleBilling} from "../../_lib/billing.js";
import {handleBank} from "../../_lib/bank-reconcile.js";
import {handleFinanceControl} from "../../_lib/finance-control.js";
const statuses=new Set(["received","review","requested","interview","preapproved","documentation","approved","rejected","withdrawn"]);
const partnerRoles=new Set(["representante","desenvolvedor"]);
const repStages=new Set(["new","contact","interested","qualified","proposal","negotiation","lost"]);
const projectStages=new Set(["proposed","accepted","in_progress","review","changes","approved","done","cancelled"]);
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
const positive=(v,max=100000000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const fresh=()=>crypto.randomUUID();
const audit=async(db,user,action,entity,id,details="")=>query(db,"INSERT INTO audit_events (id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",fresh(),user.id,action,entity,id,details).run();
const allowed=(user,...roles)=>roles.includes(user.role);
const isoDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+"T00:00:00Z");
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
};
const permittedOpportunity=async(db,user,id)=>{
  const item=await query(db,"SELECT id,partner_id,stage FROM opportunities WHERE id=?",id).first();
  if(!item)return null;
  return user.role==="admin"||item.partner_id===user.id?item:null;
};

export async function onRequest(context){
  const {request,env}=context;
  const method=request.method,route=new URL(request.url).pathname.replace(/^\/api\/private\/?/,"").replace(/\/$/,"");
  if(!["GET","POST"].includes(method))return error("Método não permitido.",405);
  if(method==="POST"&&!checkOrigin(request))return error("Origem não autorizada.",403);
  let user;
  try{
    const identity=await authenticatedIdentity(request,env);
    await requirePortalSession(request,env,identity,route!=="me");
    user=identity.user;
  }catch(e){
    if(e instanceof AuthError)return respond({ok:false,error:e.message,code:e.code},e.status);
    return error("Não foi possível verificar o acesso.",503);
  }
  const db=env.USBRIN_ID_DB;
  try{
    if(route.startsWith("admin/billing/"))return handleBilling({request,db,user,route});
    if(route.startsWith("admin/bank/"))return handleBank({request,db,user,route});
    if(route.startsWith("admin/control/"))return handleFinanceControl({request,db,user,route});
    if(route==="me"&&method==="GET")return respond({ok:true,user,workSession:portalSessionEnabled(env)});
    if(route==="session/activity"&&method==="POST"&&portalSessionEnabled(env))return respond({ok:true});
    if(route==="crm/history"&&method==="GET"&&allowed(user,"admin","representante")){
      const id=str(new URL(request.url).searchParams.get("id"),60);
      if(!id)return error("Informe a oportunidade.",400);
      const lead=await permittedOpportunity(db,user,id);
      if(!lead)return error("Oportunidade inexistente ou sem permissão.",404);
      const records=await query(db,"SELECT a.id,a.kind,a.note,a.created_at,u.name actor_name FROM crm_activities a LEFT JOIN users u ON u.id=a.actor_id WHERE a.opportunity_id=? ORDER BY a.created_at DESC,a.rowid DESC LIMIT 100",id).all();
      return respond({ok:true,activities:records.results});
    }
    if(route==="crm/proposals"&&method==="GET"&&allowed(user,"admin","representante")){
      const id=str(new URL(request.url).searchParams.get("id"),60);
      const lead=await permittedOpportunity(db,user,id);
      if(!lead)return error("Oportunidade inexistente ou sem permissão.",404);
      const select=user.role==="admin"
        ?"SELECT p.*,u.name author_name,o.company customer_company,o.contact customer_contact FROM proposals p LEFT JOIN users u ON u.id=p.created_by JOIN opportunities o ON o.id=p.opportunity_id WHERE p.opportunity_id=? ORDER BY p.created_at DESC,p.rowid DESC LIMIT 60"
        :"SELECT p.id,p.code,p.opportunity_id,p.product,p.scope,p.price_cents,p.duration_days,p.valid_until,p.terms,p.status,p.approved_at,p.sent_at,p.created_at,p.hosting_requested,p.support_requested,p.support_reference_monthly_cents,u.name author_name,o.company customer_company,o.contact customer_contact FROM proposals p LEFT JOIN users u ON u.id=p.created_by JOIN opportunities o ON o.id=p.opportunity_id WHERE p.opportunity_id=? ORDER BY p.created_at DESC,p.rowid DESC LIMIT 60";
      const rows=await query(db,select,id).all();
      return respond({ok:true,proposals:rows.results});
    }
    if(route==="crm/proposal-draft"&&method==="POST"&&allowed(user,"admin","representante")){
      const b=await readBody(request),opportunityId=str(b.opportunityId,60),product=str(b.product,30).toLowerCase(),
        scope=str(b.scope,4000),price=b.priceCents,days=b.durationDays,
        validUntil=str(b.validUntil,10),terms=str(b.terms,750),
        hostingRequested=b.hostingRequested===true,supportRequested=b.supportRequested===true;
      if(![undefined,true,false].includes(b.hostingRequested)||![undefined,true,false].includes(b.supportRequested))
        return error("Opções de serviços adicionais inválidas.",400);
      if(!["landing","business","catalogo","personalizado"].includes(product)||scope.length<30||!Number.isSafeInteger(price)||price<=0||price>100000000||
        !Number.isSafeInteger(days)||days<1||days>180||!isoDate(validUntil)||validUntil<new Date().toISOString().slice(0,10))
          return error("Revise escopo, preço, prazo e validade da proposta.",400);
      const lead=await permittedOpportunity(db,user,opportunityId);
      if(!lead)return error("Oportunidade não encontrada ou sem permissão.",404);
      if(["lost","cancelled","paid"].includes(lead.stage))return error("Oportunidade encerrada: não é possível criar proposta.",409);
      const id=fresh(),code="Q"+id.replace(/-/g,"").slice(0,13).toUpperCase();
      // Representatives may describe the technical scope, but may not define payment terms or billing instructions.
      const safeTerms=user.role==="representante"
        ?"Pagamento e cobrança exclusivamente com a administração da USBRIN, após aprovação comercial. A proposta não confirma contratação, recebimento ou início da produção. Serviços opcionais requerem condições próprias."
        :terms||null;
      await db.batch([
        query(db,"INSERT INTO proposals(id,code,opportunity_id,created_by,product,scope,price_cents,duration_days,valid_until,terms,status,hosting_requested,support_requested,support_reference_monthly_cents) VALUES (?,?,?,?,?,?,?,?,?,?,'draft',?,?,?)",id,code,opportunityId,user.id,product,scope,price,days,validUntil,safeTerms,hostingRequested?1:0,supportRequested?1:0,supportRequested?25000:0),
        query(db,"INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",fresh(),user.id,"proposal.draft","proposal",id,"draft "+code)
      ]);
      return respond({ok:true,id,code,status:"draft"},201);
    }
    if(route==="admin/proposal-review"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.id,60),decision=str(b.decision,15),note=str(b.note,1000);
      if(!["approved","rejected"].includes(decision))return error("Decisão de aprovação inválida.",400);
      const current=await query(db,"SELECT p.id,p.status,p.price_cents,p.valid_until,o.stage lead_stage FROM proposals p JOIN opportunities o ON o.id=p.opportunity_id WHERE p.id=?",id).first();
      if(!current)return error("Proposta não encontrada.",404);
      if(current.status!=="draft")return error("Esta proposta já foi analisada.",409);
      if(decision==="approved"&&["lost","paid","cancelled"].includes(current.lead_stage))return error("A oportunidade está encerrada. Não é possível aprovar nova proposta.",409);
      if(decision==="approved"&&(await query(db,"SELECT product FROM proposals WHERE id=?",id).first())?.product==="personalizado")
        return error("Pedido especial exige precificação manual e criação de nova proposta com preço final antes da aprovação.",409);
      if(decision==="rejected"&&note.length<8)return error("Informe o motivo da devolução.",400);
      if(decision==="approved"&&current.valid_until<new Date().toISOString().slice(0,10))return error("A proposta expirou; elabore uma nova versão.",409);
      // 15% of the one-off website price; optional support/hosting subscriptions are not part of this quote.
      const fixedCommissionCents=Math.round(current.price_cents*1500/10000);
      const costs=decision==="approved"?[b.developerCents,fixedCommissionCents,b.taxCents,b.otherCents]:[null,null,null,null];
      if(decision==="approved"&&costs.some(v=>!Number.isSafeInteger(v)||v<0||v>100000000))
        return error("Confirme todas as estimativas de custos em centavos inteiros.",400);
      const total=decision==="approved"?costs.reduce((n,v)=>n+v,0):0;
      if(decision==="approved"&&total>current.price_cents)
        return error("Os custos estimados superam o preço de venda. Revise os valores antes de aprovar.",409);
      const updated=await query(db,"UPDATE proposals SET status=?,cost_dev_cents=?,cost_commission_cents=?,cost_tax_cents=?,cost_other_cents=?,review_note=?,approved_by=CASE WHEN ?='approved' THEN ? ELSE NULL END,approved_at=CASE WHEN ?='approved' THEN datetime('now') ELSE NULL END,updated_at=datetime('now') WHERE id=? AND status='draft'",
        decision,...costs,note||null,decision,user.id,decision,id).run();
      if(updated.meta?.changes!==1)return error("A proposta foi atualizada em outra sessão.",409);
      await audit(db,user,"proposal.review","proposal",id,decision+" | custo_estimado="+total);
      return respond({ok:true,id,status:decision,marginCents:decision==="approved"?current.price_cents-total:null,marginBps:decision==="approved"?Math.round((current.price_cents-total)*10000/current.price_cents):null});
    }
    if(route==="admin/proposal-mark-sent"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.id,60);
      if(b.confirmedExternally!==true)return error("Confirme que enviou a proposta ao cliente fora do sistema.",400);
      const updated=await query(db,"UPDATE proposals SET status='sent',sent_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='approved' AND valid_until>=date('now')",id).run();
      if(updated.meta?.changes!==1)return error("Proposta não aprovada, vencida ou já marcada como enviada.",409);
      await audit(db,user,"proposal.sent","proposal",id,"external delivery confirmed");
      return respond({ok:true,status:"sent"});
    }
    if(route==="crm/activity"&&method==="POST"&&allowed(user,"admin","representante")){
      const b=await readBody(request),id=str(b.opportunityId,60),kind=str(b.kind,15),note=str(b.note,1200);
      if(!["contact","note"].includes(kind)||note.length<3)return error("Registre um contato ou uma observação válida.",400);
      const lead=await permittedOpportunity(db,user,id);
      if(!lead)return error("Oportunidade inexistente ou sem permissão.",404);
      const activityId=fresh();
      await db.batch([
        query(db,"INSERT INTO crm_activities(id,opportunity_id,actor_id,kind,note) VALUES (?,?,?,?,?)",activityId,id,user.id,kind,note),
        query(db,"UPDATE opportunities SET last_contact_at=CASE WHEN ?='contact' THEN datetime('now') ELSE last_contact_at END,updated_at=datetime('now') WHERE id=?",kind,id)
      ]);
      return respond({ok:true,id:activityId},201);
    }
    if(route==="crm/followup"&&method==="POST"&&allowed(user,"admin","representante")){
      const b=await readBody(request),id=str(b.opportunityId,60),action=str(b.action,160),day=str(b.date,10);
      if((action||day)&&(!isoDate(day)||action.length<3))return error("Informe uma próxima ação e uma data válida.",400);
      const lead=await permittedOpportunity(db,user,id);
      if(!lead)return error("Oportunidade inexistente ou sem permissão.",404);
      if(["paid","cancelled","lost"].includes(lead.stage))return error("Oportunidade encerrada; não pode receber novo acompanhamento.",409);
      await db.batch([
        query(db,"UPDATE opportunities SET next_action=?,next_action_at=?,updated_at=datetime('now') WHERE id=?",action||null,day||null,id),
        query(db,"INSERT INTO crm_activities(id,opportunity_id,actor_id,kind,note) VALUES (?,?,?,?,?)",fresh(),id,user.id,"followup",action?"Próxima ação em "+day+": "+action:"Próxima ação removida")
      ]);
      return respond({ok:true,nextAction:action||null,nextActionAt:day||null});
    }

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
          dormantOpportunities:staleLeads.results[0].total,
          dueFollowups:(await db.prepare("SELECT COUNT(*) total FROM opportunities WHERE next_action_at IS NOT NULL AND date(next_action_at)<=date('now') AND stage NOT IN ('paid','lost','cancelled')").first()).total,
          servicesOverdue:(await db.prepare("SELECT COUNT(*) total FROM service_charges WHERE status<>'paid' AND due_on<date('now','-4 hours')").first()).total,
          servicesDueToday:(await db.prepare("SELECT COUNT(*) total FROM service_charges WHERE status<>'paid' AND due_on=date('now','-4 hours')").first()).total
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
      const [,updated]=await db.batch([
        query(db,`INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at)
          SELECT ?,?,'application.review','application',id,?,datetime('now') FROM applications WHERE id=? AND status=?`,
          fresh(),user.id,original.status+" -> "+status,id,original.status),
        query(db,"UPDATE applications SET status=?,reviewer_note=?,updated_at=datetime('now') WHERE id=? AND status=?",status,note,id,original.status)
      ]);
      if(updated.meta?.changes!==1)return error("Candidatura já foi alterada. Atualize a lista.",409);
      return respond({ok:true});
    }
    if(route==="admin/application-note"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.id,60),note=str(b.note,1200);
      if(!id)return error("Informe a candidatura.",400);
      const updated=await query(db,"UPDATE applications SET reviewer_note=?,updated_at=datetime('now') WHERE id=?",note,id).run();
      if(updated.meta?.changes!==1)return error("Candidatura não localizada.",404);
      await audit(db,user,"application.note","application",id,"internal note updated");
      return respond({ok:true});
    }
    if(route==="admin/activate"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.applicationId,50);
      const contractReference=str(b.contractReference,120);
      if(b.contractVerified!==true||contractReference.length<5)return error("Confirme a assinatura e informe a referência documental do contrato.");
      const a=await query(db,"SELECT id,name,email,type,status FROM applications WHERE id=?",id).first();
      if(!a||a.status!=="approved")return error("A candidatura ainda não está aprovada.");
      const role=b.role===undefined?a.type:b.role;
      if(!partnerRoles.has(role))return error("Escolha um perfil de parceiro autorizado.",400);
      const userId=fresh();
      const [result]=await db.batch([
        query(db,`INSERT INTO users(id,email,name,role,status,application_id,contract_reference,contract_verified_at,created_at)
          SELECT ?,email,name,?,'active',id,?,datetime('now'),datetime('now')
          FROM applications WHERE id=? AND status='approved' ON CONFLICT(email) DO NOTHING`,userId,role,contractReference,id),
        query(db,`INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at)
          SELECT ?,?,'user.activate','user',id,role,datetime('now') FROM users WHERE id=?`,fresh(),user.id,userId)
      ]);
      if(result.meta?.changes!==1)return error("A candidatura mudou ou esta identidade já possui conta. Revise o cadastro.",409);
      return respond({ok:true});
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
      const rows=await db.prepare("SELECT id,name,email,role,status, CASE WHEN contract_verified_at IS NOT NULL AND length(contract_reference)>=5 THEN 1 ELSE 0 END contract_ready FROM users ORDER BY created_at DESC LIMIT 250").all();
      return respond({ok:true,users:rows.results});
    }
    if(route==="admin/access"&&method==="GET"&&allowed(user,"admin")){
      const params=new URL(request.url).searchParams;
      const search=str(params.get("q"),120).toLowerCase();
      const page=Number(params.get("page")||1);
      if(!Number.isSafeInteger(page)||page<1||page>1000)return error("Página inválida.",400);
      const offset=(page-1)*50;
      const [users,candidates,history]=await db.batch([
        query(db,`SELECT id,name,email,role,status,
          CASE WHEN contract_verified_at IS NOT NULL AND length(contract_reference)>=5 THEN 1 ELSE 0 END contract_ready
          FROM users WHERE instr(lower(name),?)>0 OR instr(lower(email),?)>0
          ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?`,search,search,offset),
        query(db,`SELECT a.id,a.protocol,a.name,a.email,a.type FROM applications a
          WHERE a.status='approved' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email=a.email COLLATE NOCASE)
          AND (instr(lower(a.name),?)>0 OR instr(lower(a.email),?)>0 OR instr(lower(a.protocol),?)>0)
          ORDER BY a.updated_at DESC,a.id DESC LIMIT 51 OFFSET ?`,search,search,search,offset),
        query(db,`SELECT ev.action,ev.details,ev.created_at,actor.name AS actor_name,
            COALESCE(target.name,a.name) AS target_name
          FROM audit_events ev
          LEFT JOIN users actor ON actor.id=ev.actor_id
          LEFT JOIN users target ON ev.entity='user' AND target.id=ev.entity_id
          LEFT JOIN applications a ON ev.entity='application' AND a.id=ev.entity_id
          WHERE ev.action IN ('application.review','user.activate','partner.access','user.invite_prepared')
          AND (?='' OR instr(lower(COALESCE(target.name,a.name,'')),?)>0
            OR instr(lower(COALESCE(target.email,a.email,'')),?)>0)
          ORDER BY ev.created_at DESC,ev.rowid DESC LIMIT 51 OFFSET ?`,search,search,search,offset)
      ]);
      return respond({ok:true,users:users.results.slice(0,50),candidates:candidates.results.slice(0,50),
        history:history.results.slice(0,50),hasNext:[users,candidates,history].some(x=>x.results.length>50)});
    }
    if(route==="admin/access/invitation"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.userId,60);
      if(!id)return error("Selecione um parceiro.",400);
      const partner=await query(db,"SELECT name,email,role FROM users WHERE id=?",id).first();
      if(!partner||!partnerRoles.has(partner.role))return error("Parceiro não encontrado.",404);
      const event=await query(db,`INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at)
        SELECT ?,?,'user.invite_prepared','user',id,role,datetime('now')
        FROM users WHERE id=? AND role IN ('representante','desenvolvedor') AND status='active'
          AND contract_verified_at IS NOT NULL AND length(contract_reference)>=5`,fresh(),user.id,id).run();
      if(event.meta?.changes!==1)return error("O convite exige conta ativa e contrato verificado.",409);
      const url=new URL("/portal",request.url).href;
      const role=partner.role==="representante"?"representante comercial":"parceiro de desenvolvimento";
      const message=`Olá, ${partner.name}. Seu perfil de ${role} foi aprovado na USBRIN. Acesse ${url} com ${partner.email} depois que confirmarmos a liberação no Cloudflare Access. Na tela da Cloudflare, siga a verificação por e-mail e use seu aplicativo autenticador se solicitado.`;
      return respond({ok:true,invitation:{email:partner.email,message}});
    }
    if(route==="admin/partner-access"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.userId,60),next=str(b.status,15),reason=str(b.reason,500);
      if(!id||!["active","suspended"].includes(next)||reason.length<8)return error("Informe o parceiro, a ação e uma justificativa de pelo menos 8 caracteres.",400);
      const partner=await query(db,"SELECT id,role,status,contract_reference,contract_verified_at FROM users WHERE id=?",id).first();
      if(!partner||!["representante","desenvolvedor"].includes(partner.role))return error("Somente acessos de parceiros podem ser alterados por esta função.",404);
      if(partner.status===next||!["active","suspended"].includes(partner.status))return error("Mudança de acesso não permitida no estado atual.",409);
      if(next==="active"&&(!partner.contract_verified_at||String(partner.contract_reference||"").length<5))
        return error("Reativação exige um contrato previamente assinado e verificado.",409);
      const results=await db.batch([
        query(db,`INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at)
          SELECT ?,?,'partner.access','user',id,?,datetime('now')
          FROM users WHERE id=? AND status=? AND role IN ('representante','desenvolvedor')`,
          fresh(),user.id,partner.status+" -> "+next+" | motivo: "+reason,id,partner.status),
        ...(next==="suspended"&&portalSessionEnabled(env)?[
          query(db,`UPDATE portal_sessions SET ended_at=CAST(strftime('%s','now') AS INTEGER)
            WHERE user_id=? AND ended_at IS NULL AND EXISTS (SELECT 1 FROM users WHERE id=? AND status=?)`,
            id,id,partner.status),
          query(db,`DELETE FROM portal_session_challenges WHERE user_id=?
            AND EXISTS (SELECT 1 FROM users WHERE id=? AND status=?)`,id,id,partner.status)
        ]:[]),
        query(db,"UPDATE users SET status=? WHERE id=? AND status=? AND role IN ('representante','desenvolvedor')",next,id,partner.status)
      ]);
      if(results.at(-1)?.meta?.changes!==1)return error("O acesso foi alterado por outra operação; atualize a lista.",409);
      return respond({ok:true,id,status:next});
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
          query(db,"INSERT INTO sales(id,opportunity_id,gross_cents,received_cents,receipt_reference,status) VALUES (?,?,?,?,?,'pending')",saleId,id,gross,0,reference||null),
          query(db,"UPDATE opportunities SET stage='contracted',updated_at=datetime('now') WHERE id=?",id)
        ];
        if(received>0)statements.push(query(db,"INSERT INTO sale_receipts (id,sale_id,amount_cents,reference,actor_id) VALUES (?,?,?,?,?)",fresh(),saleId,received,reference,user.id));
        statements.push(query(db,"INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",fresh(),user.id,"sale.create","sale",saleId,"received="+received));
        await db.batch(statements);
      }catch(e){
        if(/UNIQUE|constraint|reference already/i.test(String(e)))return error("Venda ou referência já registrada. Verifique os lançamentos.",409);
        throw e;
      }
      return respond({ok:true,saleId,status});
    }
    if(route==="admin/sale-receipt"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),saleId=str(b.saleId,60),amount=b.amountCents,reference=str(b.reference,120);
      if(!positive(amount)||amount===0||reference.length<3)return error("Recebimento ou referência inválida.");
      const sale=await query(db,"SELECT id,gross_cents,received_cents,status,opportunity_id FROM sales WHERE id=?",saleId).first();
      if(!sale||!["pending","partially_paid"].includes(sale.status)||sale.received_cents+amount>sale.gross_cents)return error("Recebimento excede o saldo ou venda não permite novos lançamentos.");
      try{
        await db.batch([
          query(db,"INSERT INTO sale_receipts(id,sale_id,amount_cents,reference,actor_id) VALUES (?,?,?,?,?)",fresh(),saleId,amount,reference,user.id),
          query(db,"INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",fresh(),user.id,"sale.receipt","sale",saleId,"amount="+amount+" reference="+reference)
        ]);
      }catch(e){
        if(/UNIQUE|constraint|receipt exceeds|reference already|immutable/i.test(String(e)))return error("Referência duplicada, saldo insuficiente ou venda indisponível. Revise a conciliação.",409);
        throw e;
      }
      const updated=await query(db,"SELECT received_cents,status FROM sales WHERE id=?",saleId).first();
      return respond({ok:true,saleId,receivedCents:updated.received_cents,status:updated.status});
    }
    if(route==="admin/commission"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),saleId=str(b.saleId,50),rate=1500;
      if(b.rateBps!==undefined&&b.rateBps!==1500)return error("A comissão USBRIN para criação de sites é fixa em 15%.",400);
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
      const [leads,commissions,goals,sales,proposals,contracts,leadCount]=await db.batch([
        query(db,"SELECT * FROM opportunities WHERE partner_id=? ORDER BY updated_at DESC LIMIT 200",user.id),
        query(db,"SELECT c.*,s.gross_cents,s.received_cents,o.company customer_company,o.id opportunity_id FROM commissions c JOIN sales s ON s.id=c.sale_id JOIN opportunities o ON o.id=s.opportunity_id WHERE c.partner_id=? AND o.partner_id=? ORDER BY c.created_at DESC LIMIT 100",user.id,user.id),
        query(db,"SELECT period,goal_cents FROM goals WHERE partner_id=? ORDER BY period DESC LIMIT 12",user.id),
        query(db,"SELECT r.amount_cents,r.received_at FROM sale_receipts r JOIN sales s ON s.id=r.sale_id JOIN opportunities o ON o.id=s.opportunity_id WHERE o.partner_id=? AND s.status!='reversed' ORDER BY r.received_at DESC LIMIT 500",user.id),
        query(db,"SELECT p.id,p.opportunity_id,p.code,p.status,p.price_cents,p.valid_until,p.created_at,p.sent_at,p.approved_at FROM proposals p JOIN opportunities o ON o.id=p.opportunity_id WHERE o.partner_id=? ORDER BY p.created_at DESC,p.rowid DESC LIMIT 400",user.id),
        query(db,"SELECT s.id,s.opportunity_id,s.gross_cents,s.received_cents,s.status FROM sales s JOIN opportunities o ON o.id=s.opportunity_id WHERE o.partner_id=? ORDER BY s.created_at DESC LIMIT 200",user.id),
        query(db,"SELECT COUNT(*) total FROM opportunities WHERE partner_id=?",user.id)
      ]);
      return respond({ok:true,leads:leads.results,commissions:commissions.results,goals:goals.results,sales:sales.results,
        proposals:proposals.results,contracts:contracts.results,commissionRateBps:1500,
        leadCount:leadCount.results[0]?.total||0,leadsTruncated:(leadCount.results[0]?.total||0)>200});
    }
    if(route==="representante/lead"&&method==="POST"&&allowed(user,"representante")){
      const b=await readBody(request),company=str(b.company,160),contact=str(b.contact,160),value=Number(b.estimatedCents||0),action=str(b.nextAction,160),day=str(b.nextActionAt,10);
      if(company.length<3||contact.length<3||!positive(value))return error("Empresa, contato e valor precisam ser válidos.");
      if((action||day)&&(!isoDate(day)||action.length<3))return error("Informe a próxima ação e uma data válida.");
      // Prevent duplicate entries in the same representative portfolio without revealing other partners' clients.
      const duplicate=await query(db,"SELECT id FROM opportunities WHERE partner_id=? AND lower(trim(company))=lower(trim(?)) AND lower(trim(contact))=lower(trim(?)) AND stage NOT IN ('lost','cancelled') LIMIT 1",user.id,company,contact).first();
      if(duplicate)return error("Esta empresa e contato já estão cadastrados na sua carteira. Consulte Oportunidades.",409);
      const id=fresh();
      await query(db,"INSERT INTO opportunities(id,partner_id,company,contact,city,segment,product,estimated_cents,stage,note,next_action,next_action_at) VALUES (?,?,?,?,?,?,?,?, 'new',?,?,?)",id,user.id,company,contact,str(b.city,120),str(b.segment,120),str(b.product,80),value,str(b.note,1200),action||null,day||null).run();
      await audit(db,user,"lead.create","opportunity",id);return respond({ok:true,id},201);
    }
    if(route==="representante/lead-stage"&&method==="POST"&&allowed(user,"representante")){
      const b=await readBody(request),id=str(b.id,50),stage=str(b.stage,30),reason=str(b.lostReason,350);
      if(!repStages.has(stage))return error("O parceiro não pode confirmar contratos nem pagamentos.");
      if(stage==="lost"&&reason.length<5)return error("Informe por que a oportunidade foi perdida.",400);
      const existing=await query(db,"SELECT stage FROM opportunities WHERE id=? AND partner_id=?",id,user.id).first();
      if(!existing||["contracted","paid","cancelled","lost"].includes(existing.stage))return error("Oportunidade inexistente ou bloqueada.",404);
      await db.batch([
        query(db,"UPDATE opportunities SET stage=?,lost_reason=CASE WHEN ?='lost' THEN ? ELSE NULL END,next_action=CASE WHEN ?='lost' THEN NULL ELSE next_action END,next_action_at=CASE WHEN ?='lost' THEN NULL ELSE next_action_at END,updated_at=datetime('now') WHERE id=? AND partner_id=? AND stage=?",stage,stage,reason,stage,stage,id,user.id,existing.stage),
        query(db,"INSERT INTO crm_activities(id,opportunity_id,actor_id,kind,note) VALUES (?,?,?,?,?)",fresh(),id,user.id,"stage",existing.stage+" → "+stage+(reason?" | Motivo: "+reason:""))
      ]);
      await audit(db,user,"lead.stage","opportunity",id,stage);return respond({ok:true});
    }
    if(route==="admin/sales"&&method==="GET"&&allowed(user,"admin")){
      const sales=await db.prepare("SELECT s.id,s.gross_cents,s.received_cents,s.status,o.company,o.product,o.id opportunity_id,(SELECT q.id FROM proposals q WHERE q.opportunity_id=o.id AND q.status IN ('approved','sent') ORDER BY q.created_at DESC,q.rowid DESC LIMIT 1) approved_proposal_id,(SELECT q.code FROM proposals q WHERE q.opportunity_id=o.id AND q.status IN ('approved','sent') ORDER BY q.created_at DESC,q.rowid DESC LIMIT 1) approved_proposal_code,(SELECT q.scope FROM proposals q WHERE q.opportunity_id=o.id AND q.status IN ('approved','sent') ORDER BY q.created_at DESC,q.rowid DESC LIMIT 1) approved_scope FROM sales s JOIN opportunities o ON o.id=s.opportunity_id LEFT JOIN projects p ON p.sale_id=s.id WHERE s.received_cents>0 AND s.status IN ('paid','partially_paid') AND p.id IS NULL ORDER BY s.updated_at DESC LIMIT 200").all();
      return respond({ok:true,sales:sales.results});
    }
    if(route==="admin/projects"&&method==="GET"&&allowed(user,"admin")){
      const rows=await db.prepare("SELECT p.*,u.name developer,o.company client_company,s.gross_cents sale_gross_cents,s.received_cents sale_received_cents FROM projects p LEFT JOIN users u ON u.id=p.developer_id LEFT JOIN sales s ON s.id=p.sale_id LEFT JOIN opportunities o ON o.id=s.opportunity_id ORDER BY p.created_at DESC LIMIT 200").all();
      return respond({ok:true,projects:rows.results});
    }
    if(route==="admin/project"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),title=str(b.title,160),description=str(b.description,5000),developerId=str(b.developerId,60),amount=b.compensationCents,saleId=str(b.saleId,60),proposalId=str(b.proposalId,60),dueAt=str(b.dueAt,30);
      if(title.length<3||description.length<15||!positive(amount)||!developerId)return error("Projeto inválido.");
      if(dueAt&&!/^\d{4}-\d{2}-\d{2}$/.test(dueAt))return error("Prazo inválido, use uma data válida.");
      const dev=await query(db,"SELECT id FROM users WHERE id=? AND role='desenvolvedor' AND status='active'",developerId).first();
      if(!dev)return error("Desenvolvedor não habilitado.");
      if(proposalId&&!saleId)return error("O briefing aprovado só pode ser vinculado a uma venda confirmada.",400);
      let developmentScope=description;
      if(saleId){
        const sale=await query(db,"SELECT id,opportunity_id,gross_cents,received_cents,status FROM sales WHERE id=?",saleId).first();
        if(!sale||!["paid","partially_paid"].includes(sale.status)||sale.received_cents===0)return error("A venda deve possuir recebimento confirmado antes da produção.");
        if(amount>sale.gross_cents)return error("Custo técnico supera o valor contratado. Revise a margem da operação.");
        const existing=await query(db,"SELECT id FROM projects WHERE sale_id=?",saleId).first();
        if(existing)return error("Esta venda já possui um projeto vinculado.",409);
        if(proposalId){
          const approved=await query(db,"SELECT id,scope,price_cents,status FROM proposals WHERE id=? AND opportunity_id=? AND status IN ('approved','sent')",proposalId,sale.opportunity_id).first();
          if(!approved)return error("O briefing não corresponde a uma proposta aprovada desta venda.",409);
          if(approved.price_cents!==sale.gross_cents)return error("O valor da venda não coincide com a proposta aprovada. Revise o contrato e o orçamento.",409);
          developmentScope=approved.scope;
        }
      }
      const id=fresh();
      try{
        await query(db,"INSERT INTO projects(id,title,description,developer_id,compensation_cents,due_at,sale_id,proposal_id) VALUES (?,?,?,?,?,?,?,?)",id,title,developmentScope,developerId,amount,dueAt||null,saleId||null,proposalId||null).run();
      }catch(e){if(/UNIQUE|constraint/i.test(String(e)))return error("Venda já vinculada a um projeto.",409);throw e;}
      await audit(db,user,"project.create","project",id,saleId?"sale="+saleId+(proposalId?" proposal="+proposalId:""):"standalone");
      return respond({ok:true,id,saleId:saleId||null},201);
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
