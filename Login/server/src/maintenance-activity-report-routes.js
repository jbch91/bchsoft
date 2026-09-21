import { Router } from 'express';
import { listClientModules } from './admin.js';
import { activityReportAccessError, activityReportOptions, activityReportIdentity, loadActivityReport, normalizeActivityReportFilters } from './maintenance-activity-reports.js';
import { createMaintenanceActivityReportPdf, maintenanceActivityReportFilename } from './maintenance-activity-report-pdf.js';
import { createMaintenanceActivityReportWord } from './maintenance-activity-report-word.js';
import { clientReportLogo, presentActivityReport } from './maintenance-activity-report-presentation.js';

export function isActivityReportReadExport(req) {
  return req.method==='POST' && req.baseUrl==='/maintenance'
    && /^\/activity-reports\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/export\/?$/i.test(req.path);
}

export function createActivityReportRouter({ modules=listClientModules, options=activityReportOptions, identity=activityReportIdentity, load=loadActivityReport, pdf=createMaintenanceActivityReportPdf, word=createMaintenanceActivityReportWord, present=presentActivityReport }={}) {
  const router=Router();
  router.use('/:clientId',async(req,res,next)=>{
    const error=activityReportAccessError(req.user,req.params.clientId);
    if(error)return res.status(403).json({message:error});
    try {
      if(!(await modules(req.params.clientId)).some(module=>module.key==='reportes_mantenimiento' && module.enabled)) {
        return res.status(403).json({message:'El módulo de mantenimiento no está habilitado para este cliente.'});
      }
      return next();
    } catch(error){console.error('Acceso a informes de mantenimiento',error);return res.status(500).json({message:'No se pudo verificar el acceso.'});}
  });
  const handle=fn=>async(req,res)=>{
    try {res.setHeader('Cache-Control','private, no-store');await fn(req,res);}
    catch(error){if(!error.status)console.error('Informe de mantenimiento',error);res.status(error.status||500).json({message:error.status?error.message:'No se pudo generar el informe. Intenta nuevamente.'});}
  };
  router.get('/:clientId/options',handle(async(req,res)=>{
    res.json(await options(req.user,req.params.clientId,req.query.category||'biomedical'));
  }));
  router.get('/:clientId/identity',handle(async(req,res)=>{
    const data=await identity(req.user,req.params.clientId,req.query.category||'biomedical');
    data.client.logoDataUrl=await clientReportLogo(data.client);
    delete data.client.logo_path;
    res.json(data);
  }));
  router.post('/:clientId/export',handle(async(req,res)=>{
    const format=req.body?.format;
    if(!['json','pdf','docx'].includes(format))throw Object.assign(new Error('Formato inválido.'),{status:400});
    const input=req.body?.filters||{};
    const filters=normalizeActivityReportFilters({...input,backlog:typeof input.backlog==='boolean'?String(input.backlog):input.backlog});
    const report=await present(await load(req.user,req.params.clientId,filters),req.body?.presentation);
    if(format==='json')return res.json({...report,counts:{activities:report.activities.length,spares:report.spares.length,historical:report.historical.length}});
    const buffer=await (format==='docx'?word(report):pdf(report));
    res.setHeader('Content-Type',format==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="${maintenanceActivityReportFilename(report,format)}"`);
    res.send(buffer);
  }));
  router.get('/:clientId',handle(async(req,res)=>{
    if(req.query.format && !['json','pdf'].includes(req.query.format))throw Object.assign(new Error('Formato inválido.'),{status:400});
    const report=await load(req.user,req.params.clientId,normalizeActivityReportFilters(req.query));
    if(req.query.format==='pdf'){
      const buffer=await pdf(await present(report));
      res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition',`attachment; filename="${maintenanceActivityReportFilename(report)}"`);
      return res.send(buffer);
    }
    delete report.client.logo_path;
    const counts={activities:report.activities.length,spares:report.spares.length,historical:report.historical.length};
    if(req.query.preview==='true')for(const key of Object.keys(counts))report[key]=report[key].slice(0,12);
    return res.json({...report,counts});
  }));
  return router;
}
