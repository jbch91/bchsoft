import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import PDFKitDocument from 'pdfkit';
import { normalizeReportPresentation,normalizeReportLogo,clientReportLogo,presentActivityReport } from './maintenance-activity-report-presentation.js';
import { createMaintenanceActivityReportWord } from './maintenance-activity-report-word.js';
import { createMaintenanceActivityReportPdf,renderActivityReport } from './maintenance-activity-report-pdf.js';
import { isActivityReportReadExport } from './maintenance-activity-report-routes.js';
import { buildActivityReport,normalizeActivityReportFilters } from './maintenance-activity-reports.js';

const logo=async()=>`data:image/png;base64,${(await sharp({create:{width:280,height:90,channels:4,background:'#167e7e'}}).png().toBuffer()).toString('base64')}`;
const report=()=>({ ...buildActivityReport([],[],normalizeActivityReportFilters({from:'2026-08-01',to:'2026-08-31'})),
  filters:normalizeActivityReportFilters({from:'2026-08-01',to:'2026-08-31'}),client:{name:'HOSPITAL QA',nit:'900-1',city:'CIUDAD QA'},
  generatedBy:'INGENIERO QA',generatedAt:'2026-09-21T12:00:00Z',title:'INFORME DE ACTIVIDADES',notes:[],scopeLabels:[] });

test('provider is explicit, bounded and separate from hospital identity',async()=>{
  assert.throws(()=>normalizeReportPresentation({mode:'external'}),{status:400});
  assert.throws(()=>normalizeReportPresentation({mode:'external',providerName:'a'.repeat(161)}),{status:400});
  assert.throws(()=>normalizeReportPresentation({mode:'other'}),{status:400});
  const result=await presentActivityReport(report(),{mode:'external',providerName:'Servicios técnicos',providerNit:'800-2',client:{name:'FALSO'},contract:'ct-03'});
  assert.equal(result.client.name,'HOSPITAL QA');assert.equal(result.presentation.providerName,'SERVICIOS TÉCNICOS');
  assert.equal(result.presentation.contract,'CT-03');assert.ok(result.notes.some(n=>n.includes('NO ES UN FILTRO')));
  assert.equal(normalizeReportPresentation({mode:'internal',providerName:'No aplica',providerLogo:'https://example.invalid/logo'}).providerName,'');
});
test('logos are sanitized images with no URL, SVG or oversized input',async()=>{
  const value=await normalizeReportLogo(await logo());assert.ok(value.startsWith('data:image/png;base64,'));
  for(const invalid of ['https://localhost/private','file:///etc/passwd','data:image/svg+xml;base64,AAAA','data:image/png;base64,AAAA','x'.repeat(1400000)]){
    await assert.rejects(normalizeReportLogo(invalid),{status:400});
  }
});
test('hospital logo file cannot escape the owning tenant directory, including symlinks',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'activity-logo-'));
  try{
    const directory=path.join(root,'uploads/clients/client-one');await fs.mkdir(directory,{recursive:true});
    await fs.writeFile(path.join(directory,'logo.png'),Buffer.from((await logo()).split(',')[1],'base64'));
    assert.ok(await clientReportLogo({id:'client-one',logo_path:'/uploads/clients/client-one/logo.png'},root));
    assert.equal(await clientReportLogo({id:'client-two',logo_path:'/uploads/clients/client-one/logo.png'},root),'');
    await fs.symlink(path.join(directory,'logo.png'),path.join(directory,'../escaped.png'));
    assert.equal(await clientReportLogo({id:'client-one',logo_path:'/uploads/clients/client-one/../escaped.png'},root),'');
    assert.equal(await clientReportLogo({id:'client-one',logo_path:'https://example.invalid/logo.png'},root),'');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('Word has editable text, institution and provider logos, repeating table headers and no signature images',async()=>{
  const result=await presentActivityReport(report(),{mode:'external',providerName:'EMPRESA QA',providerLogo:await logo()});
  result.client.logoDataUrl=await normalizeReportLogo(await logo());
  const buffer=await createMaintenanceActivityReportWord(result);
  const zip=await JSZip.loadAsync(buffer),xml=await zip.file('word/document.xml').async('string');
  assert.match(xml,/EMPRESA QA/);assert.match(xml,/HOSPITAL QA/);assert.match(xml,/COPIA EDITABLE/);assert.match(xml,/<w:tblHeader/);
  assert.match(xml,/<w:pStyle w:val="Title"/);assert.match(xml,/NO MODIFICAN LOS REGISTROS/);
  const header=await zip.file('word/header1.xml').async('string');assert.equal((header.match(/<w:drawing>/g)||[]).length,2);
  assert.ok(!xml.includes('signature_path'));
  const pdf=await PDFDocument.load(await createMaintenanceActivityReportPdf(result));assert.ok(pdf.getPageCount()>0);
});
test('read-only subscription exception is restricted to the non-mutating report export endpoint',()=>{
  const path='/activity-reports/65e2825f-2fda-4e9e-bdd3-22cc9fd58c32/export';
  assert.equal(isActivityReportReadExport({method:'POST',baseUrl:'/maintenance',path}),true);
  for(const req of [{method:'DELETE',baseUrl:'/maintenance',path},{method:'POST',baseUrl:'/admin',path},
    {method:'POST',baseUrl:'/maintenance',path:path+'/delete'},{method:'POST',baseUrl:'/maintenance',path:'/reports/create'}])assert.equal(isActivityReportReadExport(req),false);
});
test('PDF identities keep long names below their logos and inside separate columns',async()=>{
  const result=await presentActivityReport(report(),{mode:'external',providerName:'EMPRESA DE INGENIERÍA Y MANTENIMIENTO HOSPITALARIO '.repeat(3).trim(),providerLogo:await logo(),providerContact:'CONTACTO DE SOPORTE TÉCNICO '.repeat(5).trim()});
  result.client.name='EMPRESA SOCIAL DEL ESTADO HOSPITAL DE ATENCIÓN INTEGRAL Y SERVICIOS ESPECIALIZADOS '.repeat(2).trim();
  result.client.logoDataUrl=await normalizeReportLogo(await logo());
  const doc=new PDFKitDocument({size:'A4',layout:'landscape',margins:{top:40,left:36,right:36,bottom:42},bufferPages:true});
  const captured=[];const original=doc.text;
  doc.text=function(value,x,y,options){
    if([result.client.name,result.presentation.providerName].includes(value)&&y>40)captured.push({value,x,y,width:options.width,height:this.heightOfString(value,options)});
    return original.call(this,value,x,y,options);
  };
  doc.on('data',()=>{});const finished=new Promise((resolve,reject)=>{doc.on('end',resolve);doc.on('error',reject);});
  renderActivityReport(doc,result);doc.end();await finished;
  assert.equal(captured.length,2);assert.equal(captured[0].y,captured[1].y);assert.ok(captured[0].y>=94);
  assert.ok(captured[0].x+captured[0].width<captured[1].x);
  assert.ok(captured[1].x+captured[1].width<doc.page.width-36);
  for(const box of captured)assert.ok(box.y+box.height<doc.page.height-48);
});
