/* USBRIN Portfolio — projetos Vereda e Sorriso Claro, lógica pura, sem dados pessoais.
 * Valores e ambientes hipotéticos; nenhuma cotação ou avaliação clínica é realizada.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.USBRINSpecialists=api;})(typeof window==='undefined'?null:window,function(){
'use strict';
const photo=id=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=1250&q=78';
const rooms=Object.freeze([
 Object.freeze({id:'cozinha',name:'Cozinha',subtitle:'Funcionalidade e matéria em equilíbrio.',photo:photo('photo-1600585154340-be6161a56a0c'),secondary:photo('photo-1600607687920-4e2a09cf159d'),highlights:['Organização inteligente','Acabamentos resistentes','Integração de ambientes']}),
 Object.freeze({id:'closet',name:'Closet',subtitle:'Cada detalhe pensado para a rotina.',photo:photo('photo-1558997519-83ea9252edf8'),secondary:photo('photo-1615874694520-474822394e73'),highlights:['Setorização pessoal','Iluminação funcional','Aproveitamento do espaço']}),
 Object.freeze({id:'estar',name:'Sala de estar',subtitle:'Arquitetura que acolhe diferentes momentos.',photo:photo('photo-1600607687939-ce8a6c25118c'),secondary:photo('photo-1600566753190-17f0baa2a6c3'),highlights:['Painéis integrados','Volumes discretos','Materiais harmônicos']})
]);
const finishes=Object.freeze([
 Object.freeze({id:'madeira',name:'Madeira natural',code:'#ad8a69',description:'Referência de textura quente e orgânica, sem especificação de material.'}),
 Object.freeze({id:'areia',name:'Areia acetinado',code:'#d3c9b6',description:'Paleta de tons suaves para composições atemporais.'}),
 Object.freeze({id:'grafite',name:'Grafite fosco',code:'#4d514e',description:'Contraste contemporâneo de superfícies escuras.'})
]);
const layouts=Object.freeze([
 Object.freeze({id:'linear',name:'Linear',info:'Organização em uma parede.'}),
 Object.freeze({id:'l',name:'Em L',info:'Organização em duas paredes adjacentes.'}),
 Object.freeze({id:'u',name:'Em U',info:'Organização em três lados.'})
]);
const specialties=Object.freeze([
 Object.freeze({id:'clinica',name:'Clínica geral',description:'Apresentação de consultas de avaliação e orientações gerais.',photo:photo('photo-1606811971618-4486d14f3f99'),questions:['Como funciona o primeiro contato?','Como apresentar dúvidas à equipe?']}),
 Object.freeze({id:'ortodontia',name:'Ortodontia',description:'Informações institucionais sobre acompanhamento ortodôntico.',photo:photo('photo-1609840114035-3c981b782dfe'),questions:['Como conhecer as etapas?','Quando conversar com um profissional?']}),
 Object.freeze({id:'prevencao',name:'Prevenção',description:'Informações sobre hábitos de cuidado e consultas preventivas.',photo:photo('photo-1606811841689-23dfddce3e95'),questions:['Como organizar consultas de rotina?','Quais informações levar à avaliação?']}),
 Object.freeze({id:'reabilitacao',name:'Reabilitação',description:'Apresentação de caminhos de avaliação profissional individualizada.',photo:photo('photo-1629909613654-28e377c37b09'),questions:['Como é feito o planejamento individual?','O que é discutido na avaliação?']})
]);
const contactTopics=Object.freeze({informacoes:'Conhecer serviços e funcionamento',avaliacao:'Saber como solicitar uma avaliação',horarios:'Consultar horários e formas de contato'});
const contactShifts=Object.freeze({indiferente:'Sem preferência',manha:'Preferência pela manhã',tarde:'Preferência à tarde'});
function pick(id,collection){return collection.find(x=>x.id===id)||null;}
function normalizeDimensions({width,height}={}){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<0.8||width>12||height<1.8||height>4)return null;
 return Object.freeze({width,height,illustrativeArea:Number((width*height).toFixed(2))});
}
function cabinetry({room,finish,layout,width,height,notes=''}={}){
 const selectedRoom=pick(room,rooms),selectedFinish=pick(finish,finishes),selectedLayout=pick(layout,layouts);
 const dimensions=normalizeDimensions({width,height});
 if(!selectedRoom||!selectedFinish||!selectedLayout||!dimensions||typeof notes!=='string'||notes.length>400)return null;
 return Object.freeze({room:selectedRoom.name,finish:selectedFinish.name,layout:selectedLayout.name,
  dimensions,notes:notes.trim(),description:selectedRoom.subtitle,finishDescription:selectedFinish.description});
}
function cabinetrySummary(input){
 const result=cabinetry(input);if(!result)return null;
 const lines=['VEREDA PLANEJADOS — BRIEFING DEMONSTRATIVO',
 'Projeto conceitual USBRIN; não é orçamento, medição técnica ou pedido.','',
 'Ambiente: '+result.room,'Acabamento de referência: '+result.finish,'Organização desejada: '+result.layout,
 'Largura aproximada informada: '+result.dimensions.width.toLocaleString('pt-BR')+' m',
 'Altura aproximada informada: '+result.dimensions.height.toLocaleString('pt-BR')+' m'];
 if(result.notes)lines.push('Preferências adicionais: '+result.notes);
 lines.push('','Necessário levantamento no local e especificação técnica antes de orçamento real.');
 return lines.join('\n');
}
function dentalMessage({specialty,topic,shift}={}){
 const spec=pick(specialty,specialties);
 if(!spec||!Object.hasOwn(contactTopics,topic)||!Object.hasOwn(contactShifts,shift))return null;
 return ['SORRISO CLARO — MENSAGEM DEMONSTRATIVA',
 'Clínica fictícia de portfólio. Não é uma solicitação enviada ou agendamento confirmado.','',
 'Área de interesse: '+spec.name,'Objetivo do contato: '+contactTopics[topic],
 'Preferência de período: '+contactShifts[shift],
 '','Gostaria de conhecer o funcionamento do atendimento e as opções para conversar com a equipe.',
 '','Não inclua dados de saúde ou informações pessoais nesta demonstração.'].join('\n');
}
return Object.freeze({rooms,finishes,layouts,specialties,contactTopics,contactShifts,pick,normalizeDimensions,cabinetry,cabinetrySummary,dentalMessage});
});
