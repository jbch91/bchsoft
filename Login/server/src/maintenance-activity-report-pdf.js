import PDFDocument from 'pdfkit';

const upper = value => String(value ?? '-').toLocaleUpperCase('es-CO');
const labels = { signed:'FIRMADO', pending:'PENDIENTE', correction:'EN CORRECCIÓN', operativo:'OPERATIVO',
  operativo_observacion:'OPERATIVO CON OBSERVACIONES', fuera_de_servicio:'FUERA DE SERVICIO', no_verificado:'NO VERIFICADO',
  installed:'INSTALADO', all:'TODOS', preventivo:'PREVENTIVO', correctivo:'CORRECTIVO' };
const label = value => labels[value] || upper(value);
const date = value => value ? String(value).slice(0,10).split('-').reverse().join('/') : '-';

export function maintenanceActivityReportFilename(report, extension = 'pdf') {
  const name = report.client.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,65);
  return `informe-${report.filters.kind}-${name}-${report.filters.from}-${report.filters.to}.${extension}`;
}

export function createMaintenanceActivityReportPdf(report) {
  return new Promise((resolve,reject) => {
    const doc = new PDFDocument({size:'A4',layout:'landscape',margins:{top:40,left:36,right:36,bottom:42},bufferPages:true,
      info:{Title:report.title,Author:report.generatedBy,Subject:report.client.name}});
    const chunks=[];
    doc.on('data',chunk=>chunks.push(chunk)); doc.on('end',()=>resolve(Buffer.concat(chunks))); doc.on('error',reject);
    try {
      renderActivityReport(doc, report);
      doc.end();
    } catch(error) { doc.destroy(); reject(error); }
  });
}

