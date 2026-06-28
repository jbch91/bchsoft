INSERT INTO odontology_consent_templates (client_id, title, body, version, is_active)
SELECT c.id,
       'Autorización tratamiento de datos personales',
       'Yo, {{signer_name}}, identificado(a) con documento {{signer_document}}, autorizo de manera previa, expresa e informada el tratamiento de mis datos personales y datos sensibles en salud, así como los del paciente {{patient_name}} identificado con documento {{patient_document}}, cuando actúo como acudiente o representante. Esta autorización permite recolectar, almacenar, consultar, actualizar, usar, transmitir y conservar la información necesaria para la prestación de servicios odontológicos, gestión de citas, historia clínica, consentimientos, reportes, facturación interna, comunicaciones asistenciales y cumplimiento de obligaciones legales. Declaro que fui informado(a) sobre mis derechos a conocer, actualizar, rectificar, solicitar prueba de autorización, revocar la autorización cuando sea procedente y presentar consultas o reclamos ante el responsable del tratamiento. Entiendo que la información clínica será manejada bajo reserva y medidas de seguridad.',
       1,
       TRUE
FROM clients c
WHERE NOT EXISTS (
  SELECT 1
  FROM odontology_consent_templates oct
  WHERE oct.client_id = c.id
    AND LOWER(oct.title) = LOWER('Autorización tratamiento de datos personales')
);
