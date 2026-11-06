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
      const [applicants,reps,devs,opportunities,projects,sales]=await db.batch([
        db.prepare("SELECT status,COUNT(*) total FROM applications GROUP BY status"),
        db.prepare("SELECT role,COUNT(*) total FROM users WHERE status='active' GROUP BY role"),
        db.prepare("SELECT stage,COUNT(*) total FROM projects GROUP BY stage"),
        db.prepare("SELECT stage,COUNT(*) total FROM opportunities GROUP BY stage"),
        db.prepare("SELECT COALESCE(SUM(received_cents),0) total FROM sales WHERE status IN ('paid','partially_paid')"),
        db.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM commissions WHERE status IN ('due','approved')")
      ]);
      return respond({ok:true,applications:applicants.results,users:reps.results,projects:devs.results,opportunities:opportunities.results,receivedCents:sales.results[0].total,commissionsPendingCents:(await db.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM commissions WHERE status IN ('due','approved')").first()).total});
    }
    if(route==="admin/applications"&&method==="GET"&&allowed(user,"admin")){
      const records=await db.prepare("SELECT * FROM applications ORDER BY created_at DESC LIMIT 250").all();return respond({ok:true,applications:records.results});
    }
    if(route==="admin/review"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),status=str(b.status,30),id=str(b.id,50),note=str(b.note,1200);
      if(!statuses.has(status)||!id)return error("Dados inválidos.");
      const original=await query(db,"SELECT id,status FROM applications WHERE id=?",id).first();if(!original)return error("Candidatura não localizada.",404);
      await query(db,"UPDATE applications SET status=?,reviewer_note=?,updated_at=datetime('now') WHERE id=?",status,note,id).run();
      await audit(db,user,"application.review","application",id,original.status+" -> "+status);return respond({ok:true});
    }
    if(route==="admin/activate"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.applicationId,50);
      if(b.contractVerified!==true)return error("Confirme a formalização contratual antes da ativação.");
      const a=await query(db,"SELECT id,name,email,type,status FROM applications WHERE id=?",id).first();
      if(!a||a.status!=="approved")return error("A candidatura ainda não está aprovada.");
      const role=a.type;
      const existing=await query(db,"SELECT id FROM users WHERE email=?",a.email).first();
      if(existing)return error("Esta identidade já possui conta; revisão administrativa necessária.",409);
      await query(db,"INSERT INTO users(id,email,name,role,status,application_id,created_at) VALUES (?,?,?,?, 'active',?,datetime('now'))",fresh(),a.email,a.name,role,a.id).run();
      await audit(db,user,"user.activate","application",id,role);return respond({ok:true});
    }
    if(route==="admin/opportunities"&&method==="GET"&&allowed(user,"admin")){
      const rows=await db.prepare("SELECT o.*,u.name representative FROM opportunities o JOIN users u ON u.id=o.partner_id ORDER BY o.updated_at DESC LIMIT 200").all();return respond({ok:true,opportunities:rows.results});
    }
    if(route==="admin/sale"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.opportunityId,50),gross=b.grossCents,received=b.receivedCents;
      if(!positive(gross)||gross===0||!positive(received)||received>gross)return error("Valores inválidos: envie valores em centavos.");
      const lead=await query(db,"SELECT id,partner_id FROM opportunities WHERE id=?",id).first();
      if(!lead)return error("Oportunidade não localizada.",404);
      const existing=await query(db,"SELECT id FROM sales WHERE opportunity_id=?",id).first();if(existing)return error("Venda já registrada. Não duplique recebimentos.",409);
      const saleId=fresh(),status=received===gross?"paid":received>0?"partially_paid":"pending";
      await db.batch([
        query(db,"INSERT INTO sales(id,opportunity_id,gross_cents,received_cents,receipt_reference,status) VALUES (?,?,?,?,?,?)",saleId,id,gross,received,str(b.reference,120),status),
        query(db,"UPDATE opportunities SET stage=?,updated_at=datetime('now') WHERE id=?",received===gross?"paid":"contracted",id)
      ]);
      await audit(db,user,"sale.record","sale",saleId,"recebido "+received);return respond({ok:true,saleId});
    }
    if(route==="admin/commission"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),saleId=str(b.saleId,50),rate=b.rateBps;
      if(!Number.isInteger(rate)||rate<0||rate>5000)return error("Taxa inválida em pontos-base.");
      const s=await query(db,"SELECT s.id,s.received_cents,s.status,o.partner_id FROM sales s JOIN opportunities o ON o.id=s.opportunity_id WHERE s.id=?",saleId).first();
      if(!s||s.status!=="paid")return error("A venda precisa estar integralmente recebida.");
      const existing=await query(db,"SELECT id FROM commissions WHERE sale_id=?",saleId).first();if(existing)return error("Comissão existente, revise o registro.",409);
      const cents=Math.round(s.received_cents*rate/10000),id=fresh();
      await query(db,"INSERT INTO commissions(id,sale_id,partner_id,basis_cents,rate_bps,amount_cents,status) VALUES (?,?,?,?,?,?,'estimated')",id,saleId,s.partner_id,s.received_cents,rate,cents).run();
      await audit(db,user,"commission.create","commission",id,"bps="+rate);
      return respond({ok:true,id,amountCents:cents});
    }
    if(route==="admin/commission-status"&&method==="POST"&&allowed(user,"admin")){
      const b=await readBody(request),id=str(b.id,50),status=str(b.status,20);
      if(!["approved","due","paid","reversed"].includes(status))return error("Estado inválido.");
      const c=await query(db,"SELECT id,status FROM commissions WHERE id=?",id).first();
      if(!c)return error("Comissão não encontrada.",404);
      if(!({estimated:["approved","reversed"],approved:["due","reversed"],due:["paid","reversed"],paid:[],reversed:[]}[c.status]||[]).includes(status))return error("Transição de comissão não permitida.");
      await query(db,"UPDATE commissions SET status=?,paid_at=CASE WHEN ?='paid' THEN datetime('now') ELSE NULL END WHERE id=?",status,status,id).run();
      await audit(db,user,"commission.status","commission",id,c.status+" -> "+status);return respond({ok:true});
    }
    if(route==="representante/dashboard"&&method==="GET"&&allowed(user,"representante")){
      const [leads,commissions,goals]=await db.batch([
        query(db,"SELECT * FROM opportunities WHERE partner_id=? ORDER BY updated_at DESC LIMIT 200",user.id),
        query(db,"SELECT c.*,s.gross_cents,s.received_cents FROM commissions c JOIN sales s ON s.id=c.sale_id WHERE c.partner_id=? ORDER BY c.created_at DESC LIMIT 100",user.id),
        query(db,"SELECT period,goal_cents FROM goals WHERE partner_id=? ORDER BY period DESC LIMIT 12",user.id)
      ]);
      return respond({ok:true,leads:leads.results,commissions:commissions.results,goals:goals.results});
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
      const result=await query(db,"UPDATE opportunities SET stage=?,updated_at=datetime('now') WHERE id=? AND partner_id=? AND stage NOT IN ('contracted','paid','cancelled')",stage,id,user.id).run();
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
      const result=await query(db,"UPDATE projects SET stage=?,updated_at=datetime('now') WHERE id=?",stage,id).run();
      if(!result.meta?.changes)return error("Projeto não encontrado.",404);
      await audit(db,user,"project.stage","project",id,stage);return respond({ok:true});
    }
    if(route==="desenvolvedor/dashboard"&&method==="GET"&&allowed(user,"desenvolvedor")){
      const p=await query(db,"SELECT * FROM projects WHERE developer_id=? ORDER BY updated_at DESC LIMIT 200",user.id).all();
      return respond({ok:true,projects:p.results});
    }
    if(route==="desenvolvedor/project"&&method==="POST"&&allowed(user,"desenvolvedor")){
      const b=await readBody(request),id=str(b.id,50),stage=str(b.stage,25);
      if(!["accepted","in_progress","review"].includes(stage))return error("Etapa não permitida ao desenvolvedor.");
      const project=await query(db,"SELECT id,stage FROM projects WHERE id=? AND developer_id=?",id,user.id).first();
      if(!project||!({proposed:["accepted"],accepted:["in_progress"],in_progress:["review"],changes:["in_progress"]}[project.stage]||[]).includes(stage))return error("Transição não autorizada.");
      const preview=str(b.previewUrl,350);
      if(preview&&!/^https:\/\//.test(preview))return error("A prévia precisa usar HTTPS.");
      await query(db,"UPDATE projects SET stage=?,preview_url=CASE WHEN ?='' THEN preview_url ELSE ? END,updated_at=datetime('now') WHERE id=? AND developer_id=?",stage,preview,preview,id,user.id).run();
      await audit(db,user,"project.progress","project",id,stage);return respond({ok:true});
    }
    return error("Recurso não encontrado ou acesso insuficiente.",404);
  }catch(e){return error(e instanceof SyntaxError?"JSON inválido.":"Não foi possível executar a operação.",e instanceof SyntaxError?400:500);}
}