export function renderActivityReport(doc, report) {
  const left=36, width=doc.page.width-72, bottom=doc.page.height-48;
  const ink='#292c32', muted='#606974', accent='#8f3237', line='#d8dce0';
  const font=(size=8,bold=false)=>doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).fillColor(ink);
  const ensure=height=>{ if(doc.y+height>bottom)doc.addPage(); };
  const paragraph=(value,size=8)=>{font(size);ensure(doc.heightOfString(upper(value),{width,paragraphGap:4})+5);font(size);doc.text(upper(value),left,doc.y,{width,paragraphGap:4});doc.y+=5;};
  const section=title=>{ensure(76);doc.y+=9;const y=doc.y;font(10,true).fillColor(accent).text(upper(title),left,y,{width});doc.y+=8;};
  doc.on('pageAdded',()=>{doc.y=40;});
  // Split oversized cells across pages; never truncate report narratives or overlap the footer.
  const table=(headers,rows,fractions)=>{
    const widths=fractions.map(part=>part*width), padding=6;
    font(7.5,true);
    const headerHeight=Math.max(27,...headers.map((cell,i)=>doc.heightOfString(upper(cell),{width:widths[i]-padding*2})+padding*2));
    const header=()=>{
      ensure(headerHeight+24);const y=doc.y; doc.rect(left,y,width,headerHeight).fill('#f5eded'); let x=left;
      headers.forEach((cell,i)=>{font(7.5,true).fillColor(accent).text(upper(cell),x+padding,y+padding,{width:widths[i]-padding*2});x+=widths[i];});doc.y=y+headerHeight;
    };
    header();
    if(!rows.length)rows=[headers.map((_,i)=>i===0?'SIN REGISTROS':'')];
    rows.forEach((row,index)=>{
      let pending=row.map(upper);
      font();
      const rowHeight=Math.max(24,...pending.map((value,i)=>doc.heightOfString(value,{width:widths[i]-padding*2,lineGap:1})+padding*2));
      if(rowHeight<=bottom-40-headerHeight && doc.y+rowHeight>bottom){doc.addPage();header();}
      do {
        if(doc.y+35>bottom){doc.addPage();header();}
        const y=doc.y, available=bottom-y-padding*2;
        font();
        const parts=pending.map((value,i)=>{
          const options={width:widths[i]-padding*2,lineGap:1};
          if(doc.heightOfString(value,options)<=available)return value;
          let low=1,high=value.length;
          while(low<high){const mid=Math.ceil((low+high)/2);if(doc.heightOfString(value.slice(0,mid),options)<=available)low=mid;else high=mid-1;}
          const space=value.lastIndexOf(' ',low);return value.slice(0,space>low/2?space:low);
        });
        const height=Math.max(24,...parts.map((value,i)=>doc.heightOfString(value,{width:widths[i]-padding*2,lineGap:1})+padding*2));
        if(index%2===0)doc.rect(left,y,width,height).fill('#fafafa');
        let x=left;
        parts.forEach((value,i)=>{font().text(value,x+padding,y+padding,{width:widths[i]-padding*2,lineGap:1});x+=widths[i];});
        doc.moveTo(left,y+height).lineTo(left+width,y+height).strokeColor(line).lineWidth(0.4).stroke();
        doc.y=y+height;
        pending=pending.map((value,i)=>value.slice(parts[i].length).trimStart());
        if(pending.some(Boolean)){doc.addPage();header();}
      } while(pending.some(Boolean));
    });
    doc.y+=8;
  };
  const presentation=report.presentation||{mode:'internal'};
  const external=presentation.mode==='external';
  const identities=[
    ...(external?[{title:'PRESTADOR DEL SERVICIO',name:presentation.providerName,nit:presentation.providerNit,contact:presentation.providerContact,logo:presentation.providerLogo}]:[]),
    {title:external?'INSTITUCIÓN ATENDIDA':'INSTITUCIÓN / SERVICIO PROPIO',name:report.client.name,nit:report.client.nit,contact:report.client.city,logo:report.client.logoDataUrl}
  ];
  const top=doc.y, blockWidth=width/identities.length, padding=14, textWidth=blockWidth-padding*2;
  // Both identities share the same baseline; logos never consume the company-name column.
  const identityLayouts=identities.map(identity=>{
    font(11,true);const nameHeight=doc.heightOfString(upper(identity.name),{width:textWidth,lineGap:2});
    const details=upper(`NIT: ${identity.nit||'NR'}${identity.contact?'\n'+identity.contact:''}`);
    font(8);const detailHeight=doc.heightOfString(details,{width:textWidth,lineGap:2});
    return {...identity,nameHeight,details,detailHeight};
  });
  const identityHeight=Math.max(...identityLayouts.map(i=>54+i.nameHeight+7+i.detailHeight+14));
  doc.rect(left,top,width,identityHeight).lineWidth(.7).strokeColor(line).stroke();
  doc.rect(left,top,width,3).fill(accent);
  identityLayouts.forEach((identity,index)=>{
    const x=left+index*blockWidth+padding;
    if(index)doc.moveTo(x-padding,top+14).lineTo(x-padding,top+identityHeight-14).lineWidth(.7).strokeColor(line).stroke();
    font(7,true).fillColor(accent).text(identity.title,x,top+17,{width:textWidth-(identity.logo?110:0)});
    if(identity.logo)doc.image(Buffer.from(identity.logo.split(',')[1],'base64'),x+textWidth-96,top+11,{fit:[96,32],align:'center',valign:'center'});
    font(11,true).text(upper(identity.name),x,top+54,{width:textWidth,lineGap:2});
    font(8).fillColor(muted).text(identity.details,x,top+54+identity.nameHeight+7,{width:textWidth,lineGap:2});
  });
  doc.y=top+identityHeight+15;
  font(14,true).text(upper(report.title),left,doc.y,{width});doc.y+=10;
  const metadata=[['PERIODO DEL INFORME',`${date(report.filters.from)} AL ${date(report.filters.to)}`],
    ['EQUIPOS / SERVICIO',`${report.filters.category==='industrial'?'INDUSTRIALES':'BIOMÉDICOS'} / ${external?'EXTERNO':'PROPIO'}`],
    ['CONTRATO / ORDEN',presentation.contract||'NO REGISTRADO']];
  const metaWidths=[.3,.3,.4].map(part=>part*width);
  font(8.5,true);const metaHeight=Math.max(...metadata.map(([,value],i)=>doc.heightOfString(upper(value),{width:metaWidths[i]-24})))+32;
  ensure(metaHeight);const metaTop=doc.y;doc.rect(left,metaTop,width,metaHeight).fill('#f3f5f6');let metaX=left;
  metadata.forEach(([title,value],i)=>{
    font(7,true).fillColor(muted).text(title,metaX+12,metaTop+9,{width:metaWidths[i]-24});
    font(8.5,true).text(upper(value),metaX+12,metaTop+22,{width:metaWidths[i]-24});metaX+=metaWidths[i];
  });doc.y=metaTop+metaHeight+9;
  if(presentation.recipient)paragraph(`DIRIGIDO A: ${presentation.recipient}`);
  paragraph(report.scopeLabels.join(' | ') || 'ALCANCE: TODAS LAS ÁREAS Y UBICACIONES AUTORIZADAS');
  paragraph(`FILTROS: ${label(report.filters.type)} | FIRMA: ${label(report.filters.signature)} | ESTADO: ${label(report.filters.status)} | REPUESTOS: ${label(report.filters.spareStatus)}${report.filters.search?' | BÚSQUEDA: '+report.filters.search:''}`,7.5);
  const s=report.summary;
  ensure(130);section('Resumen del periodo');
  const metrics=report.filters.kind==='spares'?[[s.installed,'INSTALACIONES DE REPUESTOS'],[s.pendingSpares,'CASOS PENDIENTES AL CIERRE'],[s.carriedOver,'DE PERIODOS ANTERIORES']]:
    [[s.interventions,'INTERVENCIONES'],[s.equipment,'EQUIPOS DISTINTOS'],[s.preventive,'PREVENTIVOS'],[s.corrective,'CORRECTIVOS']];
  const metricY=doc.y, metricWidth=width/metrics.length;
  metrics.forEach(([value,title],i)=>{
    const x=left+i*metricWidth;
    if(i)doc.moveTo(x,metricY+3).lineTo(x,metricY+40).strokeColor(line).lineWidth(.7).stroke();
    font(21,true).fillColor(accent).text(String(value??0),x+10,metricY,{width:metricWidth-20});
    font(7.5,true).fillColor(muted).text(title,x+10,metricY+28,{width:metricWidth-20});
  });doc.y=metricY+52;
  if(report.filters.kind!=='spares'){
    paragraph(`${s.signed} FIRMADOS  |  ${s.pendingSignature} PENDIENTES DE FIRMA  |  ${s.corrections} EN CORRECCIÓN\n${s.outOfService} REPORTES FUERA DE SERVICIO  |  ${s.observations} CON OBSERVACIONES  |  ${s.notLocated} CONSTANCIAS SIN INTERVENCIÓN  |  ${s.historical} PDF HISTÓRICOS`);
    if(report.filters.kind!=='activities')paragraph(`REPUESTOS: ${s.installed} INSTALACIONES  |  ${s.pendingSpares} CASOS PENDIENTES AL CIERRE  |  ${s.carriedOver} DE PERIODOS ANTERIORES`);
  }
  if(report.filters.kind!=='spares'){
    if(report.areas.length){section('Distribución por área');table(['SEDE / ÁREA','PREVENTIVOS','CORRECTIVOS','EQUIPOS'],report.areas.map(a=>[`${a.site||'NR'} / ${a.area||'NR'}`,a.preventive,a.corrective,a.equipment]),[.55,.15,.15,.15]);}
    section('Actividades y constancias');
    table(['FECHAS / TIPO','EQUIPO','SEDE / ÁREA / UBICACIÓN','RESULTADO / FIRMA','ACTIVIDAD'],report.activities.map(r=>[
      `ATENCIÓN: ${date(r.date)}\nPROGRAMADA: ${date(r.plannedDate)}\n${r.kind==='not_located'?'NO LOCALIZADO':label(r.type)}`,
      `${r.code} / ${r.equipment}\n${r.brand||'NR'} / ${r.model||'NR'}\nSERIE: ${r.serial||'NR'}`,
      `${r.site||'NR'}\n${r.area||'NR'}\n${r.location||'NR'}`,
      `${label(r.status)}\n${label(r.signature)}\n${r.engineer||'NR'}`,
      r.kind==='not_located'?r.reason:[r.summary,report.filters.kind==='activities'?`HALLAZGOS: ${r.findings||'NR'}\nACCIONES: ${r.actions||'NR'}`:'',r.observations].filter(Boolean).join('\n')
    ]),[.15,.24,.17,.17,.27]);
    if(report.historical.length){section('Documentos históricos (sin detalle técnico tabulado)');table(['FECHA / TIPO','EQUIPO','ÁREA / UBICACIÓN','DOCUMENTO'],report.historical.map(r=>[`${date(r.date)} / ${label(r.type)}`,`${r.code} / ${r.equipment}`,`${r.area||'NR'} / ${r.location||'NR'}`,`${r.title}\n${r.description||''}`]),[.17,.3,.23,.3]);}
  }
  if(report.filters.kind!=='activities'){
    section('Repuestos instalados y pendientes');
    table(['FECHA / ESTADO','EQUIPO','ÁREA / UBICACIÓN','REPUESTO / OBSERVACIÓN','RESPONSABLE / FIRMA'],report.spares.map(r=>[
      `${date(r.date)}\n${label(r.spareResult)}${r.carriedOver?'\nANTERIOR AL RANGO':''}`,
      `${r.code} / ${r.equipment}\n${r.brand||'NR'} / ${r.model||'NR'}\nSERIE: ${r.serial||'NR'}`,
      `${r.site||'NR'}\n${r.area||'NR'} / ${r.location||'NR'}`,
      `${r.spare||'SIN DESCRIPCIÓN'}\n${r.observations||''}`,
      `${r.engineer||'NR'}\n${label(r.signature)}`
    ]),[.14,.24,.2,.27,.15]);
  }
  if(presentation.observations){section('Observaciones del informe');paragraph(presentation.observations,9);}
  const generated=`GENERADO POR: ${report.generatedBy} | ${new Date(report.generatedAt).toLocaleString('es-CO',{timeZone:'America/Bogota'})} (COLOMBIA)`;
  font();
  const criteriaHeight=[generated,...report.notes].reduce((height,value)=>height+doc.heightOfString(upper(value),{width,paragraphGap:4})+5,36);
  if(criteriaHeight<bottom-40)ensure(criteriaHeight);
  section('Elaboración y criterios de lectura');
  paragraph(generated);
  report.notes.forEach(note=>paragraph(note));
  const range=doc.bufferedPageRange();
  for(let page=0;page<range.count;page++){
    doc.switchToPage(page);doc.page.margins.bottom=0;
    if(page>0){
      font(7,true).fillColor(muted).text(upper(report.client.name),left,16,{width:width-180,height:11,ellipsis:true});
      font(7).fillColor(muted).text(`${date(report.filters.from)} AL ${date(report.filters.to)}`,left+width-175,16,{width:175,align:'right',lineBreak:false});
      doc.moveTo(left,31).lineTo(left+width,31).strokeColor(line).lineWidth(.5).stroke();
    }
    doc.moveTo(left,doc.page.height-36).lineTo(left+width,doc.page.height-36).strokeColor(line).lineWidth(.5).stroke();
    font(7).fillColor(muted).text('SOFTWARE BIOMÉDICO INBIHOSPITALARIO',left,doc.page.height-27,{width:width-130,lineBreak:false});
    doc.text(`PÁGINA ${page+1} DE ${range.count}`,left+width-125,doc.page.height-27,{width:125,align:'right',lineBreak:false});
  }
}
