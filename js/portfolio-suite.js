/* USBRIN Portfolio — modelos puros para demonstrações.
   Não contém regras fiscais, prestação de serviços financeiros nem integrações reais. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.USBRINSuite=api;})(typeof window==='undefined'?null:window,function(){
'use strict';
const scenarios=Object.freeze({
  conservador:Object.freeze({label:'Cenário conservador',revenue:36000,fixed:23500,variable:38,receivable:30,payable:15}),
  base:Object.freeze({label:'Cenário base',revenue:52000,fixed:23500,variable:32,receivable:21,payable:22}),
  expansao:Object.freeze({label:'Cenário expansão',revenue:76000,fixed:31000,variable:34,receivable:35,payable:25})
});
function finance(input){
  if(!input||!['revenue','fixed','variable','receivable','payable'].every(k=>typeof input[k]==='number'&&Number.isFinite(input[k])))return null;
  const {revenue,fixed,variable,receivable,payable}=input;
  if(revenue<0||revenue>1000000||fixed<0||fixed>1000000||variable<0||variable>95||receivable<0||receivable>90||payable<0||payable>90)return null;
  const variableCost=revenue*variable/100,contribution=revenue-variableCost,result=contribution-fixed;
  const marginRate=(100-variable)/100;
  const breakeven=fixed/marginRate;
  const cashGap=revenue/30*receivable-variableCost/30*payable;
  return Object.freeze({variableCost:Math.round(variableCost),contribution:Math.round(contribution),result:Math.round(result),marginRate,breakeven:Math.round(breakeven),cashGap:Math.round(cashGap),viable:result>=0});
}
const flows=Object.freeze({
  comercial:Object.freeze({name:'Entrada comercial',description:'Organização ilustrativa de novas solicitações.',nodes:['Solicitação recebida','Classificar assunto','Definir prioridade','Preparar encaminhamento'],summary:'Um fluxo para visualizar triagem e organização de contatos.'}),
  atendimento:Object.freeze({name:'Atendimento',description:'Acompanhamento de solicitações em etapas.',nodes:['Novo atendimento','Identificar contexto','Preparar retorno','Atualizar situação'],summary:'Demonstra como organizar um processo de atendimento sem chat real.'}),
  operacoes:Object.freeze({name:'Operações',description:'Organização de demandas internas.',nodes:['Tarefa registrada','Validar requisitos','Distribuir atividade','Registrar conclusão'],summary:'Representação de distribuição de trabalho com etapas rastreáveis.'})
});
const channels=Object.freeze({site:'Formulário de site',email:'E-mail ilustrativo',interno:'Solicitação interna'});
const priorities=Object.freeze({normal:'Normal',alta:'Alta',urgente:'Urgente'});
function flow(input){
  if(!input||!Object.hasOwn(flows,input.template)||!Object.hasOwn(channels,input.channel)||!Object.hasOwn(priorities,input.priority)||!Number.isInteger(input.delay)||input.delay<0||input.delay>60)return null;
  const template=flows[input.template];
  return Object.freeze({name:template.name,description:template.description,summary:template.summary,steps:Object.freeze([
    Object.freeze({title:template.nodes[0],note:channels[input.channel]}),
    Object.freeze({title:template.nodes[1],note:'Prioridade: '+priorities[input.priority]}),
    Object.freeze({title:template.nodes[2],note:input.delay===0?'Sem espera ilustrativa':'Espera ilustrativa de '+input.delay+' minutos'}),
    Object.freeze({title:template.nodes[3],note:'Conclusão de demonstração'})
  ])});
}
return Object.freeze({scenarios,finance,flows,flow,channels,priorities});
});
