import { ActivityReport, ActivityReportRow, activityReportLabel } from './activity-report.service';

export async function activityReportExcel(report:ActivityReport):Promise<Blob> {
  const module = await import('exceljs');
  const Workbook = (module.Workbook || (module as any).default?.Workbook) as typeof import('exceljs').Workbook;
  if(typeof Workbook !== 'function')throw new Error('No se pudo cargar el generador de Excel.');
  const book=new Workbook();
  book.title=report.title;book.creator=report.generatedBy;book.company=report.client.name;book.created=new Date(report.generatedAt);
  const metadata=[
    [report.title],['INSTITUCIÓN',report.client.name],['NIT',report.client.nit||'NR'],
    ['PERIODO',`${report.filters.from} AL ${report.filters.to}`],['CRITERIO DE FECHA',activityReportLabel(report.filters.dateBasis)],
    ['ALCANCE',report.scopeLabels.join(' / ')||'ÁREAS Y UBICACIONES AUTORIZADAS'],
    ['FILTROS',`TIPO: ${activityReportLabel(report.filters.type)} / FIRMA: ${activityReportLabel(report.filters.signature)} / ESTADO: ${activityReportLabel(report.filters.status)} / REPUESTOS: ${activityReportLabel(report.filters.spareStatus)} / BÚSQUEDA: ${report.filters.search||'TODOS'}`],
    ['GENERADO',new Date(report.generatedAt).toLocaleString('es-CO',{timeZone:'America/Bogota'})],['GENERADO POR',report.generatedBy],
    ['PRESTADOR',report.presentation?.mode==='external'?report.presentation.providerName:'SERVICIO PROPIO DE LA INSTITUCIÓN'],
    ['NIT PRESTADOR',report.presentation?.mode==='external'?(report.presentation.providerNit||'NR'):(report.client.nit||'NR')],
    ['CONTRATO / ORDEN',report.presentation?.contract||'NR'],['DIRIGIDO A',report.presentation?.recipient||'NR']
  ];
  const summary=report.summary;
  const totals=report.filters.kind==='spares' ? [] : [
    ['Intervenciones',summary.interventions],['Equipos distintos intervenidos',summary.equipment],['Preventivos',summary.preventive],
    ['Correctivos',summary.corrective],['Firmados',summary.signed],['Pendientes de firma',summary.pendingSignature],
    ['En corrección',summary.corrections],['Reportes fuera de servicio',summary.outOfService],['Con observaciones',summary.observations],
    ['Constancias sin intervención',summary.notLocated],['PDF históricos',summary.historical]
  ];
  if(report.filters.kind!=='activities')totals.push(['Instalaciones de repuestos',summary.installed],['Casos pendientes al cierre',summary.pendingSpares],['Casos de periodos anteriores',summary.carriedOver]);
  const summarySheet=book.addWorksheet('Resumen y criterios',{pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true}});
  summarySheet.addRows([...metadata,[],['INDICADOR','TOTAL'],...totals,[],['OBSERVACIONES DEL INFORME',report.presentation?.observations||'NR'],...report.notes.map(note=>['CRITERIO',note]),[],['SOFTWARE','INBIHOSPITALARIO']]);
  summarySheet.columns=[{width:37},{width:110}];
  summarySheet.eachRow((row,index)=>{row.font={name:'Arial',size:10,color:{argb:'FF303640'}};row.alignment={vertical:'top',wrapText:true};
    row.height=index===1?32:Math.max(24,Math.ceil(String(row.getCell(2).value||'').length/100)*15+8);
    if(index===1||index===metadata.length+2){row.font={name:'Arial',size:index===1?13:10,bold:true,color:{argb:'FF7F343F'}};row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5EEEE'}};}
  });
  summarySheet.mergeCells(1,1,1,2);
  const sharedHeaders=['FECHA ATENCIÓN','FECHA PROGRAMADA','CÓDIGO','EQUIPO','MARCA','MODELO','SERIE','SEDE','ÁREA','UBICACIÓN','TIPO','INGENIERO','FIRMA','ESTADO FINAL'];
  const shared=(r:ActivityReportRow)=>[r.date,r.plannedDate||'',r.code,r.equipment,r.brand||'NR',r.model||'NR',r.serial||'NR',r.site||'NR',r.area||'NR',r.location||'NR',activityReportLabel(r.kind==='not_located'?r.kind:r.type),r.engineer||'NR',activityReportLabel(r.signature),activityReportLabel(r.status)];
  const append=(name:string,headers:string[],rows:unknown[][])=>{
    const content=[...metadata,[],headers,...rows,[],['SOFTWARE','INBIHOSPITALARIO']];
    const headerIndex=metadata.length+2;
    const sheet=book.addWorksheet(name,{views:[{state:'frozen',ySplit:headerIndex}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:`${headerIndex}:${headerIndex}`}});
    sheet.addRows(content);sheet.columns=headers.map(title=>({width:['EQUIPO','REPUESTO','ACCIONES','HALLAZGOS','OBSERVACIONES','RESUMEN','DOCUMENTO'].includes(title)?42:22}));
    sheet.eachRow((row,index)=>{
      row.font={name:'Arial',size:10,color:{argb:'FF303640'}};row.alignment={vertical:'top',wrapText:true};
      if(index<=metadata.length){if(index===1)sheet.mergeCells(index,1,index,headers.length);else sheet.mergeCells(index,2,index,headers.length);row.height=index===1?30:24;}
      else {let height=26;row.eachCell((cell,col)=>{height=Math.max(height,Math.ceil(String(cell.value||'').length/(sheet.getColumn(col).width||22))*14+8);});row.height=Math.min(300,height);}
      if(index===headerIndex||index===1){row.font={name:'Arial',size:10,bold:true,color:{argb:'FF7F343F'}};row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5EEEE'}};}
      else if(index>headerIndex&&index<=headerIndex+rows.length&&index%2===0)row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8FAFB'}};
    });
    sheet.autoFilter={from:{row:headerIndex,column:1},to:{row:headerIndex+rows.length,column:headers.length}};
    sheet.headerFooter.oddFooter='SOFTWARE BIOMÉDICO INBIHOSPITALARIO &R &P / &N';
  };
  if(report.filters.kind!=='spares'){
    append('Actividades',[...sharedHeaders,'RESUMEN','HALLAZGOS','ACCIONES','OBSERVACIONES','MOTIVO NO LOCALIZADO','FECHA REGISTRO','ID REPORTE'],
      report.activities.map(r=>[...shared(r),r.summary||'',r.findings||'',r.actions||'',r.observations||'',r.reason||'',r.registeredAt||'',r.id]));
    if(report.historical.length)append('PDF históricos',['FECHA DOCUMENTO','CÓDIGO','EQUIPO','ÁREA','UBICACIÓN','TIPO','DOCUMENTO','DESCRIPCIÓN','ID DOCUMENTO'],
      report.historical.map(r=>[r.date,r.code,r.equipment,r.area,r.location,activityReportLabel(r.type),r.title,r.description,r.id]));
  }
  if(report.filters.kind!=='activities')append('Repuestos',[...sharedHeaders,'ESTADO REPUESTO','REPUESTO','ANTERIOR AL RANGO','OBSERVACIONES','ID REPORTE'],
    report.spares.map(r=>[...shared(r),activityReportLabel(r.spareResult),r.spare||'SIN DESCRIPCIÓN',r.carriedOver?'SÍ':'NO',r.observations||'',r.id]));
  return new Blob([await book.xlsx.writeBuffer() as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
