/* USBRIN Portfolio — simulações autorais de hotelaria e serviços automotivos.
 * Preços, duração, acomodações e serviços: exclusivamente ilustrativos.
 * Nenhuma reserva, agenda, transação ou comunicação com servidores.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.USBRINExperiences=api;})(typeof window==='undefined'?null:window,()=>{
'use strict';
const photo=id=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=1200&q=80';
const rooms=Object.freeze([
 Object.freeze({id:'classic',name:'Suíte Jardim',night:79000,guests:2,area:38,photo:photo('photo-1611892440504-42a792e24d32'),subtitle:'Luz natural, materiais suaves e uma atmosfera tranquila.',features:['Cama king-size','Área de descanso','Banheiro privativo']}),
 Object.freeze({id:'vista',name:'Suíte Panorama',night:112000,guests:3,area:54,photo:photo('photo-1566665797739-1674de7a421a'),subtitle:'Ambientes generosos para aproveitar o tempo sem pressa.',features:['Área de estar','Vista ilustrativa','Espaço adicional']}),
 Object.freeze({id:'residence',name:'Residência Vista',night:146000,guests:4,area:86,photo:photo('photo-1578683010236-d716f9a3f461'),subtitle:'Mais amplitude, privacidade e liberdade para compartilhar.',features:['Dois ambientes','Sala de convivência','Configuração familiar']})
]);
const services=Object.freeze([
 Object.freeze({id:'express',name:'Cuidado Essencial',price:32000,hours:3,desc:'Etapas ilustrativas de lavagem técnica e acabamento visual.',includes:['Limpeza externa','Aspiração interna','Finalização de superfícies']}),
 Object.freeze({id:'protect',name:'Proteção Completa',price:69000,hours:6,desc:'Processo demonstrativo que combina limpeza e proteção de superfícies.',includes:['Lavagem técnica','Descontaminação leve','Proteção ilustrativa']}),
 Object.freeze({id:'signature',name:'Detalhamento Signature',price:129000,hours:10,desc:'Experiência ilustrativa de cuidado aprofundado e revisão estética.',includes:['Inspeção visual','Tratamento de superfícies','Finalização detalhada']})
]);
const extras=Object.freeze([
 Object.freeze({id:'interior',name:'Higienização interna',price:18000,hours:2}),
 Object.freeze({id:'paint',name:'Tratamento de pintura',price:24000,hours:3}),
 Object.freeze({id:'glass',name:'Proteção dos vidros',price:12000,hours:1})
]);
const vehicleSizes=Object.freeze({compacto:100,sedan:120,suv:150});
function parseDate(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const dateObj=new Date(date+'T12:00:00Z');if(!Number.isFinite(dateObj.getTime())||dateObj.toISOString().slice(0,10)!==date)return null;
 return Date.UTC(dateObj.getUTCFullYear(),dateObj.getUTCMonth(),dateObj.getUTCDate());
}
function lodging({roomId,arrival,departure,guests=2,breakfast=false}={}){
 const room=rooms.find(x=>x.id===roomId);const start=parseDate(arrival),end=parseDate(departure);
 if(!room||start===null||end===null||!Number.isInteger(guests)||guests<1||guests>room.guests||typeof breakfast!=='boolean')return null;
 const nights=Math.round((end-start)/86400000);
 if(nights<1||nights>21)return null;
 const base=room.night*nights,supplement=breakfast?8500*guests*nights:0;
 return Object.freeze({room:room.name,nights,guests,base,supplement,total:base+supplement,perNight:room.night,breakfast});
}
function automobile({serviceId,size='sedan',selectedExtras=[]}={}){
 const service=services.find(x=>x.id===serviceId),factor=vehicleSizes[size];
 if(!service||!factor||!Array.isArray(selectedExtras)||new Set(selectedExtras).size!==selectedExtras.length)return null;
 let extrasTotal=0,extraHours=0;
 for(const id of selectedExtras){
  const option=extras.find(x=>x.id===id);
  if(!option)return null;extrasTotal+=option.price;extraHours+=option.hours;
 }
 const base=Math.round(service.price*factor/100);
 return Object.freeze({name:service.name,size,base,extras:extrasTotal,total:base+extrasTotal,hours:service.hours+extraHours,extrasCount:selectedExtras.length});
}
return Object.freeze({rooms,services,extras,vehicleSizes,lodging,automobile,parseDate});
});
