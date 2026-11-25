import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { mergeAssetHistoryPdf } from './asset-full-history-pdf.js';

test('merges original pages without duplicates and reports damaged or missing files',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'asset-history-pdf-'));
  try {
    const doc=await PDFDocument.create();doc.addPage([400,300]);
    const bytes=await doc.save();const file=path.join(dir,'original.pdf');await fs.writeFile(file,bytes);
    const merged=await mergeAssetHistoryPdf({basePdf:bytes,historyItems:[{title:'A'},{title:'B'}],resolveFile:async()=>file});
    assert.equal((await PDFDocument.load(merged)).getPageCount(),2);
    await assert.rejects(mergeAssetHistoryPdf({basePdf:bytes,historyItems:[{title:'ACTA'}],resolveFile:async()=>null}),
      {code:'ASSET_HISTORY_PDF_UNAVAILABLE',status:409});
    await fs.writeFile(file,'not a PDF');
    await assert.rejects(mergeAssetHistoryPdf({basePdf:bytes,historyItems:[{title:'ACTA'}],resolveFile:async()=>file}),
      {code:'ASSET_HISTORY_PDF_UNAVAILABLE',status:409});
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
