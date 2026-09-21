import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, HeadingLevel, WidthType, BorderStyle,
  ShadingType, VerticalAlign, TableLayoutType } from 'docx';
import sharp from 'sharp';
import { reportPresentationLines } from './maintenance-activity-report-presentation.js';

const upper=value=>String(value??'NR').toLocaleUpperCase('es-CO');
const date=value=>value?String(value).slice(0,10).split('-').reverse().join('/'):'NR';
const labels={signed:'FIRMADO',pending:'PENDIENTE',correction:'EN CORRECCIÓN',operativo:'OPERATIVO',
  operativo_observacion:'OPERATIVO CON OBSERVACIONES',fuera_de_servicio:'FUERA DE SERVICIO',no_verificado:'NO VERIFICADO',
  installed:'INSTALADO',all:'TODOS',preventivo:'PREVENTIVO',correctivo:'CORRECTIVO'};
const label=value=>labels[value]||upper(value);

export async function createMaintenanceActivityReportWord(report) {
  const text=(value,options={})=>new Paragraph({spacing:{after:90},...options,
    children:[new TextRun({text:upper(value),size:20,...options.run})]});
  const heading=value=>text(value,{heading:HeadingLevel.HEADING_1,keepNext:true,spacing:{before:220,after:110},run:{bold:true,size:23}});
  const logo=async(value,name)=>{
    if(!value)return null;
    const data=Buffer.from(value.split(',')[1],'base64');
    const meta=await sharp(data).metadata();const scale=Math.min(145/meta.width,55/meta.height);
    return new ImageRun({type:'png',data,transformation:{width:Math.round(meta.width*scale),height:Math.round(meta.height*scale)},altText:{name,description:name,title:name}});
  };
  const headerRuns=[];
  const p=report.presentation||{mode:'internal'};
  if(p.mode==='external'){
    const image=await logo(p.providerLogo,p.providerName);if(image)headerRuns.push(image,new TextRun('    '));
  }
  const hospitalLogo=await logo(report.client.logoDataUrl,report.client.name);if(hospitalLogo)headerRuns.push(hospitalLogo);
  const children=[];
  if(p.mode==='external'){
    children.push(text('PRESTADOR DEL SERVICIO',{run:{size:17,bold:true}}),text(p.providerName,{run:{size:24,bold:true}}));
    children.push(text(`NIT: ${p.providerNit||'NR'}${p.providerContact?' | '+p.providerContact:''}`,{run:{size:18}}));
  }
  children.push(text('INSTITUCIÓN ATENDIDA',{run:{size:17,bold:true}}),text(report.client.name,{run:{size:24,bold:true}}),
    text(`NIT: ${report.client.nit||'NR'} | ${report.client.city||'NR'}`,{run:{size:18}}),
    text(report.title,{heading:HeadingLevel.TITLE,keepNext:true,spacing:{before:180,after:150},run:{size:30,bold:true}}),
    text(`DEL ${date(report.filters.from)} AL ${date(report.filters.to)} | EQUIPOS ${report.filters.category==='industrial'?'INDUSTRIALES':'BIOMÉDICOS'}`,{run:{bold:true}}),
    ...reportPresentationLines(report).map(value=>text(value,{run:{size:18}})),
    text('CONSOLIDADO DE LOS REGISTROS DE MANTENIMIENTO QUE COINCIDEN CON EL PERIODO Y LOS FILTROS SELECCIONADOS. PRESENTA LAS INTERVENCIONES Y EL SEGUIMIENTO DOCUMENTAL DISPONIBLE.'),
    text(`ALCANCE: ${report.scopeLabels.join(' | ')||'ÁREAS Y UBICACIONES AUTORIZADAS'}`,{run:{size:18}}),
    text(`TIPO: ${label(report.filters.type)} | FIRMA: ${label(report.filters.signature)} | ESTADO: ${label(report.filters.status)} | REPUESTOS: ${label(report.filters.spareStatus)}${report.filters.search?' | BÚSQUEDA: '+report.filters.search:''}`,{run:{size:18}}));
  const table=(headers,rows,widths)=>{
    const border={style:BorderStyle.SINGLE,size:3,color:'D8DFE5'};
    const row=(values,isHeader,index)=>new TableRow({tableHeader:isHeader,cantSplit:values.every(v=>String(v??'').length<1400),
      children:values.map((value,col)=>new TableCell({width:{size:widths[col],type:WidthType.DXA},
        verticalAlign:VerticalAlign.CENTER,margins:{top:110,bottom:110,left:110,right:110},
        shading:{type:ShadingType.CLEAR,fill:isHeader?'E8EEF4':index%2?'F7F9FB':'FFFFFF'},
        borders:{top:border,bottom:border,left:border,right:border},
        children:String(value??'NR').split('\n').map(line=>text(line,{spacing:{after:35},run:{size:18,bold:isHeader,color:'000000'}}))}))});
    return new Table({width:{size:9360,type:WidthType.DXA},columnWidths:widths,layout:TableLayoutType.FIXED,
      rows:[row(headers,true,0),...(rows.length?rows:[headers.map((_,i)=>i===0?'SIN REGISTROS':'')]).map((values,index)=>row(values,false,index))]});
  };
  const s=report.summary;
  const totals=[];
  if(report.filters.kind!=='spares')totals.push(['INTERVENCIONES',s.interventions],['EQUIPOS DISTINTOS',s.equipment],
    ['PREVENTIVOS / CORRECTIVOS',`${s.preventive} / ${s.corrective}`],['FIRMADOS / PENDIENTES / EN CORRECCIÓN',`${s.signed} / ${s.pendingSignature} / ${s.corrections}`],
    ['REPORTES FUERA DE SERVICIO / CON OBSERVACIONES',`${s.outOfService} / ${s.observations}`],['CONSTANCIAS SIN INTERVENCIÓN / PDF HISTÓRICOS',`${s.notLocated} / ${s.historical}`]);
  if(report.filters.kind!=='activities')totals.push(['INSTALACIONES DE REPUESTOS',s.installed],['CASOS PENDIENTES AL CIERRE',s.pendingSpares],['PENDIENTES DE PERIODOS ANTERIORES',s.carriedOver]);
  children.push(heading('RESUMEN DEL PERIODO'),table(['INDICADOR','TOTAL'],totals,[7100,2260]));
  const equipment=r=>`${r.code} / ${r.equipment}\n${r.brand||'NR'} / ${r.model||'NR'}\nSERIE: ${r.serial||'NR'}\n${r.site||'NR'} / ${r.area||'NR'} / ${r.location||'NR'}`;
  if(report.filters.kind!=='spares'){
    if(report.areas?.length)children.push(heading('DISTRIBUCIÓN POR ÁREA'),table(['SEDE / ÁREA','PREV.','CORR.','EQUIPOS'],report.areas.map(r=>[`${r.site||'NR'} / ${r.area||'NR'}`,r.preventive,r.corrective,r.equipment]),[5460,1300,1300,1300]));
    children.push(heading('ACTIVIDADES Y CONSTANCIAS'),table(['EQUIPO / FECHAS','RESULTADO / RESPONSABLE','ACTIVIDAD'],report.activities.map(r=>[
      `${equipment(r)}\nATENCIÓN: ${date(r.date)}\nPROGRAMADA: ${date(r.plannedDate)}\n${r.kind==='not_located'?'NO LOCALIZADO':label(r.type)}`,
      `${label(r.status)}\n${label(r.signature)}\n${r.engineer||'NR'}`,
      r.kind==='not_located'?r.reason:[r.summary,report.filters.kind==='activities'?`HALLAZGOS: ${r.findings||'NR'}\nACCIONES: ${r.actions||'NR'}`:'',r.observations].filter(Boolean).join('\n')
    ]),[3400,2200,3760]));
    if(report.historical.length)children.push(heading('DOCUMENTOS HISTÓRICOS'),table(['FECHA / TIPO','EQUIPO','DOCUMENTO'],report.historical.map(r=>[`${date(r.date)}\n${label(r.type)}`,equipment(r),`${r.title}\n${r.description||''}`]),[1750,4000,3610]));
  }
  if(report.filters.kind!=='activities')children.push(heading('REPUESTOS INSTALADOS Y PENDIENTES'),table(['EQUIPO','FECHA / ESTADO','REPUESTO / RESPONSABLE'],report.spares.map(r=>[
    equipment(r),`${date(r.date)}\n${label(r.spareResult)}${r.carriedOver?'\nANTERIOR AL RANGO':''}`,
    `${r.spare||'SIN DESCRIPCIÓN'}\n${r.observations||''}\n${r.engineer||'NR'}\nFIRMA: ${label(r.signature)}`
  ]),[3650,1900,3810]));
  if(p.observations)children.push(heading('OBSERVACIONES DEL INFORME'),text(p.observations));
  children.push(heading('CRITERIOS DE LECTURA'),...report.notes.map(note=>text(note,{run:{size:18}})),
    heading('ELABORACIÓN DEL CONSOLIDADO'),text(report.generatedBy),text(`GENERADO EL ${new Date(report.generatedAt).toLocaleString('es-CO',{timeZone:'America/Bogota'})} (COLOMBIA)`),
    text('COPIA EDITABLE. LOS CAMBIOS REALIZADOS EN WORD NO MODIFICAN LOS REGISTROS DEL SOFTWARE NI CONSTITUYEN UNA FIRMA DE LOS PROTOCOLOS.',{run:{size:18}}));
  const document=new Document({creator:report.generatedBy,title:report.title,description:report.client.name,
    styles:{default:{document:{run:{font:'Arial',size:20,color:'000000'},paragraph:{spacing:{line:260}}}},
      paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',run:{font:'Arial',size:30,bold:true,color:'000000'}},
        {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',run:{font:'Arial',size:23,bold:true,color:'000000'},paragraph:{keepNext:true}}]},
    sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:headerRuns.length?1650:900,bottom:900,left:1440,right:1440,header:430,footer:420}}},
      headers:{default:new Header({children:[new Paragraph({children:headerRuns}),text(report.client.name,{run:{size:15}})]})},
      footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'INBIHOSPITALARIO | COPIA EDITABLE | ',size:14}),new TextRun({children:[PageNumber.CURRENT],size:14}),new TextRun({text:' / ',size:14}),new TextRun({children:[PageNumber.TOTAL_PAGES],size:14})]})]})},children}]});
  return Packer.toBuffer(document);
}
