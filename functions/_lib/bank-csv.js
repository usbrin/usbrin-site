// Strict, small CSV bank evidence importer. This is not a bank integration or proof of provenance.
// Canonical format: data;valor;descricao;identificador (UTF-8, Brazilian decimals, +/-).
// Reject unrecognised headers rather than guessing whether a debit is a credit.
export class BankCSVError extends Error {}
export const bankDate=(value)=>{
 const raw=String(value||"").trim();
 let iso;
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw))iso=raw;
 else if(/^\d{2}\/\d{2}\/\d{4}$/.test(raw)){
   const [day,month,year]=raw.split("/");
   iso=year+"-"+month+"-"+day;
 }else throw new BankCSVError("Data deve ser AAAA-MM-DD ou DD/MM/AAAA.");
 const date=new Date(iso+"T00:00:00Z");
 if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==iso)
   throw new BankCSVError("Extrato contém uma data inexistente.");
 return iso;
};
export const bankCents=(value)=>{
 const raw=String(value||"").trim().replace(/\s|R\$/gi,"").replace(/^\+/,"");
 if(!raw||/[Ee()]/.test(raw))throw new BankCSVError("Valor inválido no extrato.");
 const negative=raw.startsWith("-");
 const s=negative?raw.slice(1):raw;
 let integer,decimal;
 if(/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(s)){[integer,decimal]=s.split(",");integer=integer.replaceAll(".","");}
 else if(/^\d+,\d{2}$/.test(s)){[integer,decimal]=s.split(",");}
 else if(/^\d+(?:\.\d{2})?$/.test(s)){[integer,decimal="00"]=s.split(".");}
 else if(/^\d+$/.test(s)){integer=s;decimal="00";}
 else throw new BankCSVError("Formato monetário ambíguo; use 1234,56 ou 1234.56.");
 const cents=Number(integer)*100+Number(decimal);
 if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000)
   throw new BankCSVError("Valor bancário fora do intervalo permitido.");
 return negative?-cents:cents;
};
function fields(line,separator){
 const output=[];let value="",quoted=false;
 for(let i=0;i<line.length;i++){
   const c=line[i];
   if(c==='"'){
     if(quoted&&line[i+1]==='"'){value+='"';i++;}
     else if(!quoted&&!value)quoted=true;
     else if(quoted)quoted=false;
     else throw new BankCSVError("Aspas malformadas no CSV.");
   }else if(c===separator&&!quoted){output.push(value.trim());value="";}
   else value+=c;
 }
 if(quoted)throw new BankCSVError("Aspas não fechadas no CSV.");
 output.push(value.trim());return output;
}
function splitRows(content){
 const lines=[];let row="",quoted=false;
 for(let i=0;i<content.length;i++){
   const c=content[i];
   if(c==='"'){
     if(quoted&&content[i+1]==='"'){row+='""';i++;}
     else{quoted=!quoted;row+='"';}
   }else if((c==='\n'||c==='\r')&&!quoted){
     if(c==='\r'&&content[i+1]==='\n')i++;
     if(row.trim())lines.push(row);
     row="";
   }else row+=c;
 }
 if(quoted)throw new BankCSVError("CSV com aspas abertas.");
 if(row.trim())lines.push(row);
 return lines;
}
const normalize=v=>String(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
export function parseBankCSV(content){
 if(typeof content!=="string"||content.length<25||content.length>110000)
   throw new BankCSVError("O extrato deve conter entre 25 e 110.000 caracteres.");
 const lines=splitRows(content.replace(/^\uFEFF/,""));
 if(lines.length<2||lines.length>151)throw new BankCSVError("Importe de 1 a 150 transações por lote.");
 const separator=lines[0].includes(";")?";":",";
 const headers=fields(lines[0],separator).map(normalize);
 const target=["data","valor","descricao","identificador"];
 if(headers.length!==4||new Set(headers).size!==4||target.some(x=>!headers.includes(x)))
   throw new BankCSVError("Cabeçalho obrigatório: data;valor;descricao;identificador.");
 const map=Object.fromEntries(target.map(x=>[x,headers.indexOf(x)]));
 const used=new Set();
 const entries=lines.slice(1).map((line,n)=>{
   const v=fields(line,separator);
   if(v.length!==4)throw new BankCSVError("Linha "+(n+2)+": número de colunas diferente do cabeçalho.");
   const postedOn=bankDate(v[map.data]),amountCents=bankCents(v[map.valor]);
   const description=v[map.descricao].replace(/[\u0000-\u001F\u007F]/g," ").trim().slice(0,350);
   const externalId=v[map.identificador].trim();
   if(description.length<3||!/^[a-zA-Z0-9._:\/-]{6,120}$/.test(externalId))
     throw new BankCSVError("Linha "+(n+2)+": descrição ou identificador bancário inválido.");
   if(used.has(externalId.toUpperCase()))throw new BankCSVError("Identificador duplicado neste arquivo: "+externalId);
   used.add(externalId.toUpperCase());
   return {postedOn,amountCents,description,externalId};
 });
 return entries;
}
