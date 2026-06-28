import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { getApiBase, getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import {
  OdontologyAttachmentDto,
  OdontologyAppointmentDto,
  OdontologyAppointmentPayload,
  OdontologyAppointmentReminderDto,
  OdontologyCatalogItemDto,
  OdontologyCatalogItemPayload,
  OdontologyClinicalDocumentDto,
  OdontologyClinicalDocumentPayload,
  OdontologyClinicalRecordDto,
  OdontologyClinicalRecordNoteDto,
  OdontologyClinicalRecordNotePayload,
  OdontologyClinicalRecordPayload,
  OdontologyConsentTemplateDto,
  OdontologyConsentTemplatePayload,
  OdontologyDashboardDto,
  OdontologyDentistDto,
  OdontologyDentistScheduleDto,
  OdontologyDentistSchedulePayload,
  OdontologyInstrumentDto,
  OdontologyInstrumentPayload,
  OdontologyInventoryItemDto,
  OdontologyInventoryItemPayload,
  OdontologyInventoryMovementDto,
  OdontologyInventoryMovementPayload,
  OdontologyOdontogramDto,
  OdontologyOdontogramEntryDto,
  OdontologyOdontogramPayload,
  OdontologyPeriodontalMeasurementPayload,
  OdontologyPeriodontogramDto,
  OdontologyPeriodontogramPayload,
  OdontologyPatientConsentDto,
  OdontologyPatientConsentPayload,
  OdontologyPatientDto,
  OdontologyPatientPayload,
  OdontologyCashClosureDto,
  OdontologyPaymentDto,
  OdontologyPaymentPayload,
  OdontologyMedicationDto,
  OdontologyProcedureInventoryKitDto,
  OdontologyProcedureInventoryKitItemPayload,
  OdontologyProcedureTypeDto,
  OdontologyProcedureTypePayload,
  OdontologyMedicationPayload,
  OdontologyPrescriptionDto,
  OdontologyPrescriptionItemPayload,
  OdontologyPrescriptionPayload,
  OdontologyPurchaseRequestDto,
  OdontologyPurchaseRequestPayload,
  OdontologyReportDto,
  OdontologyReportDetailsDto,
  OdontologySettingsPayload,
  OdontologySterilizationCycleDto,
  OdontologySterilizationCycleItemPayload,
  OdontologySterilizationCyclePayload,
  OdontologySupplierDto,
  OdontologySupplierPayload,
  OdontologyTreatmentPlanDto,
  OdontologyTreatmentPlanItemDto,
  OdontologyTreatmentPlanItemPayload,
  OdontologyTreatmentPlanPayload,
  OdontologyService
} from '../../odontology/odontology.service';

interface ClientOption {
  id: string;
  name: string;
  nit?: string | null;
  city?: string | null;
  email?: string | null;
  address?: string | null;
  logoPath?: string | null;
}

type OdontologyTab = 'dashboard' | 'patients' | 'agenda' | 'clinical' | 'treatments' | 'payments' | 'prescriptions' | 'documents' | 'consents' | 'attachments' | 'inventory' | 'sterilization' | 'reports' | 'settings';
type ClinicalSubTab = 'records' | 'odontogram' | 'periodontogram';

type PrescriptionItemForm = OdontologyPrescriptionItemPayload & { medicationCatalogId: string };
type PeriodontalMeasurementForm = OdontologyPeriodontalMeasurementPayload;

interface PatientImportPreviewRow {
  rowNumber: number;
  originalRow: Record<string, unknown>;
  payload: OdontologyPatientPayload | null;
  errors: string[];
}

interface PatientHistoryData {
  appointments: OdontologyAppointmentDto[];
  clinicalRecords: OdontologyClinicalRecordDto[];
  clinicalRecordNotes: OdontologyClinicalRecordNoteDto[];
  treatmentPlans: OdontologyTreatmentPlanDto[];
  consents: OdontologyPatientConsentDto[];
  prescriptions: OdontologyPrescriptionDto[];
  clinicalDocuments: OdontologyClinicalDocumentDto[];
  attachments: OdontologyAttachmentDto[];
  periodontograms: OdontologyPeriodontogramDto[];
  payments: OdontologyPaymentDto[];
  odontogram: OdontologyOdontogramDto | null;
}

type PatientTimelineAction = 'clinicalPdf' | 'prescriptionPdf' | 'clinicalDocumentPdf' | 'consentPdf' | 'attachment' | 'periodontogramPdf' | 'odontogramPdf';

interface PatientTimelineItem {
  id: string;
  date: string;
  label: string;
  title: string;
  description: string;
  className: string;
  actionLabel?: string;
  actionType?: PatientTimelineAction;
  payload?: unknown;
}

@Component({
  selector: 'app-odontologia',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
  templateUrl: './odontologia.component.html',
  styleUrl: './odontologia.component.scss'
})
export class OdontologiaComponent {
  private readonly apiBase = getApiBase();
  private readonly publicBase = getPublicBase();

  clients: ClientOption[] = [];
  clientSearchTerm = '';
  selectedClientId = '';
  selectedTab: OdontologyTab = 'dashboard';
  clientsLoading = true;
  loading = false;
  patientsLoading = false;
  patientSaving = false;
  patientImportReading = false;
  patientImportLoading = false;
  patientHistoryLoading = false;
  appointmentsLoading = false;
  appointmentRemindersLoading = false;
  appointmentSaving = false;
  quickAppointmentStatusId = '';
  appointmentReminderSendingId = '';
  appointmentWhatsappReminderSendingId = '';
  clinicalLoading = false;
  clinicalSaving = false;
  clinicalNoteSaving = false;
  clinicalSigning = false;
  odontogramLoading = false;
  odontogramSaving = false;
  periodontogramLoading = false;
  periodontogramSaving = false;
  treatmentPlansLoading = false;
  treatmentPlanSaving = false;
  attachmentsLoading = false;
  attachmentSaving = false;
  inventoryLoading = false;
  inventorySaving = false;
  inventoryMovementSaving = false;
  inventoryKitLoading = false;
  inventoryKitSaving = false;
  sterilizationLoading = false;
  instrumentSaving = false;
  sterilizationSaving = false;
  paymentsLoading = false;
  paymentSaving = false;
  paymentVoiding = false;
  cashClosureSaving = false;
  prescriptionLoading = false;
  prescriptionSaving = false;
  medicationSaving = false;
  clinicalDocumentLoading = false;
  clinicalDocumentSaving = false;
  reportsLoading = false;
  consentsLoading = false;
  consentTemplateSaving = false;
  patientConsentSaving = false;
  consentSigning = false;
  errorMessage = '';
  successMessage = '';
  bootstrap: OdontologyDashboardDto | null = null;
  patients: OdontologyPatientDto[] = [];
  dentists: OdontologyDentistDto[] = [];
  appointments: OdontologyAppointmentDto[] = [];
  appointmentReminders: OdontologyAppointmentReminderDto[] = [];
  clinicalRecords: OdontologyClinicalRecordDto[] = [];
  odontogram: OdontologyOdontogramDto | null = null;
  periodontograms: OdontologyPeriodontogramDto[] = [];
  periodontogramDetail: OdontologyPeriodontogramDto | null = null;
  treatmentPlans: OdontologyTreatmentPlanDto[] = [];
  attachments: OdontologyAttachmentDto[] = [];
  inventoryItems: OdontologyInventoryItemDto[] = [];
  inventoryMovements: OdontologyInventoryMovementDto[] = [];
  inventorySuppliers: OdontologySupplierDto[] = [];
  inventoryPurchaseRequests: OdontologyPurchaseRequestDto[] = [];
  inventoryProcedureKit: OdontologyProcedureInventoryKitDto[] = [];
  instruments: OdontologyInstrumentDto[] = [];
  sterilizationCycles: OdontologySterilizationCycleDto[] = [];
  payments: OdontologyPaymentDto[] = [];
  medications: OdontologyMedicationDto[] = [];
  prescriptions: OdontologyPrescriptionDto[] = [];
  clinicalDocuments: OdontologyClinicalDocumentDto[] = [];
  reportData: OdontologyReportDto | null = null;
  consentTemplates: OdontologyConsentTemplateDto[] = [];
  patientConsents: OdontologyPatientConsentDto[] = [];
  selectedClinicalSubTab: ClinicalSubTab = 'records';
  selectedConsentSubTab: 'consents' | 'templates' = 'consents';
  patientSearchTerm = '';
  patientStatusFilter = '';
  patientMode: 'list' | 'form' | 'history' = 'list';
  editingPatientId: string | null = null;
  patientForm = this.emptyPatientForm();
  selectedHistoryPatient: OdontologyPatientDto | null = null;
  patientHistory: PatientHistoryData = this.emptyPatientHistory();
  globalPatientSearchTerm = '';
  globalPatientResults: OdontologyPatientDto[] = [];
  globalPatientLoading = false;
  globalPatientSearched = false;
  patientImportPreviewRows: PatientImportPreviewRow[] = [];
  patientImportOriginalHeaders: string[] = [];
  patientImportFileName = '';
  patientImportMessage = '';
  patientImportMessageType: 'info' | 'success' | 'error' = 'info';
  appointmentSearchTerm = '';
  appointmentDateFilter = this.todayString();
  appointmentViewMode: 'day' | 'week' = 'day';
  appointmentStatusFilter = '';
  appointmentDentistFilter = '';
  appointmentSiteFilter = '';
  appointmentChairFilter = '';
  appointmentReminderSearchTerm = '';
  appointmentReminderChannelFilter = '';
  appointmentReminderStatusFilter = '';
  appointmentReminderKindFilter = '';
  appointmentMode: 'list' | 'form' = 'list';
  appointmentFormIntent: 'create' | 'edit' | 'reschedule' = 'create';
  editingAppointmentId: string | null = null;
  appointmentForm = this.emptyAppointmentForm();
  clinicalSearchTerm = '';
  clinicalStatusFilter = '';
  clinicalPatientFilter = '';
  clinicalMode: 'list' | 'form' = 'list';
  editingClinicalRecordId: string | null = null;
  clinicalForm = this.emptyClinicalForm();
  selectedClinicalNoteRecord: OdontologyClinicalRecordDto | null = null;
  selectedClinicalRecordToSign: OdontologyClinicalRecordDto | null = null;
  clinicalPatientSignatureDataUrl = '';
  clinicalSignerForm = this.emptyClinicalSignerForm();
  private clinicalSignatureDrawing = false;
  clinicalNoteForm = this.emptyClinicalNoteForm();
  treatmentSearchTerm = '';
  treatmentStatusFilter = '';
  treatmentPatientFilter = '';
  treatmentPaymentFilter = '';
  treatmentMode: 'list' | 'form' = 'list';
  editingTreatmentPlanId: string | null = null;
  treatmentForm = this.emptyTreatmentPlanForm();
  selectedTreatmentPlanToAccept: OdontologyTreatmentPlanDto | null = null;
  treatmentPlanSignatureDataUrl = '';
  treatmentPlanSignerForm = this.emptyTreatmentPlanSignerForm();
  private treatmentPlanSignatureDrawing = false;
  attachmentSearchTerm = '';
  attachmentCategoryFilter = '';
  attachmentPatientFilter = '';
  attachmentMode: 'list' | 'form' = 'list';
  attachmentForm = this.emptyAttachmentForm();
  attachmentFile: File | null = null;
  inventorySearchTerm = '';
  inventoryStatusFilter = 'active';
  inventoryLowStockOnly = false;
  inventoryMovementSearchTerm = '';
  inventoryMovementTypeFilter = '';
  inventoryMovementItemFilter = '';
  inventorySupplierSearchTerm = '';
  inventorySupplierStatusFilter = 'active';
  inventoryPurchaseSearchTerm = '';
  inventoryPurchaseStatusFilter = '';
  inventoryMode: 'list' | 'form' | 'movement' | 'supplier' | 'purchase' = 'list';
  editingInventoryItemId: string | null = null;
  editingSupplierId: string | null = null;
  inventoryItemForm = this.emptyInventoryItemForm();
  inventoryMovementForm = this.emptyInventoryMovementForm();
  supplierSaving = false;
  supplierForm = this.emptySupplierForm();
  inventoryPurchaseSaving = false;
  inventoryPurchaseUpdatingId = '';
  inventoryPurchaseForm = this.emptyInventoryPurchaseForm();
  inventoryKitProcedureId = '';
  inventoryKitItems: OdontologyProcedureInventoryKitItemPayload[] = [];
  instrumentSearchTerm = '';
  instrumentStatusFilter = 'active';
  sterilizationSearchTerm = '';
  sterilizationResultFilter = '';
  sterilizationMethodFilter = '';
  sterilizationResponsibleFilter = '';
  sterilizationReportStartDate = this.monthStartString();
  sterilizationReportEndDate = this.todayString();
  sterilizationMode: 'list' | 'instrument' | 'cycle' = 'list';
  editingInstrumentId: string | null = null;
  instrumentForm = this.emptyInstrumentForm();
  sterilizationCycleForm = this.emptySterilizationCycleForm();
  paymentSearchTerm = '';
  paymentStatusFilter = '';
  paymentPatientFilter = '';
  paymentPlanFilter = '';
  paymentStartDateFilter = this.monthStartString();
  paymentEndDateFilter = this.todayString();
  paymentCashierFilter = '';
  paymentMode: 'list' | 'form' = 'list';
  paymentForm = this.emptyPaymentForm();
  cashClosures: OdontologyCashClosureDto[] = [];
  cashClosureNotes = '';
  prescriptionSearchTerm = '';
  prescriptionStatusFilter = '';
  prescriptionPatientFilter = '';
  prescriptionMode: 'list' | 'form' = 'list';
  prescriptionForm = this.emptyPrescriptionForm();
  medicationForm = this.emptyMedicationForm();
  showMedicationForm = false;
  clinicalDocumentSearchTerm = '';
  clinicalDocumentTypeFilter = '';
  clinicalDocumentStatusFilter = '';
  clinicalDocumentPatientFilter = '';
  clinicalDocumentMode: 'list' | 'form' = 'list';
  clinicalDocumentForm = this.emptyClinicalDocumentForm();
  reportStartDate = this.monthStartString();
  reportEndDate = this.todayString();
  odontogramPatientId = '';
  odontogramDentition: 'permanent' | 'temporary' | 'mixed' = 'permanent';
  selectedToothNumber = '';
  odontogramConditionItemId = '';
  odontogramNotes = '';
  odontogramRecordDate = this.todayString();
  periodontogramPatientFilter = '';
  periodontogramSearchTerm = '';
  periodontogramMode: 'list' | 'form' = 'list';
  periodontogramForm = this.emptyPeriodontogramForm();
  consentSearchTerm = '';
  consentStatusFilter = '';
  consentPatientFilter = '';
  consentMode: 'list' | 'form' = 'list';
  consentTemplateMode: 'list' | 'form' = 'list';
  editingConsentTemplateId: string | null = null;
  selectedConsentToSign: OdontologyPatientConsentDto | null = null;
  consentSignerSignatureDataUrl = '';
  private consentSignatureDrawing = false;
  patientConsentForm = this.emptyPatientConsentForm();
  consentTemplateForm = this.emptyConsentTemplateForm();
  siteSaving = false;
  chairSaving = false;
  settingsSaving = false;
  scheduleLoading = false;
  scheduleSaving = false;
  catalogLoading = false;
  catalogSaving = false;
  procedureSaving = false;
  editingSiteId: string | null = null;
  editingChairId: string | null = null;
  editingCatalogItemId: string | null = null;
  editingProcedureTypeId: string | null = null;
  selectedCatalogType = 'appointment_status';
  catalogItems: OdontologyCatalogItemDto[] = [];
  settingsForm = this.emptySettingsForm();
  siteForm = this.emptySiteForm();
  chairForm = this.emptyChairForm();
  catalogForm = this.emptyCatalogForm();
  procedureForm = this.emptyProcedureForm();
  dentistSchedules: OdontologyDentistScheduleDto[] = [];
  selectedScheduleDentistId = '';
  scheduleFormRows: OdontologyDentistSchedulePayload[] = [];

  readonly tabs: Array<{ key: OdontologyTab; label: string; description: string }> = [
    { key: 'dashboard', label: 'Tablero', description: 'Resumen operativo odontológico.' },
    { key: 'patients', label: 'Pacientes', description: 'Base para datos administrativos e historia clínica.' },
    { key: 'agenda', label: 'Agenda', description: 'Citas por sede, odontólogo y unidad odontológica.' },
    { key: 'clinical', label: 'Historia y odontograma', description: 'Evoluciones, odontograma, plan y firmas.' },
    { key: 'treatments', label: 'Planes de tratamiento', description: 'Procedimientos, costos, sesiones y estado del plan.' },
    { key: 'payments', label: 'Pagos', description: 'Abonos, métodos de pago y saldos por plan.' },
    { key: 'prescriptions', label: 'Recetas', description: 'Medicamentos, indicaciones y PDF para el paciente.' },
    { key: 'documents', label: 'Documentos', description: 'Certificados, incapacidades, constancias y remisiones.' },
    { key: 'consents', label: 'Consentimientos', description: 'Formatos configurables por procedimiento.' },
    { key: 'attachments', label: 'Adjuntos', description: 'Radiografías, autorizaciones, remisiones y soportes.' },
    { key: 'inventory', label: 'Inventario', description: 'Insumos, materiales, stock bajo y movimientos.' },
    { key: 'sterilization', label: 'Esterilización', description: 'Instrumental, ciclos, indicadores y trazabilidad.' },
    { key: 'reports', label: 'Reportes', description: 'Indicadores por fechas de agenda, clínica, pagos y soportes.' },
    { key: 'settings', label: 'Configuración', description: 'Parámetros, catálogos, sedes y unidades.' }
  ];

  readonly landingPageOptions = [
    { value: 'dashboard', label: 'Tablero' },
    { value: 'agenda', label: 'Agenda' },
    { value: 'pacientes', label: 'Pacientes' },
    { value: 'reportes', label: 'Reportes' }
  ];

  readonly landingPageOptionsByValue: Record<string, string> = this.landingPageOptions.reduce(
    (acc, item) => ({ ...acc, [item.value]: item.label }),
    {} as Record<string, string>
  );

  readonly weekDayOptions = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
  ];

  readonly weekDayLabels: Record<number, string> = this.weekDayOptions.reduce(
    (acc, item) => ({ ...acc, [item.value]: item.label }),
    {} as Record<number, string>
  );

  readonly catalogTypeOptions = [
    { value: 'appointment_status', label: 'Estados de cita' },
    { value: 'patient_status', label: 'Estados de paciente' },
    { value: 'tooth_condition', label: 'Condiciones odontograma' },
    { value: 'photo_category', label: 'Categorías de foto' },
    { value: 'allergy', label: 'Alergias' },
    { value: 'medical_condition', label: 'Antecedentes / condiciones' },
    { value: 'medication', label: 'Medicamentos' },
    { value: 'task_type', label: 'Tipos de tarea' }
  ];

  readonly catalogTypeLabels: Record<string, string> = this.catalogTypeOptions.reduce(
    (acc, item) => ({ ...acc, [item.value]: item.label }),
    {} as Record<string, string>
  );

  readonly consentTemplateVariables = [
    '{{patient_name}}',
    '{{patient_document}}',
    '{{signer_name}}',
    '{{signer_document}}',
    '{{procedure_name}}',
    '{{date}}'
  ];

  readonly patientRequiredFieldOptions = [
    {
      value: 'documentType',
      label: 'Tipo documento',
      locked: true,
      description: 'Base legal de identificación.'
    },
    {
      value: 'documentNumber',
      label: 'Número documento',
      locked: true,
      description: 'Evita duplicados y cruces de historia.'
    },
    {
      value: 'fullName',
      label: 'Nombre completo',
      locked: true,
      description: 'Dato mínimo de historia clínica.'
    },
    {
      value: 'birthDate',
      label: 'Fecha nacimiento',
      locked: true,
      description: 'Necesaria para edad, menor de edad y riesgos.'
    },
    {
      value: 'sex',
      label: 'Sexo',
      locked: true,
      description: 'Dato clínico mínimo.'
    },
    {
      value: 'phone',
      label: 'Teléfono',
      locked: false,
      description: 'Contacto para citas y recordatorios.'
    },
    {
      value: 'email',
      label: 'Correo',
      locked: false,
      description: 'Notificaciones y documentos.'
    },
    {
      value: 'address',
      label: 'Dirección',
      locked: false,
      description: 'Dato administrativo.'
    },
    {
      value: 'emergencyContactName',
      label: 'Contacto emergencia',
      locked: false,
      description: 'Responsable en caso de evento.'
    },
    {
      value: 'emergencyContactPhone',
      label: 'Teléfono emergencia',
      locked: false,
      description: 'Contacto rápido del responsable.'
    }
  ];

  readonly patientCoreRequiredFields = this.patientRequiredFieldOptions
    .filter((field) => field.locked)
    .map((field) => field.value);

  readonly patientImportHeaderFieldMap: Record<string, string> = {
    'Tipo documento': 'documentType',
    'Número documento': 'documentNumber',
    'Nombre completo': 'fullName',
    'Fecha nacimiento': 'birthDate',
    Sexo: 'sex',
    Teléfono: 'phone',
    Correo: 'email',
    Dirección: 'address',
    'Contacto emergencia': 'emergencyContactName',
    'Teléfono emergencia': 'emergencyContactPhone'
  };

  readonly patientImportHeaders = [
    'Tipo documento',
    'Número documento',
    'Nombre completo',
    'Fecha nacimiento',
    'Sexo',
    'Teléfono',
    'Correo',
    'Dirección',
    'Contacto emergencia',
    'Teléfono emergencia',
    'Tipo paciente',
    'EPS / convenio',
    'Requiere autorización',
    'Estado',
    'Nombre acudiente',
    'Tipo documento acudiente',
    'Documento acudiente',
    'Teléfono acudiente',
    'Parentesco acudiente',
    'Alergias',
    'Enfermedades / antecedentes',
    'Medicamentos actuales',
    'Embarazo',
    'Riesgo sangrado',
    'Diabetes',
    'Hipertensión',
    'Marcapasos',
    'Observación importante'
  ];

  readonly maxPatientImportRows = 500;
  readonly maxPatientImportFileSizeMb = 8;

  readonly documentTypes = [
    { value: 'cedula_ciudadania', label: 'Cédula ciudadanía' },
    { value: 'cedula_extranjeria', label: 'Cédula extranjería' },
    { value: 'tarjeta_identidad', label: 'Tarjeta identidad' },
    { value: 'registro_civil', label: 'Registro civil' },
    { value: 'pasaporte', label: 'Pasaporte' },
    { value: 'permiso_especial', label: 'Permiso especial' },
    { value: 'otro', label: 'Otro' }
  ];

  readonly sexOptions = [
    { value: 'femenino', label: 'Femenino' },
    { value: 'masculino', label: 'Masculino' },
    { value: 'otro', label: 'Otro' },
    { value: 'no_especifica', label: 'No especifica' }
  ];

  readonly patientTypes = [
    { value: 'particular', label: 'Particular' },
    { value: 'eps', label: 'EPS' },
    { value: 'aseguradora', label: 'Aseguradora' },
    { value: 'convenio', label: 'Convenio' },
    { value: 'otro', label: 'Otro' }
  ];

  readonly treatmentPlanStatuses = [
    { value: 'draft', label: 'Borrador' },
    { value: 'proposed', label: 'Propuesto' },
    { value: 'accepted', label: 'Aceptado' },
    { value: 'in_progress', label: 'En tratamiento' },
    { value: 'completed', label: 'Completado' },
    { value: 'cancelled', label: 'Cancelado' }
  ];

  readonly treatmentItemStatuses = [
    { value: 'pending', label: 'Pendiente' },
    { value: 'in_progress', label: 'En proceso' },
    { value: 'completed', label: 'Realizado' },
    { value: 'cancelled', label: 'Cancelado' }
  ];

  readonly attachmentCategories = [
    { value: 'radiografia', label: 'Radiografía' },
    { value: 'autorizacion', label: 'Autorización' },
    { value: 'remision', label: 'Remisión' },
    { value: 'laboratorio', label: 'Laboratorio' },
    { value: 'formula', label: 'Fórmula' },
    { value: 'foto_clinica', label: 'Foto clínica' },
    { value: 'documento_externo', label: 'Documento externo' },
    { value: 'otro', label: 'Otro' }
  ];

  readonly paymentMethods = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'tarjeta_credito', label: 'Tarjeta crédito' },
    { value: 'tarjeta_debito', label: 'Tarjeta débito' },
    { value: 'nequi', label: 'Nequi' },
    { value: 'daviplata', label: 'Daviplata' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'otro', label: 'Otro' }
  ];

  readonly clinicalDocumentTypes = [
    { value: 'certificado', label: 'Certificado' },
    { value: 'incapacidad', label: 'Incapacidad' },
    { value: 'constancia', label: 'Constancia' },
    { value: 'remision', label: 'Remisión' },
    { value: 'otro', label: 'Otro' }
  ];

  readonly sterilizationMethods = [
    { value: 'autoclave', label: 'Autoclave' },
    { value: 'chemical', label: 'Química' },
    { value: 'dry_heat', label: 'Calor seco' },
    { value: 'other', label: 'Otro' }
  ];

  readonly sterilizationResults = [
    { value: 'successful', label: 'Exitoso' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'failed', label: 'Fallido' }
  ];

  constructor(
    private readonly admin: AdminService,
    private readonly odontology: OdontologyService,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    public readonly auth: AuthService
  ) {
    void this.init();
  }

  get canSelectClient(): boolean {
    return this.auth.hasRole('superuser');
  }

  get filteredClients(): ClientOption[] {
    const term = this.clientSearchTerm.toLowerCase().trim();
    if (!term) return this.clients;
    return this.clients.filter((client) =>
      [client.name, client.nit, client.city, client.email]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
        .includes(term)
    );
  }

  get selectableClients(): ClientOption[] {
    const filtered = this.filteredClients;
    const selected = this.selectedClientInfo;
    if (selected && !filtered.some((client) => client.id === selected.id)) {
      return [selected, ...filtered];
    }
    return filtered;
  }

  get selectedClientInfo(): ClientOption | null {
    return this.clients.find((client) => client.id === this.selectedClientId) ?? null;
  }

  get currentTab(): { key: OdontologyTab; label: string; description: string } {
    return this.tabs.find((tab) => tab.key === this.selectedTab) ?? this.tabs[0];
  }

  get activeProceduresCount(): number {
    return this.bootstrap?.procedures.filter((item) => item.is_active).length ?? 0;
  }

  get activeSitesCount(): number {
    return this.bootstrap?.sites.filter((item) => item.is_active).length ?? 0;
  }

  get activeChairsCount(): number {
    return this.bootstrap?.chairs.filter((item) => item.is_active).length ?? 0;
  }

  get activeToothConditionsCount(): number {
    return this.bootstrap?.toothConditions.filter((item) => item.is_active).length ?? 0;
  }

  get canManagePatients(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:patients:manage');
  }

  get canViewPatientHistory(): boolean {
    return this.canManagePatients && (
      this.canManageAppointments ||
      this.canManageClinicalRecords ||
      this.canManageOdontogram ||
      this.canManagePeriodontogram ||
      this.canManageTreatmentPlans ||
      this.canManageConsents ||
      this.canManagePrescriptions ||
      this.canManageClinicalDocuments ||
      this.canManageAttachments ||
      this.canManagePayments
    );
  }

  get canUseGlobalPatientSearch(): boolean {
    return this.canManagePatients ||
      this.canManageAppointments ||
      this.canManageClinicalRecords ||
      this.canManageTreatmentPlans ||
      this.canManageConsents ||
      this.canManagePrescriptions ||
      this.canManageClinicalDocuments ||
      this.canManageAttachments ||
      this.canManagePayments;
  }

  get canImportPatients(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:patients:import');
  }

  get canManageAppointments(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:appointments:manage');
  }

  get canManageClinicalRecords(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canManageOdontogram(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:odontogram:manage') || this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canManagePeriodontogram(): boolean {
    return this.auth.hasRole('superuser') ||
      this.auth.hasPermission('odontology:periodontogram:manage') ||
      this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canManageConsents(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:consents:manage') || this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canManageTreatmentPlans(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:treatment_plans:manage') || this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canManageAttachments(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:attachments:manage') || this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canManageInventory(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:inventory:manage');
  }

  get canManageSterilization(): boolean {
    return this.auth.hasRole('superuser') ||
      this.auth.hasPermission('odontology:sterilization:manage') ||
      this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canManagePayments(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:payments:manage');
  }

  get canViewFinancialValues(): boolean {
    return this.auth.hasRole('superuser') ||
      this.auth.hasPermission('odontology:financial:view') ||
      this.auth.hasPermission('odontology:settings:manage');
  }

  get canManagePrescriptions(): boolean {
    return this.auth.hasRole('superuser') ||
      this.auth.hasPermission('odontology:prescriptions:manage') ||
      this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canManageClinicalDocuments(): boolean {
    return this.auth.hasRole('superuser') ||
      this.auth.hasPermission('odontology:documents:manage') ||
      this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canViewReports(): boolean {
    return this.auth.hasRole('superuser') ||
      this.auth.hasPermission('odontology:reports:view') ||
      this.auth.hasPermission('odontology:payments:manage') ||
      this.auth.hasPermission('odontology:clinical_records:manage');
  }

  get canManageSettings(): boolean {
    return this.auth.hasRole('superuser') || this.auth.hasPermission('odontology:settings:manage');
  }

  get patientStatusOptions(): string[] {
    const statuses = this.bootstrap?.patientStatuses?.filter((status) => status.is_active).map((status) => status.name) ?? [];
    return statuses.length ? statuses : ['Activo', 'Inactivo', 'Archivado', 'Fallecido', 'Bloqueado administrativo'];
  }

  get isEditingPatient(): boolean {
    return Boolean(this.editingPatientId);
  }

  get patientImportHasRows(): boolean {
    return this.patientImportPreviewRows.length > 0;
  }

  get patientImportHasErrors(): boolean {
    return this.patientImportPreviewRows.some((row) => row.errors.length > 0);
  }

  get patientImportValidRowsCount(): number {
    return this.patientImportPreviewRows.filter((row) => row.payload && !row.errors.length).length;
  }

  get patientImportErrorRowsCount(): number {
    return this.patientImportPreviewRows.filter((row) => row.errors.length > 0).length;
  }

  get patientAge(): number | null {
    return this.calculateAge(this.patientForm.birthDate);
  }

  get patientIsMinor(): boolean {
    return this.patientAge !== null && this.patientAge < 18;
  }

  patientFieldRequired(field: string): boolean {
    return this.normalizePatientRequiredFields(this.settingsForm.requiredPatientFields).includes(field);
  }

  patientRequiredMarker(field: string): string {
    return this.patientFieldRequired(field) ? ' *' : '';
  }

  onPatientBirthDateChange(): void {
    this.ensurePatientAuthorizationByAge();
    this.refreshViewSoon();
  }

  patientRequiredFieldLocked(field: string): boolean {
    return this.patientCoreRequiredFields.includes(field);
  }

  togglePatientRequiredField(field: string, event: Event): void {
    if (this.patientRequiredFieldLocked(field)) {
      this.settingsForm.requiredPatientFields = this.normalizePatientRequiredFields(this.settingsForm.requiredPatientFields);
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    const fields = new Set(this.normalizePatientRequiredFields(this.settingsForm.requiredPatientFields));
    if (checked) {
      fields.add(field);
    } else {
      fields.delete(field);
    }
    this.settingsForm.requiredPatientFields = this.normalizePatientRequiredFields(Array.from(fields));
  }

  get appointmentStatusOptions(): string[] {
    const statuses = this.bootstrap?.appointmentStatuses?.filter((status) => status.is_active).map((status) => status.name) ?? [];
    return statuses.length
      ? statuses
      : ['Programada', 'Confirmada', 'En sala / llegada', 'En atención', 'Atendida', 'Cancelada', 'No asistió', 'Reprogramada'];
  }

  get activePatients(): OdontologyPatientDto[] {
    return this.patients.filter((patient) => patient.status !== 'Archivado' && patient.status !== 'Fallecido');
  }

  get activeDentists(): OdontologyDentistDto[] {
    return this.dentists.filter((dentist) => dentist.is_active);
  }

  get activeSites() {
    return this.bootstrap?.sites.filter((site) => site.is_active) ?? [];
  }

  get activeChairs() {
    const chairs = this.bootstrap?.chairs.filter((chair) => chair.is_active) ?? [];
    if (!this.appointmentForm.siteId) return chairs;
    return chairs.filter((chair) => chair.site_id === this.appointmentForm.siteId);
  }

  get activeChairsForFilter() {
    const chairs = this.bootstrap?.chairs.filter((chair) => chair.is_active) ?? [];
    if (!this.appointmentSiteFilter) return chairs;
    return chairs.filter((chair) => chair.site_id === this.appointmentSiteFilter);
  }

  get activeProcedures() {
    return this.bootstrap?.procedures.filter((procedure) => procedure.is_active) ?? [];
  }

  get agendaTimelineAppointments(): OdontologyAppointmentDto[] {
    return [...this.appointments].sort((a, b) => {
      const left = `${this.dateOnly(a.scheduled_date)} ${this.timeOnly(a.start_time)}`;
      const right = `${this.dateOnly(b.scheduled_date)} ${this.timeOnly(b.start_time)}`;
      return left.localeCompare(right);
    });
  }

  get agendaSelectedDateLabel(): string {
    if (!this.appointmentDateFilter) return 'Todas las fechas consultadas';
    const [year, month, day] = this.appointmentDateFilter.split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    if (Number.isNaN(date.getTime())) return this.appointmentDateFilter;
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  get agendaPeriodLabel(): string {
    if (this.appointmentViewMode === 'day') return this.agendaSelectedDateLabel;
    const range = this.appointmentWeekRange();
    return `Semana del ${this.shortDateLabel(range.start)} al ${this.shortDateLabel(range.end)}`;
  }

  get agendaWeekDays(): Array<{ date: string; label: string; shortLabel: string; total: number; active: boolean }> {
    const range = this.appointmentWeekRange();
    const start = this.parseDateInput(range.start) ?? new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = this.formatDateObject(date);
      const total = this.appointments.filter((appointment) => this.dateOnly(appointment.scheduled_date) === iso).length;
      return {
        date: iso,
        label: date.toLocaleDateString('es-CO', { weekday: 'long' }),
        shortLabel: date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
        total,
        active: iso === this.appointmentDateFilter
      };
    });
  }

  get agendaSummary() {
    const items = this.appointments;
    const normalized = (value: string) => this.normalizeStatusKey(value);
    return {
      total: items.length,
      confirmed: items.filter((appointment) => ['confirmada', 'en-sala-llegada', 'en-atencion'].includes(normalized(appointment.status))).length,
      attended: items.filter((appointment) => normalized(appointment.status) === 'atendida').length,
      pending: items.filter((appointment) => ['programada', 'reprogramada'].includes(normalized(appointment.status))).length
    };
  }

  get reminderSummary() {
    const items = this.appointmentReminders;
    return {
      total: items.length,
      sent: items.filter((reminder) => reminder.status === 'sent').length,
      failed: items.filter((reminder) => reminder.status === 'failed').length
    };
  }

  get appointmentQuickStatusOptions(): Array<{ status: string; label: string; className: string }> {
    const desired = [
      { status: 'Confirmada', label: 'Confirmar', className: 'confirmada' },
      { status: 'En sala / llegada', label: 'Llegó', className: 'en-sala-llegada' },
      { status: 'En atención', label: 'Atender', className: 'en-atencion' },
      { status: 'Atendida', label: 'Finalizar', className: 'atendida' },
      { status: 'No asistió', label: 'No asistió', className: 'no-asistio' }
    ];
    const configured = new Map(this.appointmentStatusOptions.map((status) => [this.normalizeStatusKey(status), status]));
    return desired
      .map((item) => {
        const configuredStatus = configured.get(this.normalizeStatusKey(item.status));
        return configuredStatus ? { ...item, status: configuredStatus } : null;
      })
      .filter((item): item is { status: string; label: string; className: string } => Boolean(item));
  }

  configuredAppointmentStatus(status: string): string {
    const normalized = this.normalizeStatusKey(status);
    return this.appointmentStatusOptions.find((item) => this.normalizeStatusKey(item) === normalized) || '';
  }

  get selectedInventoryKitProcedureName(): string {
    if (!this.inventoryKitProcedureId) return '';
    return this.activeProcedures.find((procedure) => procedure.id === this.inventoryKitProcedureId)?.name ?? '';
  }

  get activeConsentTemplates(): OdontologyConsentTemplateDto[] {
    return this.consentTemplates.filter((template) => template.is_active);
  }

  get dataProcessingConsentTemplate(): OdontologyConsentTemplateDto | null {
    return this.preferredDataProcessingConsentTemplate();
  }

  get isEditingAppointment(): boolean {
    return Boolean(this.editingAppointmentId);
  }

  get appointmentFormTitle(): string {
    if (this.appointmentFormIntent === 'reschedule') return 'Reprogramar cita';
    return this.isEditingAppointment ? 'Editar cita' : 'Crear cita';
  }

  get appointmentFormDescription(): string {
    if (this.appointmentFormIntent === 'reschedule') {
      return 'Ajusta fecha, hora, odontólogo o unidad. La cita quedará marcada como reprogramada.';
    }
    return 'La agenda bloquea cruces del odontólogo, unidad odontológica y horarios configurados.';
  }

  get appointmentSubmitLabel(): string {
    if (this.appointmentSaving) return 'Guardando...';
    if (this.appointmentFormIntent === 'reschedule') return 'Guardar reprogramación';
    return this.isEditingAppointment ? 'Guardar cambios' : 'Crear cita';
  }

  get isEditingClinicalRecord(): boolean {
    return Boolean(this.editingClinicalRecordId);
  }

  get isEditingTreatmentPlan(): boolean {
    return Boolean(this.editingTreatmentPlanId);
  }

  canAcceptTreatmentPlan(plan: OdontologyTreatmentPlanDto): boolean {
    return Boolean(
      this.canViewFinancialValues &&
        this.bootstrap?.settings.require_treatment_plan_signature &&
        !plan.accepted_signature_path &&
        ['draft', 'proposed'].includes(plan.status)
    );
  }

  canEditTreatmentPlan(plan: OdontologyTreatmentPlanDto): boolean {
    return this.canViewFinancialValues && !plan.accepted_signature_path;
  }

  canScheduleTreatmentPlan(plan: OdontologyTreatmentPlanDto): boolean {
    return Boolean(
      this.canManageAppointments &&
        ['accepted', 'in_progress'].includes(plan.status) &&
        (!this.bootstrap?.settings.require_treatment_plan_signature || plan.accepted_signature_path)
    );
  }

  get selectedClinicalPatientAppointments(): OdontologyAppointmentDto[] {
    if (!this.clinicalForm.patientId) return [];
    return this.appointments.filter((appointment) => appointment.patient_id === this.clinicalForm.patientId);
  }

  get selectedAppointmentPatientTreatmentPlans(): OdontologyTreatmentPlanDto[] {
    if (!this.appointmentForm.patientId) return [];
    return this.treatmentPlans.filter((plan) =>
      plan.patient_id === this.appointmentForm.patientId &&
      ['accepted', 'in_progress'].includes(plan.status) &&
      (!this.bootstrap?.settings.require_treatment_plan_signature || Boolean(plan.accepted_signature_path))
    );
  }

  get selectedAppointmentTreatmentPlan(): OdontologyTreatmentPlanDto | null {
    if (!this.appointmentForm.treatmentPlanId) return null;
    return this.treatmentPlans.find((plan) => plan.id === this.appointmentForm.treatmentPlanId) ?? null;
  }

  get selectedAppointmentPlanItems(): OdontologyTreatmentPlanItemDto[] {
    return (this.selectedAppointmentTreatmentPlan?.items || []).filter((item) => item.status !== 'cancelled');
  }

  get filteredTreatmentPlans(): OdontologyTreatmentPlanDto[] {
    if (!this.canViewFinancialValues || !this.treatmentPaymentFilter) return this.treatmentPlans;
    return this.treatmentPlans.filter((plan) => this.treatmentFinancialStatus(plan) === this.treatmentPaymentFilter);
  }

  get clinicalFormPatient(): OdontologyPatientDto | null {
    return this.patients.find((patient) => patient.id === this.clinicalForm.patientId) ?? null;
  }

  get selectedTreatmentPatientClinicalRecords(): OdontologyClinicalRecordDto[] {
    if (!this.treatmentForm.patientId) return [];
    return this.clinicalRecords.filter((record) => record.patient_id === this.treatmentForm.patientId);
  }

  get treatmentTotalAmount(): number {
    return this.treatmentForm.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  }

  get selectedAttachmentPatientClinicalRecords(): OdontologyClinicalRecordDto[] {
    if (!this.attachmentForm.patientId) return [];
    return this.clinicalRecords.filter((record) => record.patient_id === this.attachmentForm.patientId);
  }

  get selectedAttachmentPatientTreatmentPlans(): OdontologyTreatmentPlanDto[] {
    if (!this.attachmentForm.patientId) return [];
    return this.treatmentPlans.filter((plan) => plan.patient_id === this.attachmentForm.patientId);
  }

  get selectedPaymentPatientTreatmentPlans(): OdontologyTreatmentPlanDto[] {
    if (!this.paymentForm.patientId) return [];
    return this.treatmentPlans.filter((plan) => plan.patient_id === this.paymentForm.patientId);
  }

  get selectedPrescriptionPatientClinicalRecords(): OdontologyClinicalRecordDto[] {
    if (!this.prescriptionForm.patientId) return [];
    return this.clinicalRecords.filter((record) => record.patient_id === this.prescriptionForm.patientId);
  }

  get selectedDocumentPatientClinicalRecords(): OdontologyClinicalRecordDto[] {
    if (!this.clinicalDocumentForm.patientId) return [];
    return this.clinicalRecords.filter((record) => record.patient_id === this.clinicalDocumentForm.patientId);
  }

  get paymentSelectedPlan(): OdontologyTreatmentPlanDto | null {
    if (!this.paymentForm.treatmentPlanId) return null;
    return this.treatmentPlans.find((plan) => plan.id === this.paymentForm.treatmentPlanId) ?? null;
  }

  get selectedConsentPatientAppointments(): OdontologyAppointmentDto[] {
    if (!this.patientConsentForm.patientId) return [];
    return this.appointments.filter((appointment) => appointment.patient_id === this.patientConsentForm.patientId);
  }

  get selectedConsentTemplate(): OdontologyConsentTemplateDto | null {
    if (!this.patientConsentForm.templateId) return null;
    return this.consentTemplates.find((template) => template.id === this.patientConsentForm.templateId) ?? null;
  }

  get activeToothConditions() {
    return this.bootstrap?.toothConditions.filter((condition) => condition.is_active) ?? [];
  }

  get activeInventoryItems(): OdontologyInventoryItemDto[] {
    return this.inventoryItems.filter((item) => item.is_active);
  }

  get activeSuppliers(): OdontologySupplierDto[] {
    return this.inventorySuppliers.filter((supplier) => supplier.is_active);
  }

  get lowStockInventoryCount(): number {
    return this.inventoryItems.filter((item) => item.low_stock && item.is_active).length;
  }

  get lowStockInventoryItems(): OdontologyInventoryItemDto[] {
    return this.inventoryItems.filter((item) => item.low_stock && item.is_active).slice(0, 6);
  }

  get activePurchaseRequestCount(): number {
    return this.inventoryPurchaseRequests.filter((request) => !['received', 'cancelled'].includes(request.status)).length;
  }

  getInventoryItemById(itemId: string): OdontologyInventoryItemDto | null {
    return this.inventoryItems.find((item) => item.id === itemId) ?? null;
  }

  get activeInstruments(): OdontologyInstrumentDto[] {
    return this.instruments.filter((item) => item.is_active);
  }

  get successfulSterilizationCount(): number {
    return this.sterilizationCycles.filter((cycle) => cycle.result === 'successful').length;
  }

  get selectedPeriodontogramPatientClinicalRecords(): OdontologyClinicalRecordDto[] {
    if (!this.periodontogramForm.patientId) return [];
    return this.clinicalRecords.filter((record) => record.patient_id === this.periodontogramForm.patientId);
  }

  get odontogramTeethRows(): string[][] {
    if (this.odontogramDentition === 'temporary') {
      return [
        ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'],
        ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75']
      ];
    }
    if (this.odontogramDentition === 'mixed') {
      return [
        ['18', '17', '16', '55', '54', '53', '52', '51', '61', '62', '63', '64', '65', '26', '27', '28'],
        ['48', '47', '46', '85', '84', '83', '82', '81', '71', '72', '73', '74', '75', '36', '37', '38']
      ];
    }
    return [
      ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'],
      ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']
    ];
  }

  get appointmentEndTime(): string {
    return this.calculateEndTime(this.appointmentForm.startTime, this.appointmentForm.durationMinutes);
  }

  async init(): Promise<void> {
    this.applyRouteHints();
    this.clientsLoading = true;
    this.refreshViewSoon();
    try {
      const userClient = this.auth.currentUser()?.clientId ?? '';
      if (userClient) {
        this.selectedClientId = userClient;
        const client = await this.loadOwnClient();
        if (client) this.clients = [client];
        this.clientsLoading = false;
        await this.onClientChange();
        return;
      }

      if (this.auth.hasRole('superuser') || this.auth.hasPermission('clients:manage')) {
        const rows = await this.admin.listClients();
        this.clients = rows.map((row) => ({
          id: row.id,
          name: row.name,
          nit: row.nit,
          city: row.city,
          email: row.email,
          address: row.address ?? null,
          logoPath: row.logo_path ?? null
        }));
        this.selectedClientId = this.clients[0]?.id ?? '';
        this.clientsLoading = false;
        if (this.selectedClientId) await this.onClientChange();
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo iniciar el módulo odontológico.';
    } finally {
      this.clientsLoading = false;
      this.refreshViewSoon();
    }
  }

  private applyRouteHints(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as OdontologyTab | null;
    if (tab && this.tabs.some((item) => item.key === tab)) {
      this.selectedTab = tab;
    }
    if (this.route.snapshot.queryParamMap.get('lowStock') === 'true') {
      this.inventoryLowStockOnly = true;
      this.inventoryStatusFilter = 'active';
    }
  }

  async onClientChange(): Promise<void> {
    if (!this.selectedClientId) {
      this.bootstrap = null;
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.clearGlobalPatientSearch(false);
    this.refreshViewSoon();
    try {
      this.bootstrap = await this.odontology.getBootstrap(this.selectedClientId);
      this.settingsForm = this.settingsPayloadFromBootstrap();
      if (this.selectedTab === 'dashboard') {
        this.selectedTab = this.landingPageToTab(this.bootstrap.settings.default_landing_page);
      }
      if (this.selectedTab === 'patients' && this.canManagePatients) {
        await this.loadPatients();
      }
      if (this.selectedTab === 'agenda' && this.canManageAppointments) {
        await this.loadAgendaData();
      }
      if (this.selectedTab === 'clinical' && this.canManageClinicalRecords) {
        await this.loadClinicalData();
      }
      if (this.selectedTab === 'treatments' && this.canManageTreatmentPlans) {
        await this.loadTreatmentPlanData();
      }
      if (this.selectedTab === 'consents' && this.canManageConsents) {
        await this.loadConsentData();
      }
      if (this.selectedTab === 'attachments' && this.canManageAttachments) {
        await this.loadAttachmentData();
      }
      if (this.selectedTab === 'inventory' && this.canManageInventory) {
        await this.loadInventoryData();
      }
      if (this.selectedTab === 'sterilization' && this.canManageSterilization) {
        await this.loadSterilizationData();
      }
      if (this.selectedTab === 'payments' && this.canManagePayments) {
        await this.loadPaymentData();
      }
      if (this.selectedTab === 'prescriptions' && this.canManagePrescriptions) {
        await this.loadPrescriptionData();
      }
      if (this.selectedTab === 'documents' && this.canManageClinicalDocuments) {
        await this.loadClinicalDocumentData();
      }
      if (this.selectedTab === 'reports' && this.canViewReports) {
        await this.loadReports();
      }
      if (this.selectedTab === 'settings' && this.canManageSettings) {
        await this.loadSettingsData();
      }
    } catch (error: any) {
      console.error(error);
      this.bootstrap = null;
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar la información odontológica.';
    } finally {
      this.loading = false;
      this.refreshViewSoon();
    }
  }

  selectTab(tab: OdontologyTab): void {
    this.selectedTab = tab;
    if (tab === 'patients' && this.selectedClientId && this.canManagePatients) {
      void this.loadPatients();
    }
    if (tab === 'agenda' && this.selectedClientId && this.canManageAppointments) {
      void this.loadAgendaData();
    }
    if (tab === 'clinical' && this.selectedClientId && this.canManageClinicalRecords) {
      void this.loadClinicalData();
    }
    if (tab === 'treatments' && this.selectedClientId && this.canManageTreatmentPlans) {
      void this.loadTreatmentPlanData();
    }
    if (tab === 'consents' && this.selectedClientId && this.canManageConsents) {
      void this.loadConsentData();
    }
    if (tab === 'attachments' && this.selectedClientId && this.canManageAttachments) {
      void this.loadAttachmentData();
    }
    if (tab === 'inventory' && this.selectedClientId && this.canManageInventory) {
      void this.loadInventoryData();
    }
    if (tab === 'sterilization' && this.selectedClientId && this.canManageSterilization) {
      void this.loadSterilizationData();
    }
    if (tab === 'payments' && this.selectedClientId && this.canManagePayments) {
      void this.loadPaymentData();
    }
    if (tab === 'prescriptions' && this.selectedClientId && this.canManagePrescriptions) {
      void this.loadPrescriptionData();
    }
    if (tab === 'documents' && this.selectedClientId && this.canManageClinicalDocuments) {
      void this.loadClinicalDocumentData();
    }
    if (tab === 'reports' && this.selectedClientId && this.canViewReports) {
      void this.loadReports();
    }
    if (tab === 'settings' && this.selectedClientId && this.canManageSettings) {
      void this.loadSettingsData();
    }
    this.refreshViewSoon();
  }

  async loadPatients(): Promise<void> {
    if (!this.selectedClientId || !this.canManagePatients) return;
    this.patientsLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      this.patients = await this.odontology.listPatients(this.selectedClientId, {
        search: this.patientSearchTerm,
        status: this.patientStatusFilter
      });
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar los pacientes.';
    } finally {
      this.patientsLoading = false;
      this.refreshViewSoon();
    }
  }

  async searchGlobalPatients(): Promise<void> {
    if (!this.selectedClientId || !this.canUseGlobalPatientSearch) return;
    const search = this.globalPatientSearchTerm.trim();
    this.globalPatientSearched = true;
    this.globalPatientResults = [];
    if (search.length < 2) {
      this.errorMessage = 'Escribe al menos 2 caracteres para buscar un paciente.';
      this.refreshViewSoon();
      return;
    }
    this.globalPatientLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      this.globalPatientResults = await this.odontology.listPatients(this.selectedClientId, { search });
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo realizar la búsqueda global de pacientes.';
    } finally {
      this.globalPatientLoading = false;
      this.refreshViewSoon();
    }
  }

  clearGlobalPatientSearch(refresh = true): void {
    this.globalPatientSearchTerm = '';
    this.globalPatientResults = [];
    this.globalPatientLoading = false;
    this.globalPatientSearched = false;
    if (refresh) this.refreshViewSoon();
  }

  async openGlobalPatientHistory(patient: OdontologyPatientDto): Promise<void> {
    if (!this.canViewPatientHistory) return;
    this.selectedTab = 'patients';
    await this.openPatientHistory(patient);
  }

  startCreatePatient(): void {
    this.editingPatientId = null;
    this.patientForm = this.emptyPatientForm();
    this.patientForm.authorizationRequired = this.bootstrap?.settings.require_authorization_by_default ?? false;
    this.patientMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  editPatient(patient: OdontologyPatientDto): void {
    this.editingPatientId = patient.id;
    this.patientForm = {
      documentType: patient.document_type,
      documentNumber: patient.document_number,
      fullName: patient.full_name,
      birthDate: this.dateOnly(patient.birth_date),
      sex: patient.sex,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      emergencyContactName: patient.emergency_contact_name,
      emergencyContactPhone: patient.emergency_contact_phone,
      patientType: patient.patient_type,
      payerName: patient.payer_name ?? '',
      authorizationRequired: patient.authorization_required,
      status: patient.status,
      guardianName: patient.guardian_name ?? '',
      guardianDocumentType: patient.guardian_document_type ?? 'cedula_ciudadania',
      guardianDocumentNumber: patient.guardian_document_number ?? '',
      guardianPhone: patient.guardian_phone ?? '',
      guardianRelationship: patient.guardian_relationship ?? '',
      allergies: patient.allergies ?? '',
      medicalConditions: patient.medical_conditions ?? '',
      currentMedications: patient.current_medications ?? '',
      pregnancy: patient.pregnancy,
      bleedingRisk: patient.bleeding_risk,
      diabetes: patient.diabetes,
      hypertension: patient.hypertension,
      pacemaker: patient.pacemaker,
      importantObservation: patient.important_observation ?? ''
    };
    this.ensurePatientAuthorizationByAge();
    this.patientMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelPatientForm(): void {
    this.patientMode = 'list';
    this.editingPatientId = null;
    this.patientForm = this.emptyPatientForm();
    this.refreshViewSoon();
  }

  async openPatientHistory(patient: OdontologyPatientDto): Promise<void> {
    if (!this.selectedClientId || !this.canViewPatientHistory) return;
    this.selectedHistoryPatient = patient;
    this.patientHistory = this.emptyPatientHistory();
    this.patientMode = 'history';
    this.patientHistoryLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const [
        appointments,
        clinicalRecords,
        clinicalRecordNotes,
        treatmentPlans,
        consents,
        prescriptions,
        clinicalDocuments,
        attachments,
        periodontograms,
        payments,
        odontogram
      ] = await Promise.all([
        this.canManageAppointments ? this.odontology.listAppointments(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManageClinicalRecords ? this.odontology.listClinicalRecords(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManageClinicalRecords ? this.odontology.listClinicalRecordNotes(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManageTreatmentPlans ? this.odontology.listTreatmentPlans(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManageConsents ? this.odontology.listPatientConsents(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManagePrescriptions ? this.odontology.listPrescriptions(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManageClinicalDocuments ? this.odontology.listClinicalDocuments(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManageAttachments ? this.odontology.listAttachments(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManagePeriodontogram ? this.odontology.listPeriodontograms(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManagePayments ? this.odontology.listPayments(this.selectedClientId, { patientId: patient.id }) : Promise.resolve([]),
        this.canManageOdontogram ? this.odontology.getOdontogram(this.selectedClientId, patient.id).catch(() => null) : Promise.resolve(null)
      ]);
      this.patientHistory = {
        appointments,
        clinicalRecords,
        clinicalRecordNotes,
        treatmentPlans,
        consents,
        prescriptions,
        clinicalDocuments,
        attachments,
        periodontograms,
        payments,
        odontogram
      };
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar el historial del paciente.';
    } finally {
      this.patientHistoryLoading = false;
      this.refreshViewSoon();
    }
  }

  closePatientHistory(): void {
    this.patientMode = 'list';
    this.selectedHistoryPatient = null;
    this.patientHistory = this.emptyPatientHistory();
    this.patientHistoryLoading = false;
    this.refreshViewSoon();
  }

  get patientHistoryTotalItems(): number {
    return this.patientHistory.appointments.length +
      this.patientHistory.clinicalRecords.length +
      this.patientHistory.clinicalRecordNotes.length +
      this.patientHistory.treatmentPlans.length +
      this.patientHistory.consents.length +
      this.patientHistory.prescriptions.length +
      this.patientHistory.clinicalDocuments.length +
      this.patientHistory.attachments.length +
      this.patientHistory.periodontograms.length +
      this.patientHistory.payments.length +
      (this.patientHistory.odontogram?.history.length ? 1 : 0);
  }

  get patientHistoryPaymentsTotal(): number {
    return this.patientHistory.payments
      .filter((payment) => payment.status === 'registered')
      .reduce((total, payment) => total + Number(payment.amount || 0), 0);
  }

  get patientTimelineItems(): PatientTimelineItem[] {
    const items: PatientTimelineItem[] = [];

    this.patientHistory.appointments.forEach((appointment) => {
      items.push({
        id: `appointment-${appointment.id}`,
        date: this.timelineDate(appointment.scheduled_date, appointment.start_time),
        label: 'Cita',
        title: appointment.procedure_name || 'Cita odontológica',
        description: `${appointment.status} · ${appointment.dentist_name || 'Odontólogo por definir'} · ${appointment.site_name || 'Sin sede'}`,
        className: 'appointment'
      });
    });

    this.patientHistory.clinicalRecords.forEach((record) => {
      items.push({
        id: `clinical-${record.id}`,
        date: record.signed_at || record.created_at,
        label: 'Historia',
        title: record.chief_complaint,
        description: `${this.clinicalStatusLabel(record.status)} · ${record.diagnosis_text || 'Sin diagnóstico registrado'}`,
        className: 'clinical',
        actionLabel: record.status === 'signed' ? 'Ver PDF' : undefined,
        actionType: record.status === 'signed' ? 'clinicalPdf' : undefined,
        payload: record
      });
    });

    this.patientHistory.clinicalRecordNotes.forEach((note) => {
      items.push({
        id: `clinical-note-${note.id}`,
        date: note.created_at,
        label: 'Nota aclaratoria',
        title: note.reason || 'Aclaración de historia clínica',
        description: `${note.clinical_record_chief_complaint || 'Historia clínica'} · ${note.note_text}`,
        className: 'clarification'
      });
    });

    this.patientHistory.treatmentPlans.forEach((plan) => {
      items.push({
        id: `plan-${plan.id}`,
        date: plan.updated_at || plan.created_at,
        label: 'Plan',
        title: plan.title,
        description: `${this.treatmentPlanStatusLabel(plan.status)} · Saldo: ${this.financialValue(plan.balance_amount)}`,
        className: 'treatment'
      });
    });

    this.patientHistory.prescriptions.forEach((prescription) => {
      items.push({
        id: `prescription-${prescription.id}`,
        date: prescription.prescription_date || prescription.created_at,
        label: 'Receta',
        title: prescription.diagnosis || 'Receta odontológica',
        description: `${this.prescriptionStatusLabel(prescription.status)} · ${prescription.issued_by_name || 'Odontólogo responsable'}`,
        className: 'prescription',
        actionLabel: prescription.pdf_path ? 'Ver PDF' : undefined,
        actionType: prescription.pdf_path ? 'prescriptionPdf' : undefined,
        payload: prescription.pdf_path
      });
    });

    this.patientHistory.clinicalDocuments.forEach((documentRow) => {
      items.push({
        id: `document-${documentRow.id}`,
        date: documentRow.document_date || documentRow.created_at,
        label: 'Documento',
        title: documentRow.title,
        description: `${this.clinicalDocumentTypeLabel(documentRow.document_type)} · ${this.clinicalDocumentStatusLabel(documentRow.status)}`,
        className: 'document',
        actionLabel: documentRow.pdf_path ? 'Ver PDF' : undefined,
        actionType: documentRow.pdf_path ? 'clinicalDocumentPdf' : undefined,
        payload: documentRow.pdf_path
      });
    });

    this.patientHistory.consents.forEach((consent) => {
      items.push({
        id: `consent-${consent.id}`,
        date: consent.signed_at || consent.created_at,
        label: 'Consentimiento',
        title: consent.template_title,
        description: `${this.consentStatusLabel(consent.status)} · ${consent.procedure_name || 'Procedimiento odontológico'}`,
        className: 'consent',
        actionLabel: consent.pdf_path ? 'Ver PDF' : undefined,
        actionType: consent.pdf_path ? 'consentPdf' : undefined,
        payload: consent.pdf_path
      });
    });

    this.patientHistory.attachments.forEach((attachment) => {
      items.push({
        id: `attachment-${attachment.id}`,
        date: attachment.document_date || attachment.created_at,
        label: 'Adjunto',
        title: attachment.title,
        description: `${this.attachmentCategoryLabel(attachment.category)} · ${attachment.description || attachment.original_name || 'Archivo adjunto'}`,
        className: 'attachment',
        actionLabel: 'Ver',
        actionType: 'attachment',
        payload: attachment
      });
    });

    this.patientHistory.periodontograms.forEach((chart) => {
      items.push({
        id: `periodontogram-${chart.id}`,
        date: chart.chart_date || chart.created_at,
        label: 'Periodontograma',
        title: `Periodontograma ${this.dentitionLabel(chart.dentition)}`,
        description: `${chart.measurement_count} mediciones · ${chart.notes || 'Sin notas adicionales'}`,
        className: 'periodontogram',
        actionLabel: 'Ver PDF',
        actionType: 'periodontogramPdf',
        payload: chart
      });
    });

    if (this.patientHistory.odontogram?.history?.length) {
      const latest = [...this.patientHistory.odontogram.history].sort((a, b) => this.timelineSortValue(b.record_date || b.created_at) - this.timelineSortValue(a.record_date || a.created_at))[0];
      items.push({
        id: 'odontogram-current',
        date: latest?.record_date || latest?.created_at || this.todayString(),
        label: 'Odontograma',
        title: 'Odontograma actualizado',
        description: `${this.patientHistory.odontogram.history.length} registro(s) clínicos por diente/superficie.`,
        className: 'odontogram',
        actionLabel: 'Ver PDF',
        actionType: 'odontogramPdf'
      });
    }

    this.patientHistory.payments.forEach((payment) => {
      items.push({
        id: `payment-${payment.id}`,
        date: payment.payment_date || payment.created_at,
        label: 'Pago',
        title: payment.concept,
        description: `${this.paymentStatusLabel(payment.status)} · ${this.financialValue(payment.amount)} · ${this.paymentMethodLabel(payment.payment_method)}`,
        className: 'payment'
      });
    });

    return items.sort((a, b) => this.timelineSortValue(b.date) - this.timelineSortValue(a.date));
  }

  openPatientTimelineItem(item: PatientTimelineItem): void {
    if (!item.actionType) return;
    if (item.actionType === 'clinicalPdf') void this.openClinicalRecordPdf(item.payload as OdontologyClinicalRecordDto);
    if (item.actionType === 'prescriptionPdf') this.openPrescriptionPdf(item.payload as string);
    if (item.actionType === 'clinicalDocumentPdf') this.openClinicalDocumentPdf(item.payload as string);
    if (item.actionType === 'consentPdf') this.openConsentPdf(item.payload as string);
    if (item.actionType === 'attachment') this.openAttachment(item.payload as OdontologyAttachmentDto);
    if (item.actionType === 'periodontogramPdf') void this.openPeriodontogramPdf(item.payload as OdontologyPeriodontogramDto);
    if (item.actionType === 'odontogramPdf') void this.openOdontogramPdf();
  }

  async startAppointmentFromPatient(patient: OdontologyPatientDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageAppointments) return;
    this.selectedTab = 'agenda';
    this.appointmentMode = 'form';
    this.editingAppointmentId = null;
    this.appointmentFormIntent = 'create';
    this.appointmentSearchTerm = '';
    this.appointmentStatusFilter = '';
    this.appointmentDentistFilter = '';
    this.appointmentSiteFilter = '';
    this.appointmentChairFilter = '';
    this.appointmentDateFilter = this.appointmentDateFilter || this.todayString();
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadAgendaData();
    this.appointmentForm = {
      ...this.emptyAppointmentForm(),
      patientId: patient.id,
      scheduledDate: this.appointmentDateFilter || this.todayString()
    };
    this.appointmentMode = 'form';
    this.refreshViewSoon();
    this.scrollToSelector('.appointment-form');
  }

  async startAppointmentFromTreatmentPlan(
    plan: OdontologyTreatmentPlanDto,
    item: OdontologyTreatmentPlanItemDto | null = null
  ): Promise<void> {
    if (!this.selectedClientId || !this.canScheduleTreatmentPlan(plan)) return;
    this.selectedTab = 'agenda';
    this.appointmentMode = 'form';
    this.editingAppointmentId = null;
    this.appointmentFormIntent = 'create';
    this.appointmentSearchTerm = '';
    this.appointmentStatusFilter = '';
    this.appointmentDentistFilter = '';
    this.appointmentSiteFilter = '';
    this.appointmentChairFilter = '';
    this.appointmentDateFilter = this.appointmentDateFilter || this.todayString();
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadAgendaData();
    const selectedItem = item || (plan.items || []).find((current) => current.status !== 'cancelled') || null;
    this.appointmentForm = {
      ...this.emptyAppointmentForm(),
      patientId: plan.patient_id,
      treatmentPlanId: plan.id,
      treatmentPlanItemId: selectedItem?.id || '',
      procedureTypeId: selectedItem?.procedure_type_id || '',
      scheduledDate: this.appointmentDateFilter || this.todayString(),
      notes: [
        `Plan: ${plan.title}`,
        selectedItem ? `Procedimiento plan: ${selectedItem.procedure_name}${selectedItem.tooth_number ? ` · Diente/zona ${selectedItem.tooth_number}` : ''}` : ''
      ].filter(Boolean).join('\n')
    };
    if (selectedItem?.procedure_type_id) {
      const procedure = this.activeProcedures.find((current) => current.id === selectedItem.procedure_type_id);
      if (procedure) this.appointmentForm.durationMinutes = procedure.default_duration_minutes;
    }
    this.appointmentMode = 'form';
    this.successMessage = 'Plan aceptado cargado en agenda. Completa odontólogo, fecha y hora para crear la cita.';
    this.refreshViewSoon();
    this.scrollToSelector('.appointment-form');
  }

  async startClinicalRecordFromPatient(patient: OdontologyPatientDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageClinicalRecords) return;
    this.selectedTab = 'clinical';
    this.selectedClinicalSubTab = 'records';
    this.clinicalMode = 'form';
    this.editingClinicalRecordId = null;
    this.clinicalPatientFilter = patient.id;
    this.clinicalStatusFilter = '';
    this.clinicalSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadClinicalData();
    this.clinicalForm = {
      ...this.emptyClinicalForm(),
      patientId: patient.id,
      chiefComplaint: 'Consulta odontológica',
      medicalHistory: [patient.medical_conditions, patient.important_observation].filter(Boolean).join('\n'),
      currentMedications: patient.current_medications ?? '',
      allergies: patient.allergies ?? ''
    };
    this.clinicalMode = 'form';
    this.refreshViewSoon();
    this.scrollToSelector('.clinical-form');
  }

  async startTreatmentPlanFromPatient(patient: OdontologyPatientDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageTreatmentPlans) return;
    this.selectedTab = 'treatments';
    this.treatmentMode = 'form';
    this.editingTreatmentPlanId = null;
    this.treatmentPatientFilter = patient.id;
    this.treatmentStatusFilter = '';
    this.treatmentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadTreatmentPlanData();
    this.treatmentForm = {
      ...this.emptyTreatmentPlanForm(),
      patientId: patient.id,
      title: `Plan de tratamiento - ${patient.full_name}`,
      notes: patient.important_observation ?? ''
    };
    this.treatmentMode = 'form';
    this.refreshViewSoon();
    this.scrollToSelector('.treatment-form');
  }

  async startPrescriptionFromPatient(patient: OdontologyPatientDto): Promise<void> {
    if (!this.selectedClientId || !this.canManagePrescriptions) return;
    this.selectedTab = 'prescriptions';
    this.prescriptionMode = 'form';
    this.prescriptionPatientFilter = patient.id;
    this.prescriptionStatusFilter = '';
    this.prescriptionSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadPrescriptionData();
    this.prescriptionForm = {
      ...this.emptyPrescriptionForm(),
      patientId: patient.id,
      generalInstructions: patient.allergies ? `Alergias registradas: ${patient.allergies}` : ''
    };
    this.prescriptionMode = 'form';
    this.refreshViewSoon();
    this.scrollToSelector('.prescription-form');
  }

  async startClinicalDocumentFromPatient(patient: OdontologyPatientDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageClinicalDocuments) return;
    this.selectedTab = 'documents';
    this.clinicalDocumentMode = 'form';
    this.clinicalDocumentPatientFilter = patient.id;
    this.clinicalDocumentTypeFilter = '';
    this.clinicalDocumentStatusFilter = '';
    this.clinicalDocumentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadClinicalDocumentData();
    this.clinicalDocumentForm = {
      ...this.emptyClinicalDocumentForm(),
      patientId: patient.id,
      title: 'Certificado odontológico',
      body: `Se certifica que el paciente ${patient.full_name}, identificado(a) con ${this.documentTypeLabel(patient.document_type)} ${patient.document_number}, fue atendido(a) en consulta odontológica.`,
      recommendations: patient.important_observation ?? ''
    };
    this.clinicalDocumentMode = 'form';
    this.refreshViewSoon();
    this.scrollToSelector('.clinical-document-form');
  }

  async startConsentFromPatient(patient: OdontologyPatientDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageConsents) return;
    this.cancelSignPatientConsent();
    this.selectedTab = 'consents';
    this.selectedConsentSubTab = 'consents';
    this.consentMode = 'form';
    this.consentPatientFilter = patient.id;
    this.consentStatusFilter = '';
    this.consentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadConsentData();
    const template = this.preferredGeneralConsentTemplate();
    if (!template) {
      this.consentMode = 'list';
      this.errorMessage = 'No hay plantillas activas de consentimiento. Crea una plantilla antes de generar el consentimiento.';
      this.refreshViewSoon();
      return;
    }
    this.patientConsentForm = {
      ...this.emptyPatientConsentForm(),
      patientId: patient.id,
      templateId: template.id
    };
    this.onConsentPatientChange();
    this.consentMode = 'form';
    this.refreshViewSoon();
    this.scrollToSelector('.consent-form');
  }

  async startDataProcessingConsentFromPatient(patient: OdontologyPatientDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageConsents) return;
    this.cancelSignPatientConsent();
    this.selectedTab = 'consents';
    this.selectedConsentSubTab = 'consents';
    this.consentMode = 'form';
    this.consentPatientFilter = patient.id;
    this.consentStatusFilter = '';
    this.consentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadConsentData();
    this.prepareDataProcessingConsentForm(patient.id);
  }

  async startConsentFromAppointment(appointment: OdontologyAppointmentDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageConsents) return;
    this.cancelSignPatientConsent();
    this.selectedTab = 'consents';
    this.selectedConsentSubTab = 'consents';
    this.consentMode = 'form';
    this.consentPatientFilter = appointment.patient_id;
    this.consentStatusFilter = '';
    this.consentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadConsentData();
    const template = this.preferredConsentTemplateForProcedure(appointment.procedure_type_id);
    if (!template) {
      this.consentMode = 'list';
      this.errorMessage = 'No hay plantillas activas para generar el consentimiento de esta cita.';
      this.refreshViewSoon();
      return;
    }
    this.patientConsentForm = {
      ...this.emptyPatientConsentForm(),
      patientId: appointment.patient_id,
      appointmentId: appointment.id,
      templateId: template.id
    };
    this.onConsentPatientChange();
    this.consentMode = 'form';
    this.refreshViewSoon();
    this.scrollToSelector('.consent-form');
  }

  async startAttachmentFromPatient(patient: OdontologyPatientDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageAttachments) return;
    this.selectedTab = 'attachments';
    this.attachmentMode = 'form';
    this.attachmentPatientFilter = patient.id;
    this.attachmentCategoryFilter = '';
    this.attachmentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadAttachmentData();
    this.attachmentForm = {
      ...this.emptyAttachmentForm(),
      patientId: patient.id,
      title: `Soporte clínico - ${patient.full_name}`
    };
    this.attachmentFile = null;
    this.attachmentMode = 'form';
    this.refreshViewSoon();
    this.scrollToSelector('.attachment-form');
  }

  async savePatient(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validatePatientForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }

    this.patientSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = this.patientPayload();
      if (this.editingPatientId) {
        await this.odontology.updatePatient(this.selectedClientId, this.editingPatientId, payload);
        this.successMessage = 'Paciente actualizado correctamente.';
      } else {
        await this.odontology.createPatient(this.selectedClientId, payload);
        this.successMessage = 'Paciente creado correctamente.';
      }
      this.patientMode = 'list';
      this.editingPatientId = null;
      this.patientForm = this.emptyPatientForm();
      await Promise.all([this.loadPatients(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el paciente.';
    } finally {
      this.patientSaving = false;
      this.refreshViewSoon();
    }
  }

  documentTypeLabel(value: string): string {
    return this.documentTypes.find((item) => item.value === value)?.label ?? value;
  }

  patientTypeLabel(value: string): string {
    return this.patientTypes.find((item) => item.value === value)?.label ?? value;
  }

  hasClinicalAlert(patient: OdontologyPatientDto): boolean {
    return Boolean(
      patient.allergies ||
        patient.medical_conditions ||
        patient.current_medications ||
        patient.pregnancy ||
        patient.bleeding_risk ||
        patient.diabetes ||
        patient.hypertension ||
        patient.pacemaker ||
        patient.important_observation
    );
  }

  async downloadPatientImportTemplate(): Promise<void> {
    if (!this.selectedClientId) {
      this.setPatientImportMessage('Selecciona primero un cliente para descargar la plantilla.', 'error');
      return;
    }

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'INBIHOSPITALARIO';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Pacientes', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });
    const catalogSheet = workbook.addWorksheet('Catalogos');
    const guideSheet = workbook.addWorksheet('Instrucciones');
    const templateHeaders = this.patientImportTemplateHeaders();
    const header = (name: string) => this.patientImportDisplayHeader(name);

    worksheet.columns = templateHeaders.map((currentHeader) => ({
      header: currentHeader,
      key: currentHeader,
      width: Math.min(Math.max(currentHeader.length + 4, 16), 30)
    }));
    worksheet.getRow(1).height = 28;
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA64045' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    worksheet.addRow({
      [header('Tipo documento')]: 'Cédula ciudadanía',
      [header('Número documento')]: '123456789',
      [header('Nombre completo')]: 'Paciente de ejemplo',
      [header('Fecha nacimiento')]: '1990-01-15',
      [header('Sexo')]: 'Femenino',
      [header('Teléfono')]: '3000000000',
      [header('Correo')]: 'paciente@correo.com',
      [header('Dirección')]: 'Dirección de ejemplo',
      [header('Contacto emergencia')]: 'Contacto de ejemplo',
      [header('Teléfono emergencia')]: '3000000001',
      [header('Tipo paciente')]: 'Particular',
      [header('EPS / convenio')]: '',
      [header('Requiere autorización')]: 'No',
      [header('Estado')]: this.patientStatusOptions[0] || 'Activo',
      [header('Embarazo')]: 'No',
      [header('Riesgo sangrado')]: 'No',
      [header('Diabetes')]: 'No',
      [header('Hipertensión')]: 'No',
      [header('Marcapasos')]: 'No'
    });
    worksheet.autoFilter = { from: 'A1', to: 'AB1' };

    const catalogRows = Math.max(
      this.documentTypes.length,
      this.sexOptions.length,
      this.patientTypes.length,
      this.patientStatusOptions.length,
      2
    );
    catalogSheet.columns = [
      { header: 'Tipos documento', key: 'documents', width: 26 },
      { header: 'Sexo', key: 'sex', width: 18 },
      { header: 'Tipo paciente', key: 'patientTypes', width: 18 },
      { header: 'Estados', key: 'statuses', width: 24 },
      { header: 'Sí/No', key: 'yesNo', width: 12 }
    ];
    for (let index = 0; index < catalogRows; index += 1) {
      catalogSheet.addRow({
        documents: this.documentTypes[index]?.label ?? '',
        sex: this.sexOptions[index]?.label ?? '',
        patientTypes: this.patientTypes[index]?.label ?? '',
        statuses: this.patientStatusOptions[index] ?? '',
        yesNo: ['Sí', 'No'][index] ?? ''
      });
    }
    catalogSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5F1F25' } };
    });

    guideSheet.columns = [{ width: 34 }, { width: 92 }];
    guideSheet.addRows([
      ['Cómo usar la plantilla', 'Llena una fila por paciente. Los campos con * son obligatorios.'],
      ['Fechas', 'Usa formato yyyy-mm-dd o selecciona una fecha desde Excel.'],
      ['Menores de edad', 'Si el paciente es menor de 18 años, diligencia nombre, teléfono y parentesco del acudiente.'],
      ['Listas', 'Usa las listas desplegables para documento, sexo, tipo de paciente, estado y campos Sí/No.'],
      ['Validación final', 'El software validará duplicados y datos obligatorios antes de guardar.']
    ]);
    guideSheet.getRow(1).font = { bold: true, color: { argb: 'FFA64045' } };

    const addListValidation = (columnNumber: number, formula: string, prompt: string): void => {
      for (let rowNumber = 2; rowNumber <= this.maxPatientImportRows + 1; rowNumber += 1) {
        worksheet.getCell(rowNumber, columnNumber).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Valor no permitido',
          error: 'Selecciona un valor de la lista desplegable.',
          showInputMessage: true,
          promptTitle: 'Selecciona de la lista',
          prompt
        };
      }
    };
    const listFormula = (columnLetter: string, count: number): string => {
      const endRow = Math.max(count + 1, 2);
      return `Catalogos!$${columnLetter}$2:$${columnLetter}$${endRow}`;
    };
    addListValidation(1, listFormula('A', this.documentTypes.length), 'Tipo de documento del paciente.');
    addListValidation(5, listFormula('B', this.sexOptions.length), 'Sexo registrado para el paciente.');
    addListValidation(11, listFormula('C', this.patientTypes.length), 'Tipo administrativo del paciente.');
    addListValidation(13, listFormula('E', 2), 'Indica si requiere autorización.');
    addListValidation(14, listFormula('D', this.patientStatusOptions.length), 'Estado inicial del paciente.');
    addListValidation(16, listFormula('A', this.documentTypes.length), 'Tipo de documento del acudiente.');
    [23, 24, 25, 26, 27].forEach((column) => addListValidation(column, listFormula('E', 2), 'Selecciona Sí o No.'));

    worksheet.getColumn(4).numFmt = 'yyyy-mm-dd';
    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadBlob(
      new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'plantilla-pacientes-odontologia.xlsx'
    );
  }

  private patientImportTemplateHeaders(): string[] {
    return this.patientImportHeaders.map((header) => this.patientImportDisplayHeader(header));
  }

  private patientImportDisplayHeader(header: string): string {
    const cleanHeader = header.replace(/\*+$/, '');
    const field = this.patientImportHeaderFieldMap[cleanHeader];
    return field && this.patientFieldRequired(field) ? `${cleanHeader}*` : cleanHeader;
  }

  async onPatientImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    this.patientImportPreviewRows = [];
    this.patientImportOriginalHeaders = [];
    this.patientImportFileName = file?.name ?? '';
    this.setPatientImportMessage('', 'info');
    if (!file) return;

    if (!this.selectedClientId) {
      this.setPatientImportMessage('Selecciona primero un cliente.', 'error');
      input.value = '';
      this.refreshViewSoon();
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['xlsx', 'xls', 'csv'].includes(extension)) {
      this.setPatientImportMessage('El archivo debe ser Excel (.xlsx, .xls) o CSV.', 'error');
      input.value = '';
      this.refreshViewSoon();
      return;
    }
    if (file.size > this.maxPatientImportFileSizeMb * 1024 * 1024) {
      this.setPatientImportMessage(`El archivo supera ${this.maxPatientImportFileSizeMb} MB. Divide la carga en archivos más pequeños.`, 'error');
      input.value = '';
      this.refreshViewSoon();
      return;
    }

    this.patientImportReading = true;
    this.setPatientImportMessage('Leyendo y validando pacientes...', 'info');
    this.refreshViewSoon();
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        this.setPatientImportMessage('El archivo no tiene hojas para leer.', 'error');
        return;
      }
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils
        .sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
        .filter((row) => this.importRowHasAnyValue(row));
      this.patientImportOriginalHeaders = rows.length ? Object.keys(rows[0]) : [...this.patientImportHeaders];
      if (rows.length > this.maxPatientImportRows) {
        this.setPatientImportMessage(`El archivo tiene ${rows.length} filas. Importa máximo ${this.maxPatientImportRows} pacientes por archivo.`, 'error');
        return;
      }
      this.patientImportPreviewRows = this.buildPatientImportPreview(rows);
      if (!rows.length) {
        this.setPatientImportMessage('El archivo no tiene filas para importar.', 'error');
      } else if (this.patientImportHasErrors) {
        this.setPatientImportMessage(
          `Archivo leído con ${this.patientImportErrorRowsCount} fila(s) con errores y ${this.patientImportValidRowsCount} lista(s).`,
          'error'
        );
      } else {
        this.setPatientImportMessage(`Archivo leído: ${this.patientImportValidRowsCount} paciente(s) listos para importar.`, 'success');
      }
    } catch (error) {
      console.error(error);
      this.setPatientImportMessage('No se pudo leer el archivo. Verifica que sea una plantilla válida.', 'error');
    } finally {
      this.patientImportReading = false;
      input.value = '';
      this.refreshViewSoon();
    }
  }

  async confirmPatientImport(): Promise<void> {
    if (!this.selectedClientId || this.patientImportHasErrors || !this.patientImportValidRowsCount) return;
    this.patientImportLoading = true;
    this.setPatientImportMessage('', 'info');
    this.refreshViewSoon();
    try {
      const validRows = this.patientImportPreviewRows.filter((row) => row.payload && !row.errors.length);
      const result = await this.odontology.importPatients(this.selectedClientId, validRows.map((row) => row.payload as OdontologyPatientPayload));
      this.setPatientImportMessage(`Importación completada: ${result.imported} paciente(s) creados.`, 'success');
      this.patientImportPreviewRows = [];
      this.patientImportFileName = '';
      if (this.canManagePatients) {
        await Promise.all([this.loadPatients(), this.reloadBootstrapOnly()]);
      } else {
        await this.reloadBootstrapOnly();
      }
    } catch (error: any) {
      console.error(error);
      this.setPatientImportMessage(error?.error?.message ?? 'No se pudo completar la importación de pacientes.', 'error');
    } finally {
      this.patientImportLoading = false;
      this.refreshViewSoon();
    }
  }

  clearPatientImport(): void {
    this.patientImportPreviewRows = [];
    this.patientImportOriginalHeaders = [];
    this.patientImportFileName = '';
    this.patientImportReading = false;
    this.setPatientImportMessage('', 'info');
    this.refreshViewSoon();
  }

  async downloadPatientImportErrors(): Promise<void> {
    const rows = this.patientImportPreviewRows.filter((row) => row.errors.length > 0);
    if (!rows.length) return;
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'INBIHOSPITALARIO';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Corregir pacientes', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });
    const headers = this.patientImportOriginalHeaders.length ? this.patientImportOriginalHeaders : this.patientImportHeaders;
    const allHeaders = [...headers, 'Errores encontrados'];
    worksheet.columns = allHeaders.map((header) => ({
      header,
      key: header,
      width: Math.min(Math.max(header.length + 4, 16), header === 'Errores encontrados' ? 48 : 28)
    }));
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA64045' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    rows.forEach((preview) => {
      const values: Record<string, unknown> = {};
      headers.forEach((header) => {
        values[header] = this.patientImportValue(preview.originalRow, header);
      });
      values['Errores encontrados'] = preview.errors.join(' | ');
      const excelRow = worksheet.addRow(values);
      excelRow.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const baseName = this.patientImportFileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
    this.downloadBlob(
      new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `corregir-importacion-${baseName || 'pacientes-odontologia'}.xlsx`
    );
  }

  async loadAgendaData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageAppointments) return;
    this.appointmentsLoading = true;
    this.appointmentRemindersLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const appointmentRange = this.appointmentQueryRange();
      const [patients, dentists, appointments, reminders, treatmentPlans] = await Promise.all([
        this.odontology.listPatients(this.selectedClientId),
        this.odontology.listDentists(this.selectedClientId),
        this.odontology.listAppointments(this.selectedClientId, {
          ...appointmentRange,
          status: this.appointmentStatusFilter,
          dentistId: this.appointmentDentistFilter,
          siteId: this.appointmentSiteFilter,
          chairId: this.appointmentChairFilter,
          search: this.appointmentSearchTerm
        }),
        this.odontology.listAppointmentReminders(this.selectedClientId, this.appointmentReminderQueryFilters()),
        this.canManageTreatmentPlans
          ? this.odontology.listTreatmentPlans(this.selectedClientId, {})
          : Promise.resolve([])
      ]);
      this.patients = patients;
      this.dentists = dentists;
      this.appointments = appointments;
      this.appointmentReminders = reminders;
      this.treatmentPlans = treatmentPlans;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar la agenda.';
    } finally {
      this.appointmentsLoading = false;
      this.appointmentRemindersLoading = false;
      this.refreshViewSoon();
    }
  }

  async loadAppointmentReminderHistory(): Promise<void> {
    if (!this.selectedClientId || !this.canManageAppointments) return;
    this.appointmentRemindersLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      this.appointmentReminders = await this.odontology.listAppointmentReminders(
        this.selectedClientId,
        this.appointmentReminderQueryFilters()
      );
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar el historial de recordatorios.';
    } finally {
      this.appointmentRemindersLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreateAppointment(): void {
    this.editingAppointmentId = null;
    this.appointmentFormIntent = 'create';
    this.appointmentForm = this.emptyAppointmentForm();
    if (this.appointmentDateFilter) {
      this.appointmentForm.scheduledDate = this.appointmentDateFilter;
    }
    this.appointmentMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  editAppointment(appointment: OdontologyAppointmentDto): void {
    this.editingAppointmentId = appointment.id;
    this.appointmentFormIntent = 'edit';
    this.appointmentForm = {
      patientId: appointment.patient_id,
      dentistUserId: appointment.dentist_user_id,
      procedureTypeId: appointment.procedure_type_id ?? '',
      treatmentPlanId: appointment.treatment_plan_id ?? '',
      treatmentPlanItemId: appointment.treatment_plan_item_id ?? '',
      siteId: appointment.site_id ?? '',
      chairId: appointment.chair_id ?? '',
      scheduledDate: this.dateOnly(appointment.scheduled_date),
      startTime: this.timeOnly(appointment.start_time),
      durationMinutes: appointment.duration_minutes,
      status: appointment.status,
      notes: appointment.notes ?? '',
      cancellationReason: appointment.cancellation_reason ?? ''
    };
    this.appointmentMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  startRescheduleAppointment(appointment: OdontologyAppointmentDto): void {
    this.editAppointment(appointment);
    this.appointmentFormIntent = 'reschedule';
    this.appointmentForm.status = this.configuredAppointmentStatus('Reprogramada') || appointment.status;
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
    this.scrollToSelector('.appointment-form');
  }

  cancelAppointmentForm(): void {
    this.appointmentMode = 'list';
    this.editingAppointmentId = null;
    this.appointmentFormIntent = 'create';
    this.appointmentForm = this.emptyAppointmentForm();
    this.refreshViewSoon();
  }

  onAppointmentPatientChange(): void {
    const stillValidPlan = this.selectedAppointmentPatientTreatmentPlans.some((plan) => plan.id === this.appointmentForm.treatmentPlanId);
    if (!stillValidPlan) {
      this.appointmentForm.treatmentPlanId = '';
      this.appointmentForm.treatmentPlanItemId = '';
    }
    this.refreshViewSoon();
  }

  onAppointmentTreatmentPlanChange(): void {
    this.appointmentForm.treatmentPlanItemId = '';
    const plan = this.selectedAppointmentTreatmentPlan;
    if (!plan) return;
    const firstActiveItem = (plan.items || []).find((item) => item.status !== 'cancelled');
    if (firstActiveItem?.id) {
      this.appointmentForm.treatmentPlanItemId = firstActiveItem.id;
      this.applyTreatmentPlanItemToAppointment(firstActiveItem);
    }
    const planNote = `Plan: ${plan.title}`;
    if (!this.appointmentForm.notes?.includes(planNote)) {
      this.appointmentForm.notes = [planNote, this.appointmentForm.notes].filter(Boolean).join('\n');
    }
    this.refreshViewSoon();
  }

  onAppointmentTreatmentPlanItemChange(): void {
    const item = this.selectedAppointmentPlanItems.find((current) => current.id === this.appointmentForm.treatmentPlanItemId);
    if (item) this.applyTreatmentPlanItemToAppointment(item);
    this.refreshViewSoon();
  }

  private applyTreatmentPlanItemToAppointment(item: OdontologyTreatmentPlanItemDto): void {
    this.appointmentForm.procedureTypeId = item.procedure_type_id || '';
    if (item.procedure_type_id) {
      const procedure = this.activeProcedures.find((current) => current.id === item.procedure_type_id);
      if (procedure) this.appointmentForm.durationMinutes = procedure.default_duration_minutes;
    }
    const itemNote = `Procedimiento plan: ${item.procedure_name}${item.tooth_number ? ` · Diente/zona ${item.tooth_number}` : ''}`;
    if (!this.appointmentForm.notes?.includes(itemNote)) {
      this.appointmentForm.notes = [itemNote, this.appointmentForm.notes].filter(Boolean).join('\n');
    }
  }

  onAppointmentProcedureChange(): void {
    const procedure = this.activeProcedures.find((item) => item.id === this.appointmentForm.procedureTypeId);
    if (procedure) {
      this.appointmentForm.durationMinutes = procedure.default_duration_minutes;
    }
  }

  onAppointmentSiteChange(): void {
    if (this.appointmentForm.chairId && !this.activeChairs.some((chair) => chair.id === this.appointmentForm.chairId)) {
      this.appointmentForm.chairId = '';
    }
  }

  onAppointmentFilterSiteChange(): void {
    if (this.appointmentChairFilter && !this.activeChairsForFilter.some((chair) => chair.id === this.appointmentChairFilter)) {
      this.appointmentChairFilter = '';
    }
    void this.loadAgendaData();
  }

  clearAppointmentFilters(): void {
    this.appointmentSearchTerm = '';
    this.appointmentStatusFilter = '';
    this.appointmentDentistFilter = '';
    this.appointmentSiteFilter = '';
    this.appointmentChairFilter = '';
    this.appointmentDateFilter = this.todayString();
    void this.loadAgendaData();
  }

  clearAppointmentReminderFilters(): void {
    this.appointmentReminderSearchTerm = '';
    this.appointmentReminderChannelFilter = '';
    this.appointmentReminderStatusFilter = '';
    this.appointmentReminderKindFilter = '';
    void this.loadAppointmentReminderHistory();
  }

  changeAppointmentDate(days: number): void {
    const base = this.parseDateInput(this.appointmentDateFilter) ?? new Date();
    base.setDate(base.getDate() + (this.appointmentViewMode === 'week' ? days * 7 : days));
    this.appointmentDateFilter = this.formatDateObject(base);
    void this.loadAgendaData();
  }

  goToTodayAppointments(): void {
    this.appointmentDateFilter = this.todayString();
    void this.loadAgendaData();
  }

  selectAppointmentViewMode(mode: 'day' | 'week'): void {
    this.appointmentViewMode = mode;
    void this.loadAgendaData();
    this.refreshViewSoon();
  }

  selectWeekDay(date: string): void {
    this.appointmentDateFilter = date;
    void this.loadAgendaData();
  }

  async changeAppointmentStatus(appointment: OdontologyAppointmentDto, status: string): Promise<void> {
    if (!this.selectedClientId || appointment.status === status || this.quickAppointmentStatusId) return;
    this.quickAppointmentStatusId = appointment.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.updateAppointment(
        this.selectedClientId,
        appointment.id,
        this.appointmentPayloadFromDto(appointment, status)
      );
      this.successMessage = `Cita actualizada a "${status}".`;
      await Promise.all([this.loadAgendaData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo actualizar el estado de la cita.';
    } finally {
      this.quickAppointmentStatusId = '';
      this.refreshViewSoon();
    }
  }

  async cancelAppointmentWithReason(appointment: OdontologyAppointmentDto): Promise<void> {
    const cancelledStatus = this.configuredAppointmentStatus('Cancelada');
    if (!this.selectedClientId || !cancelledStatus || appointment.status === cancelledStatus || this.quickAppointmentStatusId) return;
    const reason = prompt('Motivo de cancelación de la cita:');
    if (reason === null) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
      this.errorMessage = 'Para cancelar una cita debes registrar el motivo.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.quickAppointmentStatusId = appointment.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.updateAppointment(
        this.selectedClientId,
        appointment.id,
        {
          ...this.appointmentPayloadFromDto(appointment, cancelledStatus),
          cancellationReason: cleanReason
        }
      );
      this.successMessage = 'Cita cancelada correctamente.';
      await Promise.all([this.loadAgendaData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cancelar la cita.';
    } finally {
      this.quickAppointmentStatusId = '';
      this.refreshViewSoon();
    }
  }

  canSendAppointmentEmailReminder(appointment: OdontologyAppointmentDto): boolean {
    return Boolean(appointment.patient_email && appointment.patient_email.trim());
  }

  canSendAppointmentWhatsAppReminder(appointment: OdontologyAppointmentDto): boolean {
    const settings = this.bootstrap?.settings;
    return Boolean(
      settings?.enable_whatsapp_reminders &&
      settings.whatsapp_provider &&
      settings.whatsapp_business_phone &&
      appointment.patient_phone &&
      appointment.patient_phone.trim()
    );
  }

  reminderKindLabel(value: string | null | undefined): string {
    const kind = String(value || 'manual');
    const labels: Record<string, string> = {
      manual: 'Manual',
      day_before: 'Día anterior',
      same_day: 'Mismo día'
    };
    return labels[kind] || kind;
  }

  async sendAppointmentEmailReminder(appointment: OdontologyAppointmentDto): Promise<void> {
    if (!this.selectedClientId || this.appointmentReminderSendingId) return;
    if (!this.canSendAppointmentEmailReminder(appointment)) {
      this.errorMessage = 'El paciente no tiene correo registrado para enviar el recordatorio.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.appointmentReminderSendingId = appointment.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.sendAppointmentEmailReminder(this.selectedClientId, appointment.id);
      this.successMessage = `Recordatorio enviado a ${appointment.patient_email}.`;
      await this.loadAppointmentReminderHistory();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo enviar el recordatorio de la cita.';
    } finally {
      this.appointmentReminderSendingId = '';
      this.refreshViewSoon();
    }
  }

  async sendAppointmentWhatsAppReminder(appointment: OdontologyAppointmentDto): Promise<void> {
    if (!this.selectedClientId || this.appointmentWhatsappReminderSendingId) return;
    if (!this.canSendAppointmentWhatsAppReminder(appointment)) {
      this.errorMessage = 'WhatsApp no está preparado o el paciente no tiene teléfono registrado.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.appointmentWhatsappReminderSendingId = appointment.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.sendAppointmentWhatsAppReminder(this.selectedClientId, appointment.id);
      this.successMessage = `Recordatorio WhatsApp preparado para ${appointment.patient_phone}.`;
      await this.loadAppointmentReminderHistory();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo preparar el recordatorio por WhatsApp.';
    } finally {
      this.appointmentWhatsappReminderSendingId = '';
      this.refreshViewSoon();
    }
  }

  async saveAppointment(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateAppointmentForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }

    this.appointmentSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = this.appointmentPayload();
      if (this.editingAppointmentId) {
        await this.odontology.updateAppointment(this.selectedClientId, this.editingAppointmentId, payload);
        this.successMessage = this.appointmentFormIntent === 'reschedule'
          ? 'Cita reprogramada correctamente.'
          : 'Cita actualizada correctamente.';
      } else {
        await this.odontology.createAppointment(this.selectedClientId, payload);
        this.successMessage = 'Cita creada correctamente.';
      }
      this.appointmentMode = 'list';
      this.editingAppointmentId = null;
      this.appointmentFormIntent = 'create';
      this.appointmentForm = this.emptyAppointmentForm();
      await Promise.all([this.loadAgendaData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar la cita.';
    } finally {
      this.appointmentSaving = false;
      this.refreshViewSoon();
    }
  }

  appointmentStatusClass(status: string): string {
    return this.normalizeStatusKey(status);
  }

  canRescheduleAppointment(appointment: OdontologyAppointmentDto): boolean {
    const normalized = this.normalizeStatusKey(appointment.status);
    return !['atendida', 'cancelada', 'no-asistio'].includes(normalized);
  }

  canCancelAppointment(appointment: OdontologyAppointmentDto): boolean {
    const normalized = this.normalizeStatusKey(appointment.status);
    return !['atendida', 'cancelada', 'no-asistio'].includes(normalized) && Boolean(this.configuredAppointmentStatus('Cancelada'));
  }

  async startClinicalRecordFromAppointment(appointment: OdontologyAppointmentDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageClinicalRecords) return;
    this.selectedTab = 'clinical';
    this.selectedClinicalSubTab = 'records';
    this.clinicalMode = 'form';
    this.editingClinicalRecordId = null;
    this.clinicalPatientFilter = appointment.patient_id;
    this.clinicalStatusFilter = '';
    this.clinicalSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadClinicalData();
    this.clinicalForm = {
      ...this.emptyClinicalForm(),
      patientId: appointment.patient_id,
      appointmentId: appointment.id,
      chiefComplaint: appointment.notes?.trim() || appointment.procedure_name || 'Atención odontológica'
    };
    this.clinicalMode = 'form';
    this.refreshViewSoon();
    setTimeout(() => {
      document.querySelector('.clinical-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async loadClinicalData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageClinicalRecords) return;
    this.clinicalLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [patients, appointments, clinicalRecords] = await Promise.all([
        this.odontology.listPatients(this.selectedClientId),
        this.odontology.listAppointments(this.selectedClientId, {}),
        this.odontology.listClinicalRecords(this.selectedClientId, {
          patientId: this.clinicalPatientFilter,
          status: this.clinicalStatusFilter,
          search: this.clinicalSearchTerm
        })
      ]);
      this.patients = patients;
      this.appointments = appointments;
      this.clinicalRecords = clinicalRecords;
      if (!this.odontogramPatientId && patients.length) {
        this.odontogramPatientId = this.clinicalPatientFilter || patients[0].id;
      }
      if (this.selectedClinicalSubTab === 'odontogram' && this.odontogramPatientId) {
        await this.loadOdontogram();
      }
      if (this.selectedClinicalSubTab === 'periodontogram' && this.canManagePeriodontogram) {
        await this.loadPeriodontogramData();
      }
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar las historias clínicas.';
    } finally {
      this.clinicalLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreateClinicalRecord(): void {
    this.editingClinicalRecordId = null;
    this.clinicalForm = this.emptyClinicalForm();
    if (this.clinicalPatientFilter) {
      this.clinicalForm.patientId = this.clinicalPatientFilter;
      this.applyClinicalPatientAlerts();
    }
    this.clinicalMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  onClinicalPatientChange(): void {
    this.clinicalForm.appointmentId = '';
    this.applyClinicalPatientAlerts();
    this.refreshViewSoon();
  }

  private applyClinicalPatientAlerts(): void {
    const patient = this.clinicalFormPatient;
    if (!patient) return;
    if (!this.clinicalForm.medicalHistory?.trim()) {
      this.clinicalForm.medicalHistory = [patient.medical_conditions, patient.important_observation].filter(Boolean).join('\n');
    }
    if (!this.clinicalForm.currentMedications?.trim()) {
      this.clinicalForm.currentMedications = patient.current_medications ?? '';
    }
    if (!this.clinicalForm.allergies?.trim()) {
      this.clinicalForm.allergies = patient.allergies ?? '';
    }
  }

  editClinicalRecord(record: OdontologyClinicalRecordDto): void {
    if (record.status === 'signed') return;
    this.editingClinicalRecordId = record.id;
    this.clinicalForm = {
      patientId: record.patient_id,
      appointmentId: record.appointment_id ?? '',
      chiefComplaint: record.chief_complaint,
      currentIllness: record.current_illness ?? '',
      medicalHistory: record.medical_history ?? '',
      dentalHistory: record.dental_history ?? '',
      familyHistory: record.family_history ?? '',
      currentMedications: record.current_medications ?? '',
      allergies: record.allergies ?? '',
      habits: record.habits ?? '',
      extraoralExam: record.extraoral_exam ?? '',
      intraoralExam: record.intraoral_exam ?? '',
      diagnosisCode: record.diagnosis_code ?? '',
      diagnosisText: record.diagnosis_text ?? '',
      treatmentPlan: record.treatment_plan ?? '',
      clinicalNotes: record.clinical_notes ?? ''
    };
    this.clinicalMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelClinicalForm(): void {
    this.clinicalMode = 'list';
    this.editingClinicalRecordId = null;
    this.clinicalForm = this.emptyClinicalForm();
    this.refreshViewSoon();
  }

  async saveClinicalRecord(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateClinicalForm(false);
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.clinicalSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = this.clinicalPayload();
      if (this.editingClinicalRecordId) {
        await this.odontology.updateClinicalRecord(this.selectedClientId, this.editingClinicalRecordId, payload);
        this.successMessage = 'Historia clínica actualizada como borrador.';
      } else {
        await this.odontology.createClinicalRecord(this.selectedClientId, payload);
        this.successMessage = 'Historia clínica creada como borrador.';
      }
      this.clinicalMode = 'list';
      this.editingClinicalRecordId = null;
      this.clinicalForm = this.emptyClinicalForm();
      await Promise.all([this.loadClinicalData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar la historia clínica.';
    } finally {
      this.clinicalSaving = false;
      this.refreshViewSoon();
    }
  }

  startSignClinicalRecord(record: OdontologyClinicalRecordDto): void {
    if (record.status === 'signed') return;
    const patient = this.patients.find((item) => item.id === record.patient_id);
    const useGuardian = Boolean(patient?.guardian_name);
    this.selectedClinicalRecordToSign = record;
    this.clinicalPatientSignatureDataUrl = '';
    this.clinicalSignerForm = {
      name: useGuardian ? patient?.guardian_name || '' : record.patient_name || '',
      documentType: useGuardian
        ? patient?.guardian_document_type || 'cedula_ciudadania'
        : record.patient_document_type || 'cedula_ciudadania',
      documentNumber: useGuardian ? patient?.guardian_document_number || '' : record.patient_document_number || '',
      relationship: useGuardian ? patient?.guardian_relationship || 'Acudiente' : 'Paciente'
    };
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    this.scrollToSelector('.clinical-signature-panel');
  }

  cancelSignClinicalRecord(): void {
    this.selectedClinicalRecordToSign = null;
    this.clinicalPatientSignatureDataUrl = '';
    this.clinicalSignerForm = this.emptyClinicalSignerForm();
    this.clinicalSignatureDrawing = false;
    this.refreshViewSoon();
  }

  startClinicalSignatureDraw(event: PointerEvent): void {
    event.preventDefault();
    const canvas = event.currentTarget as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    this.clinicalSignatureDrawing = true;
    canvas.setPointerCapture?.(event.pointerId);
    context.strokeStyle = '#0f172a';
    context.lineWidth = 3.2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    const point = this.clinicalSignaturePoint(event, canvas);
    context.moveTo(point.x, point.y);
  }

  drawClinicalSignature(event: PointerEvent): void {
    if (!this.clinicalSignatureDrawing) return;
    event.preventDefault();
    const canvas = event.currentTarget as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    const point = this.clinicalSignaturePoint(event, canvas);
    context.lineTo(point.x, point.y);
    context.stroke();
    this.clinicalPatientSignatureDataUrl = canvas.toDataURL('image/png');
  }

  endClinicalSignatureDraw(event?: PointerEvent): void {
    if (event?.currentTarget && event.pointerId !== undefined) {
      const canvas = event.currentTarget as HTMLCanvasElement;
      canvas.releasePointerCapture?.(event.pointerId);
    }
    this.clinicalSignatureDrawing = false;
  }

  clearClinicalSignature(canvas?: HTMLCanvasElement | null): void {
    if (canvas) {
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.clinicalPatientSignatureDataUrl = '';
    this.clinicalSignatureDrawing = false;
    this.refreshViewSoon();
  }

  private clinicalSignaturePoint(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  async signClinicalRecord(): Promise<void> {
    if (!this.selectedClientId || !this.selectedClinicalRecordToSign) return;
    const required = [
      ['nombre del firmante', this.clinicalSignerForm.name],
      ['tipo de documento del firmante', this.clinicalSignerForm.documentType],
      ['número de documento del firmante', this.clinicalSignerForm.documentNumber],
      ['firma del paciente o acudiente', this.clinicalPatientSignatureDataUrl]
    ];
    const missing = required.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
    if (missing.length) {
      this.errorMessage = `Campos obligatorios: ${missing.join(', ')}.`;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    if (!confirm('¿Firmar esta historia clínica? Después de firmar no se podrá modificar.')) return;
    this.clinicalSigning = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const signed = await this.odontology.signClinicalRecord(this.selectedClientId, this.selectedClinicalRecordToSign.id, {
        patientSignatureDataUrl: this.clinicalPatientSignatureDataUrl,
        patientSignerName: this.clinicalSignerForm.name.trim(),
        patientSignerDocumentType: this.clinicalSignerForm.documentType,
        patientSignerDocumentNumber: this.clinicalSignerForm.documentNumber.trim(),
        patientSignerRelationship: this.clinicalSignerForm.relationship.trim() || null
      });
      this.successMessage = 'Historia clínica firmada, bloqueada y PDF generado correctamente.';
      this.cancelSignClinicalRecord();
      await Promise.all([this.loadClinicalData(), this.reloadBootstrapOnly()]);
      await this.openClinicalRecordPdf(signed);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo firmar la historia clínica.';
    } finally {
      this.clinicalSigning = false;
      this.refreshViewSoon();
    }
  }

  startClinicalRecordNote(record: OdontologyClinicalRecordDto): void {
    if (record.status !== 'signed') return;
    this.selectedClinicalNoteRecord = record;
    this.clinicalNoteForm = this.emptyClinicalNoteForm();
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
    this.scrollToSelector('.clinical-note-form');
  }

  cancelClinicalRecordNote(): void {
    this.selectedClinicalNoteRecord = null;
    this.clinicalNoteForm = this.emptyClinicalNoteForm();
    this.refreshViewSoon();
  }

  async saveClinicalRecordNote(): Promise<void> {
    if (!this.selectedClientId || !this.selectedClinicalNoteRecord) return;
    if (!String(this.clinicalNoteForm.noteText || '').trim()) {
      this.errorMessage = 'La nota aclaratoria es obligatoria.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.clinicalNoteSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.createClinicalRecordNote(
        this.selectedClientId,
        this.selectedClinicalNoteRecord.id,
        this.clinicalNoteForm
      );
      this.successMessage = 'Nota aclaratoria guardada correctamente.';
      this.cancelClinicalRecordNote();
      await this.loadClinicalData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar la nota aclaratoria.';
    } finally {
      this.clinicalNoteSaving = false;
      this.refreshViewSoon();
    }
  }

  clinicalStatusLabel(status: string): string {
    return status === 'signed' ? 'Firmada' : 'Borrador';
  }

  async openClinicalRecordPdf(record: OdontologyClinicalRecordDto): Promise<void> {
    if (record.pdf_path) {
      window.open(joinBase(this.publicBase, record.pdf_path), '_blank', 'noopener');
      return;
    }
    if (!this.selectedClientId) return;
    try {
      const blob = await this.odontology.getClinicalRecordPdf(this.selectedClientId, record.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      await this.loadClinicalData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF de la historia clínica.';
      this.refreshViewSoon();
    }
  }

  async openOdontogramPdf(patientId?: string | null): Promise<void> {
    const resolvedPatientId = patientId || this.odontogramPatientId || this.selectedHistoryPatient?.id;
    if (!this.selectedClientId || !resolvedPatientId) return;
    try {
      const blob = await this.odontology.getOdontogramPdf(this.selectedClientId, resolvedPatientId);
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF del odontograma.';
      this.refreshViewSoon();
    }
  }

  async openPeriodontogramPdf(chart: OdontologyPeriodontogramDto | null | undefined): Promise<void> {
    if (!this.selectedClientId || !chart?.id) return;
    try {
      const blob = await this.odontology.getPeriodontogramPdf(this.selectedClientId, chart.id);
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF del periodontograma.';
      this.refreshViewSoon();
    }
  }

  private openPdfBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async startTreatmentPlanFromClinicalRecord(record: OdontologyClinicalRecordDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageTreatmentPlans) return;
    this.selectedTab = 'treatments';
    this.treatmentMode = 'form';
    this.editingTreatmentPlanId = null;
    this.treatmentPatientFilter = record.patient_id;
    this.treatmentStatusFilter = '';
    this.treatmentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadTreatmentPlanData();
    this.treatmentForm = {
      ...this.emptyTreatmentPlanForm(),
      patientId: record.patient_id,
      clinicalRecordId: record.id,
      title: `Plan de tratamiento - ${record.patient_name}`,
      diagnosisText: record.diagnosis_text ?? '',
      objective: record.treatment_plan ?? '',
      notes: record.clinical_notes ?? ''
    };
    this.treatmentMode = 'form';
    this.refreshViewSoon();
    setTimeout(() => {
      document.querySelector('.treatment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async startPrescriptionFromClinicalRecord(record: OdontologyClinicalRecordDto): Promise<void> {
    if (!this.selectedClientId || !this.canManagePrescriptions) return;
    this.selectedTab = 'prescriptions';
    this.prescriptionMode = 'form';
    this.prescriptionPatientFilter = record.patient_id;
    this.prescriptionStatusFilter = '';
    this.prescriptionSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadPrescriptionData();
    this.prescriptionForm = {
      ...this.emptyPrescriptionForm(),
      patientId: record.patient_id,
      clinicalRecordId: record.id,
      appointmentId: record.appointment_id ?? '',
      diagnosis: record.diagnosis_text ?? record.chief_complaint ?? '',
      generalInstructions: record.clinical_notes ?? ''
    };
    this.prescriptionMode = 'form';
    this.refreshViewSoon();
    setTimeout(() => {
      document.querySelector('.prescription-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async startClinicalDocumentFromClinicalRecord(record: OdontologyClinicalRecordDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageClinicalDocuments) return;
    this.selectedTab = 'documents';
    this.clinicalDocumentMode = 'form';
    this.clinicalDocumentPatientFilter = record.patient_id;
    this.clinicalDocumentTypeFilter = '';
    this.clinicalDocumentStatusFilter = '';
    this.clinicalDocumentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadClinicalDocumentData();
    this.clinicalDocumentForm = {
      ...this.emptyClinicalDocumentForm(),
      patientId: record.patient_id,
      clinicalRecordId: record.id,
      appointmentId: record.appointment_id ?? '',
      title: 'Certificado odontológico',
      body: this.clinicalDocumentBodyFromRecord(record),
      recommendations: record.treatment_plan ?? record.clinical_notes ?? ''
    };
    this.clinicalDocumentMode = 'form';
    this.refreshViewSoon();
    setTimeout(() => {
      document.querySelector('.clinical-document-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async openOdontogramFromClinicalRecord(record: OdontologyClinicalRecordDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageOdontogram) return;
    this.selectedTab = 'clinical';
    this.selectedClinicalSubTab = 'odontogram';
    this.odontogramPatientId = record.patient_id;
    this.selectedToothNumber = '';
    this.odontogramConditionItemId = '';
    this.odontogramNotes = record.diagnosis_text ?? record.chief_complaint ?? '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadOdontogram();
    setTimeout(() => {
      document.querySelector('.odontogram-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async startPeriodontogramFromClinicalRecord(record: OdontologyClinicalRecordDto): Promise<void> {
    if (!this.selectedClientId || !this.canManagePeriodontogram) return;
    this.selectedTab = 'clinical';
    this.selectedClinicalSubTab = 'periodontogram';
    this.periodontogramMode = 'form';
    this.periodontogramPatientFilter = record.patient_id;
    this.periodontogramSearchTerm = '';
    this.periodontogramDetail = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadPeriodontogramData();
    this.periodontogramForm = {
      ...this.emptyPeriodontogramForm(),
      patientId: record.patient_id,
      clinicalRecordId: record.id,
      notes: [record.diagnosis_text, record.treatment_plan, record.clinical_notes].filter(Boolean).join('\n\n')
    };
    this.periodontogramMode = 'form';
    this.refreshViewSoon();
    setTimeout(() => {
      document.querySelector('.periodontogram-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async loadTreatmentPlanData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageTreatmentPlans) return;
    this.treatmentPlansLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [patients, clinicalRecords, treatmentPlans] = await Promise.all([
        this.odontology.listPatients(this.selectedClientId),
        this.odontology.listClinicalRecords(this.selectedClientId, {}),
        this.odontology.listTreatmentPlans(this.selectedClientId, {
          patientId: this.treatmentPatientFilter,
          status: this.treatmentStatusFilter,
          search: this.treatmentSearchTerm
        })
      ]);
      this.patients = patients;
      this.clinicalRecords = clinicalRecords;
      this.treatmentPlans = treatmentPlans;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar los planes de tratamiento.';
    } finally {
      this.treatmentPlansLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreateTreatmentPlan(): void {
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para crear planes con valores económicos.';
      this.refreshViewSoon();
      return;
    }
    this.editingTreatmentPlanId = null;
    this.treatmentForm = this.emptyTreatmentPlanForm();
    if (this.treatmentPatientFilter) {
      this.treatmentForm.patientId = this.treatmentPatientFilter;
      this.onTreatmentPatientChange();
    }
    this.treatmentMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  editTreatmentPlan(plan: OdontologyTreatmentPlanDto): void {
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para modificar valores económicos del plan.';
      this.refreshViewSoon();
      return;
    }
    if (plan.accepted_signature_path) {
      this.errorMessage = 'Este plan ya fue aceptado y no se puede modificar.';
      this.refreshViewSoon();
      return;
    }
    this.editingTreatmentPlanId = plan.id;
    this.treatmentForm = {
      patientId: plan.patient_id,
      clinicalRecordId: plan.clinical_record_id ?? '',
      title: plan.title,
      diagnosisText: plan.diagnosis_text ?? '',
      objective: plan.objective ?? '',
      notes: plan.notes ?? '',
      status: plan.status,
      items: (plan.items || []).map((item) => ({
        procedureTypeId: item.procedure_type_id ?? '',
        procedureName: item.procedure_name,
        toothNumber: item.tooth_number ?? '',
        description: item.description ?? '',
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unit_price || 0),
        estimatedSessions: Number(item.estimated_sessions || 1),
        status: item.status
      }))
    };
    if (!this.treatmentForm.items.length) this.addTreatmentItem();
    this.treatmentMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelTreatmentPlanForm(): void {
    this.treatmentMode = 'list';
    this.editingTreatmentPlanId = null;
    this.treatmentForm = this.emptyTreatmentPlanForm();
    this.refreshViewSoon();
  }

  startAcceptTreatmentPlan(plan: OdontologyTreatmentPlanDto): void {
    if (!this.canAcceptTreatmentPlan(plan)) return;
    const patient = this.patients.find((item) => item.id === plan.patient_id);
    const useGuardian = Boolean(patient?.guardian_name);
    this.selectedTreatmentPlanToAccept = plan;
    this.treatmentPlanSignatureDataUrl = '';
    this.treatmentPlanSignerForm = {
      name: useGuardian ? patient?.guardian_name || '' : plan.patient_name || '',
      documentType: useGuardian
        ? patient?.guardian_document_type || 'cedula_ciudadania'
        : patient?.document_type || 'cedula_ciudadania',
      documentNumber: useGuardian ? patient?.guardian_document_number || '' : plan.patient_document_number || '',
      relationship: useGuardian ? patient?.guardian_relationship || 'Acudiente' : 'Paciente'
    };
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    this.scrollToSelector('.treatment-acceptance-panel');
  }

  cancelAcceptTreatmentPlan(): void {
    this.selectedTreatmentPlanToAccept = null;
    this.treatmentPlanSignatureDataUrl = '';
    this.treatmentPlanSignerForm = this.emptyTreatmentPlanSignerForm();
    this.treatmentPlanSignatureDrawing = false;
    this.refreshViewSoon();
  }

  onTreatmentPatientChange(): void {
    const patient = this.patients.find((item) => item.id === this.treatmentForm.patientId);
    if (patient && !this.treatmentForm.title.trim()) {
      this.treatmentForm.title = `Plan de tratamiento - ${patient.full_name}`;
    }
  }

  addTreatmentItem(): void {
    this.treatmentForm.items.push(this.emptyTreatmentPlanItem());
    this.refreshViewSoon();
  }

  removeTreatmentItem(index: number): void {
    if (this.treatmentForm.items.length <= 1) return;
    this.treatmentForm.items.splice(index, 1);
    this.refreshViewSoon();
  }

  onTreatmentProcedureChange(item: OdontologyTreatmentPlanItemPayload): void {
    const procedure = this.activeProcedures.find((current) => current.id === item.procedureTypeId);
    if (!procedure) return;
    item.procedureName = procedure.name;
    item.unitPrice = Number(procedure.default_price || 0);
  }

  async saveTreatmentPlan(): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para guardar valores económicos del plan.';
      this.refreshViewSoon();
      return;
    }
    const validationMessage = this.validateTreatmentPlanForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.treatmentPlanSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = this.treatmentPlanPayload();
      if (this.editingTreatmentPlanId) {
        await this.odontology.updateTreatmentPlan(this.selectedClientId, this.editingTreatmentPlanId, payload);
        this.successMessage = 'Plan de tratamiento actualizado correctamente.';
      } else {
        await this.odontology.createTreatmentPlan(this.selectedClientId, payload);
        this.successMessage = 'Plan de tratamiento creado correctamente.';
      }
      this.cancelTreatmentPlanForm();
      await Promise.all([this.loadTreatmentPlanData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el plan de tratamiento.';
    } finally {
      this.treatmentPlanSaving = false;
      this.refreshViewSoon();
    }
  }

  startTreatmentPlanSignatureDraw(event: PointerEvent): void {
    event.preventDefault();
    const canvas = event.currentTarget as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    this.treatmentPlanSignatureDrawing = true;
    canvas.setPointerCapture?.(event.pointerId);
    context.strokeStyle = '#0f172a';
    context.lineWidth = 3.2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    const point = this.treatmentPlanSignaturePoint(event, canvas);
    context.moveTo(point.x, point.y);
  }

  drawTreatmentPlanSignature(event: PointerEvent): void {
    if (!this.treatmentPlanSignatureDrawing) return;
    event.preventDefault();
    const canvas = event.currentTarget as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    const point = this.treatmentPlanSignaturePoint(event, canvas);
    context.lineTo(point.x, point.y);
    context.stroke();
    this.treatmentPlanSignatureDataUrl = canvas.toDataURL('image/png');
  }

  endTreatmentPlanSignatureDraw(event?: PointerEvent): void {
    if (event?.currentTarget && event.pointerId !== undefined) {
      const canvas = event.currentTarget as HTMLCanvasElement;
      canvas.releasePointerCapture?.(event.pointerId);
    }
    this.treatmentPlanSignatureDrawing = false;
  }

  clearTreatmentPlanSignature(canvas?: HTMLCanvasElement | null): void {
    if (canvas) {
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.treatmentPlanSignatureDataUrl = '';
    this.treatmentPlanSignatureDrawing = false;
    this.refreshViewSoon();
  }

  private treatmentPlanSignaturePoint(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  async acceptTreatmentPlan(): Promise<void> {
    if (!this.selectedClientId || !this.selectedTreatmentPlanToAccept) return;
    const required = [
      ['nombre del firmante', this.treatmentPlanSignerForm.name],
      ['tipo de documento del firmante', this.treatmentPlanSignerForm.documentType],
      ['número de documento del firmante', this.treatmentPlanSignerForm.documentNumber],
      ['firma del paciente o acudiente', this.treatmentPlanSignatureDataUrl]
    ];
    const missing = required.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
    if (missing.length) {
      this.errorMessage = `Campos obligatorios: ${missing.join(', ')}.`;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    if (!confirm('¿Aceptar y firmar este plan de tratamiento? El plan quedará bloqueado para edición.')) return;
    this.treatmentPlanSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const accepted = await this.odontology.acceptTreatmentPlan(this.selectedClientId, this.selectedTreatmentPlanToAccept.id, {
        signatureDataUrl: this.treatmentPlanSignatureDataUrl,
        signerName: this.treatmentPlanSignerForm.name.trim(),
        signerDocumentType: this.treatmentPlanSignerForm.documentType,
        signerDocumentNumber: this.treatmentPlanSignerForm.documentNumber.trim(),
        signerRelationship: this.treatmentPlanSignerForm.relationship.trim() || null
      });
      this.successMessage = 'Plan de tratamiento aceptado y firmado correctamente.';
      this.cancelAcceptTreatmentPlan();
      await Promise.all([this.loadTreatmentPlanData(), this.reloadBootstrapOnly()]);
      await this.openTreatmentPlanPdf(accepted);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo aceptar el plan de tratamiento.';
    } finally {
      this.treatmentPlanSaving = false;
      this.refreshViewSoon();
    }
  }

  treatmentPlanStatusLabel(status: string): string {
    return this.treatmentPlanStatuses.find((item) => item.value === status)?.label ?? status;
  }

  treatmentItemStatusLabel(status: string): string {
    return this.treatmentItemStatuses.find((item) => item.value === status)?.label ?? status;
  }

  treatmentPlanStatusClass(status: string): string {
    return String(status || 'draft').replace(/_/g, '-');
  }

  treatmentFinancialStatus(plan: OdontologyTreatmentPlanDto): 'no-value' | 'unpaid' | 'partial' | 'paid' {
    const total = Number(plan.total_amount || 0);
    const paid = Number(plan.paid_amount || 0);
    const balance = Math.max(0, Number(plan.balance_amount ?? (total - paid)));
    if (!total) return 'no-value';
    if (balance <= 0) return 'paid';
    if (paid > 0) return 'partial';
    return 'unpaid';
  }

  treatmentFinancialStatusLabel(plan: OdontologyTreatmentPlanDto): string {
    const labels: Record<string, string> = {
      'no-value': 'Sin valor',
      unpaid: 'Sin abonos',
      partial: 'Abono parcial',
      paid: 'Pagado'
    };
    return labels[this.treatmentFinancialStatus(plan)];
  }

  treatmentFinancialStatusClass(plan: OdontologyTreatmentPlanDto): string {
    return `financial-${this.treatmentFinancialStatus(plan)}`;
  }

  treatmentPaymentProgress(plan: OdontologyTreatmentPlanDto): number {
    const total = Number(plan.total_amount || 0);
    const paid = Number(plan.paid_amount || 0);
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
  }

  async openTreatmentPlanPdf(plan: OdontologyTreatmentPlanDto): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para ver valores económicos del plan.';
      this.refreshViewSoon();
      return;
    }
    try {
      const blob = await this.odontology.getTreatmentPlanPdf(this.selectedClientId, plan.id);
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF del plan de tratamiento.';
      this.refreshViewSoon();
    }
  }

  async startPaymentFromTreatmentPlan(plan: OdontologyTreatmentPlanDto): Promise<void> {
    if (!this.selectedClientId || !this.canManagePayments) return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para registrar valores económicos.';
      this.refreshViewSoon();
      return;
    }
    this.selectedTab = 'payments';
    this.paymentMode = 'form';
    this.paymentPatientFilter = plan.patient_id;
    this.paymentPlanFilter = plan.id;
    this.paymentStatusFilter = '';
    this.paymentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadPaymentData();
    const balance = Number(plan.balance_amount ?? plan.total_amount ?? 0);
    this.paymentForm = {
      ...this.emptyPaymentForm(),
      patientId: plan.patient_id,
      treatmentPlanId: plan.id,
      concept: `Abono ${plan.title}`,
      amount: balance > 0 ? balance : Number(plan.total_amount || 0),
      notes: `Pago asociado al plan de tratamiento ${plan.title}.`
    };
    this.paymentMode = 'form';
    this.refreshViewSoon();
    setTimeout(() => {
      document.querySelector('.payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async startConsentFromTreatmentPlan(plan: OdontologyTreatmentPlanDto): Promise<void> {
    if (!this.selectedClientId || !this.canManageConsents) return;
    this.cancelSignPatientConsent();
    this.selectedTab = 'consents';
    this.selectedConsentSubTab = 'consents';
    this.consentMode = 'form';
    this.consentPatientFilter = plan.patient_id;
    this.consentStatusFilter = '';
    this.consentSearchTerm = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    await this.loadConsentData();
    const template = this.preferredConsentTemplateForPlan(plan);
    if (!template) {
      this.consentMode = 'list';
      this.errorMessage = 'No hay plantillas activas de consentimiento. Crea una plantilla antes de generar el consentimiento.';
      this.refreshViewSoon();
      return;
    }
    this.patientConsentForm = {
      ...this.emptyPatientConsentForm(),
      patientId: plan.patient_id,
      templateId: template.id
    };
    this.onConsentPatientChange();
    this.consentMode = 'form';
    this.refreshViewSoon();
    setTimeout(() => {
      document.querySelector('.consent-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async loadAttachmentData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageAttachments) return;
    this.attachmentsLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [patients, clinicalRecords, treatmentPlans, attachments] = await Promise.all([
        this.odontology.listPatients(this.selectedClientId),
        this.canManageClinicalRecords ? this.odontology.listClinicalRecords(this.selectedClientId, {}) : Promise.resolve([]),
        this.canManageTreatmentPlans ? this.odontology.listTreatmentPlans(this.selectedClientId, {}) : Promise.resolve([]),
        this.odontology.listAttachments(this.selectedClientId, {
          patientId: this.attachmentPatientFilter,
          category: this.attachmentCategoryFilter,
          search: this.attachmentSearchTerm
        })
      ]);
      this.patients = patients;
      this.clinicalRecords = clinicalRecords;
      this.treatmentPlans = treatmentPlans;
      this.attachments = attachments;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar los adjuntos odontológicos.';
    } finally {
      this.attachmentsLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreateAttachment(): void {
    this.attachmentForm = this.emptyAttachmentForm();
    if (this.attachmentPatientFilter) this.attachmentForm.patientId = this.attachmentPatientFilter;
    this.attachmentFile = null;
    this.attachmentMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelAttachmentForm(): void {
    this.attachmentMode = 'list';
    this.attachmentForm = this.emptyAttachmentForm();
    this.attachmentFile = null;
    this.refreshViewSoon();
  }

  onAttachmentFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.attachmentFile = input.files?.[0] ?? null;
    if (this.attachmentFile && !this.attachmentForm.title.trim()) {
      this.attachmentForm.title = this.attachmentFile.name.replace(/\.[^.]+$/, '');
    }
  }

  onAttachmentPatientChange(): void {
    this.attachmentForm.clinicalRecordId = '';
    this.attachmentForm.treatmentPlanId = '';
  }

  async saveAttachment(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateAttachmentForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }

    this.attachmentSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const form = new FormData();
      form.append('file', this.attachmentFile as File);
      form.append('patientId', this.attachmentForm.patientId);
      form.append('category', this.attachmentForm.category);
      form.append('title', this.attachmentForm.title.trim());
      form.append('documentDate', this.attachmentForm.documentDate);
      if (this.attachmentForm.description.trim()) form.append('description', this.attachmentForm.description.trim());
      if (this.attachmentForm.clinicalRecordId) form.append('clinicalRecordId', this.attachmentForm.clinicalRecordId);
      if (this.attachmentForm.treatmentPlanId) form.append('treatmentPlanId', this.attachmentForm.treatmentPlanId);
      await this.odontology.uploadAttachment(this.selectedClientId, form);
      this.successMessage = 'Adjunto odontológico cargado correctamente.';
      this.cancelAttachmentForm();
      await this.loadAttachmentData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar el adjunto.';
    } finally {
      this.attachmentSaving = false;
      this.refreshViewSoon();
    }
  }

  async deleteAttachment(attachment: OdontologyAttachmentDto): Promise<void> {
    if (!this.selectedClientId) return;
    if (!confirm(`¿Eliminar el adjunto "${attachment.title}"?`)) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.deleteAttachment(this.selectedClientId, attachment.id);
      this.successMessage = 'Adjunto eliminado correctamente.';
      await this.loadAttachmentData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar el adjunto.';
    } finally {
      this.refreshViewSoon();
    }
  }

  openAttachment(attachment: OdontologyAttachmentDto): void {
    window.open(joinBase(this.publicBase, attachment.file_path), '_blank', 'noopener');
  }

  attachmentCategoryLabel(value: string): string {
    return this.attachmentCategories.find((item) => item.value === value)?.label ?? value;
  }

  async loadInventoryData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageInventory) return;
    this.inventoryLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [items, movements, suppliers, purchaseRequests] = await Promise.all([
        this.odontology.listInventoryItems(this.selectedClientId, {
          status: this.inventoryStatusFilter,
          lowStockOnly: this.inventoryLowStockOnly,
          search: this.inventorySearchTerm
        }),
        this.odontology.listInventoryMovements(this.selectedClientId, {
          itemId: this.inventoryMovementItemFilter,
          movementType: this.inventoryMovementTypeFilter,
          search: this.inventoryMovementSearchTerm
        }),
        this.odontology.listSuppliers(this.selectedClientId, {
          status: this.inventorySupplierStatusFilter,
          search: this.inventorySupplierSearchTerm
        }),
        this.odontology.listPurchaseRequests(this.selectedClientId, {
          status: this.inventoryPurchaseStatusFilter,
          search: this.inventoryPurchaseSearchTerm
        })
      ]);
      this.inventoryItems = items;
      this.inventoryMovements = movements;
      this.inventorySuppliers = suppliers;
      this.inventoryPurchaseRequests = purchaseRequests;
      if (!this.inventoryKitProcedureId && this.activeProcedures.length) {
        this.inventoryKitProcedureId = this.activeProcedures[0].id;
      }
      if (this.inventoryKitProcedureId) {
        await this.loadInventoryKit();
      }
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar el inventario odontológico.';
    } finally {
      this.inventoryLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreateInventoryItem(): void {
    this.editingInventoryItemId = null;
    this.inventoryItemForm = this.emptyInventoryItemForm();
    this.inventoryMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  editInventoryItem(item: OdontologyInventoryItemDto): void {
    this.editingInventoryItemId = item.id;
    this.inventoryItemForm = {
      code: item.code || '',
      name: item.name,
      category: item.category || '',
      presentation: item.presentation || '',
      unit: item.unit,
      brand: item.brand || '',
      supplier: item.supplier || '',
      minStock: Number(item.min_stock || 0),
      currentStock: Number(item.current_stock || 0),
      unitCost: item.unit_cost === null ? null : Number(item.unit_cost),
      isActive: item.is_active,
      notes: item.notes || ''
    };
    this.inventoryMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  startCreateSupplier(): void {
    this.editingSupplierId = null;
    this.supplierForm = this.emptySupplierForm();
    this.inventoryMode = 'supplier';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  editSupplier(supplier: OdontologySupplierDto): void {
    this.editingSupplierId = supplier.id;
    this.supplierForm = {
      name: supplier.name,
      nit: supplier.nit || '',
      contactName: supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      category: supplier.category || '',
      notes: supplier.notes || '',
      isActive: supplier.is_active
    };
    this.inventoryMode = 'supplier';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  startInventoryMovement(item?: OdontologyInventoryItemDto): void {
    this.inventoryMovementForm = this.emptyInventoryMovementForm();
    if (item) this.inventoryMovementForm.itemId = item.id;
    this.inventoryMode = 'movement';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  startInventoryEntryFromPurchase(request: OdontologyPurchaseRequestDto): void {
    this.inventoryMovementForm = this.emptyInventoryMovementForm();
    this.inventoryMovementForm.itemId = request.item_id;
    this.inventoryMovementForm.movementType = 'entry';
    this.inventoryMovementForm.quantity = Number(request.quantity || 0);
    this.inventoryMovementForm.reference = `Solicitud de compra ${request.id.slice(0, 8)}`;
    this.inventoryMovementForm.reason = `Entrada por solicitud de compra de ${request.item_name}.`;
    this.inventoryMode = 'movement';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  startPurchaseRequest(item?: OdontologyInventoryItemDto): void {
    this.inventoryPurchaseForm = this.emptyInventoryPurchaseForm();
    if (item) {
      this.inventoryPurchaseForm.itemId = item.id;
      this.inventoryPurchaseForm.quantity = Math.max(Number(item.min_stock || 0) - Number(item.current_stock || 0), 1);
      this.inventoryPurchaseForm.preferredSupplier = item.supplier || '';
      this.inventoryPurchaseForm.reason = item.low_stock
        ? `Reposición por stock bajo. Stock actual: ${item.current_stock} ${item.unit}; mínimo: ${item.min_stock}.`
        : '';
    }
    this.inventoryMode = 'purchase';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelInventoryForm(): void {
    this.inventoryMode = 'list';
    this.editingInventoryItemId = null;
    this.editingSupplierId = null;
    this.inventoryItemForm = this.emptyInventoryItemForm();
    this.inventoryMovementForm = this.emptyInventoryMovementForm();
    this.supplierForm = this.emptySupplierForm();
    this.inventoryPurchaseForm = this.emptyInventoryPurchaseForm();
    this.refreshViewSoon();
  }

  async saveInventoryItem(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateInventoryItemForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.inventorySaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = this.inventoryItemPayload();
      if (this.editingInventoryItemId) {
        await this.odontology.updateInventoryItem(this.selectedClientId, this.editingInventoryItemId, payload);
        this.successMessage = 'Insumo actualizado correctamente.';
      } else {
        await this.odontology.createInventoryItem(this.selectedClientId, payload);
        this.successMessage = 'Insumo creado correctamente.';
      }
      this.cancelInventoryForm();
      await this.loadInventoryData();
      this.bootstrap = await this.odontology.getBootstrap(this.selectedClientId);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el insumo.';
    } finally {
      this.inventorySaving = false;
      this.refreshViewSoon();
    }
  }

  async saveInventoryMovement(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateInventoryMovementForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.inventoryMovementSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.createInventoryMovement(this.selectedClientId, this.inventoryMovementPayload());
      this.successMessage = 'Movimiento de inventario registrado correctamente.';
      this.cancelInventoryForm();
      await this.loadInventoryData();
      this.bootstrap = await this.odontology.getBootstrap(this.selectedClientId);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo registrar el movimiento.';
    } finally {
      this.inventoryMovementSaving = false;
      this.refreshViewSoon();
    }
  }

  async saveSupplier(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateSupplierForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.supplierSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = this.supplierPayload();
      if (this.editingSupplierId) {
        await this.odontology.updateSupplier(this.selectedClientId, this.editingSupplierId, payload);
        this.successMessage = 'Proveedor actualizado correctamente.';
      } else {
        await this.odontology.createSupplier(this.selectedClientId, payload);
        this.successMessage = 'Proveedor creado correctamente.';
      }
      this.cancelInventoryForm();
      await this.loadInventoryData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el proveedor.';
    } finally {
      this.supplierSaving = false;
      this.refreshViewSoon();
    }
  }

  async savePurchaseRequest(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateInventoryPurchaseForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.inventoryPurchaseSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.createPurchaseRequest(this.selectedClientId, this.inventoryPurchasePayload());
      this.successMessage = 'Solicitud de compra creada correctamente.';
      this.cancelInventoryForm();
      await this.loadInventoryData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear la solicitud de compra.';
    } finally {
      this.inventoryPurchaseSaving = false;
      this.refreshViewSoon();
    }
  }

  async updatePurchaseRequestStatus(request: OdontologyPurchaseRequestDto, status: string): Promise<void> {
    if (!this.selectedClientId) return;
    this.inventoryPurchaseUpdatingId = request.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.updatePurchaseRequestStatus(this.selectedClientId, request.id, status);
      this.successMessage = 'Estado de solicitud actualizado.';
      await this.loadInventoryData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo actualizar la solicitud.';
    } finally {
      this.inventoryPurchaseUpdatingId = '';
      this.refreshViewSoon();
    }
  }

  inventoryMovementTypeLabel(value: string): string {
    const labels: Record<string, string> = {
      entry: 'Entrada',
      exit: 'Salida',
      adjustment: 'Ajuste'
    };
    return labels[value] ?? value;
  }

  async loadInventoryKit(): Promise<void> {
    if (!this.selectedClientId || !this.inventoryKitProcedureId || !this.canManageInventory) return;
    this.inventoryKitLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      this.inventoryProcedureKit = await this.odontology.listProcedureInventoryKit(this.selectedClientId, this.inventoryKitProcedureId);
      this.inventoryKitItems = this.inventoryProcedureKit.map((item) => ({
        itemId: item.item_id,
        quantity: Number(item.quantity || 0),
        isActive: item.is_active,
        notes: item.notes || ''
      }));
      if (!this.inventoryKitItems.length) {
        this.addInventoryKitItem();
      }
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar el kit del procedimiento.';
    } finally {
      this.inventoryKitLoading = false;
      this.refreshViewSoon();
    }
  }

  addInventoryKitItem(): void {
    this.inventoryKitItems.push({
      itemId: '',
      quantity: 1,
      isActive: true,
      notes: ''
    });
    this.refreshViewSoon();
  }

  removeInventoryKitItem(index: number): void {
    this.inventoryKitItems.splice(index, 1);
    if (!this.inventoryKitItems.length) this.addInventoryKitItem();
    this.refreshViewSoon();
  }

  async saveInventoryKit(): Promise<void> {
    if (!this.selectedClientId || !this.inventoryKitProcedureId) return;
    const validationMessage = this.validateInventoryKitForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.inventoryKitSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      this.inventoryProcedureKit = await this.odontology.replaceProcedureInventoryKit(
        this.selectedClientId,
        this.inventoryKitProcedureId,
        this.inventoryKitPayload()
      );
      this.inventoryKitItems = this.inventoryProcedureKit.map((item) => ({
        itemId: item.item_id,
        quantity: Number(item.quantity || 0),
        isActive: item.is_active,
        notes: item.notes || ''
      }));
      if (!this.inventoryKitItems.length) this.addInventoryKitItem();
      this.successMessage = 'Kit del procedimiento guardado correctamente.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el kit del procedimiento.';
    } finally {
      this.inventoryKitSaving = false;
      this.refreshViewSoon();
    }
  }

  async loadSterilizationData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageSterilization) return;
    this.sterilizationLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [instruments, cycles, appointments] = await Promise.all([
        this.odontology.listInstruments(this.selectedClientId, {
          status: this.instrumentStatusFilter,
          search: this.instrumentSearchTerm
        }),
        this.odontology.listSterilizationCycles(this.selectedClientId, {
          result: this.sterilizationResultFilter,
          method: this.sterilizationMethodFilter,
          search: this.sterilizationSearchTerm,
          startDate: this.sterilizationReportStartDate,
          endDate: this.sterilizationReportEndDate,
          responsible: this.sterilizationResponsibleFilter
        }),
        this.canManageAppointments
          ? this.odontology.listAppointments(this.selectedClientId, {})
          : Promise.resolve([])
      ]);
      this.instruments = instruments;
      this.sterilizationCycles = cycles;
      this.appointments = appointments;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar esterilización odontológica.';
    } finally {
      this.sterilizationLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreateInstrument(): void {
    this.editingInstrumentId = null;
    this.instrumentForm = this.emptyInstrumentForm();
    this.sterilizationMode = 'instrument';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  editInstrument(item: OdontologyInstrumentDto): void {
    this.editingInstrumentId = item.id;
    this.instrumentForm = {
      code: item.code || '',
      name: item.name,
      category: item.category || '',
      totalQuantity: Number(item.total_quantity || 0),
      isActive: item.is_active,
      notes: item.notes || ''
    };
    this.sterilizationMode = 'instrument';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  startCreateSterilizationCycle(): void {
    this.sterilizationCycleForm = this.emptySterilizationCycleForm();
    this.sterilizationMode = 'cycle';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelSterilizationForm(): void {
    this.sterilizationMode = 'list';
    this.editingInstrumentId = null;
    this.instrumentForm = this.emptyInstrumentForm();
    this.sterilizationCycleForm = this.emptySterilizationCycleForm();
    this.refreshViewSoon();
  }

  resetSterilizationFilters(): void {
    this.instrumentSearchTerm = '';
    this.instrumentStatusFilter = 'active';
    this.sterilizationSearchTerm = '';
    this.sterilizationResultFilter = '';
    this.sterilizationMethodFilter = '';
    this.sterilizationResponsibleFilter = '';
    this.sterilizationReportStartDate = this.monthStartString();
    this.sterilizationReportEndDate = this.todayString();
    void this.loadSterilizationData();
  }

  async saveInstrument(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateInstrumentForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.instrumentSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = this.instrumentPayload();
      if (this.editingInstrumentId) {
        await this.odontology.updateInstrument(this.selectedClientId, this.editingInstrumentId, payload);
        this.successMessage = 'Instrumental actualizado correctamente.';
      } else {
        await this.odontology.createInstrument(this.selectedClientId, payload);
        this.successMessage = 'Instrumental creado correctamente.';
      }
      this.cancelSterilizationForm();
      await this.loadSterilizationData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el instrumental.';
    } finally {
      this.instrumentSaving = false;
      this.refreshViewSoon();
    }
  }

  async saveSterilizationCycle(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateSterilizationCycleForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.sterilizationSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const cycle = await this.odontology.createSterilizationCycle(this.selectedClientId, this.sterilizationCyclePayload());
      this.successMessage = cycle.pdf_path
        ? 'Ciclo de esterilización registrado correctamente. El PDF quedó disponible.'
        : 'Ciclo de esterilización registrado correctamente.';
      this.cancelSterilizationForm();
      await Promise.all([this.loadSterilizationData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo registrar el ciclo de esterilización.';
    } finally {
      this.sterilizationSaving = false;
      this.refreshViewSoon();
    }
  }

  addSterilizationCycleItem(): void {
    this.sterilizationCycleForm.items.push(this.emptySterilizationCycleItem());
    this.refreshViewSoon();
  }

  removeSterilizationCycleItem(index: number): void {
    if (this.sterilizationCycleForm.items.length <= 1) return;
    this.sterilizationCycleForm.items.splice(index, 1);
    this.refreshViewSoon();
  }

  sterilizationMethodLabel(value: string): string {
    return this.sterilizationMethods.find((item) => item.value === value)?.label ?? value;
  }

  sterilizationResultLabel(value: string): string {
    return this.sterilizationResults.find((item) => item.value === value)?.label ?? value;
  }

  async openSterilizationCyclePdf(cycle: OdontologySterilizationCycleDto): Promise<void> {
    if (!this.selectedClientId) return;
    try {
      const blob = await this.odontology.getSterilizationCyclePdf(this.selectedClientId, cycle.id);
      this.openPdfBlob(blob);
      if (!cycle.pdf_path) await this.loadSterilizationData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF del ciclo de esterilización.';
      this.refreshViewSoon();
    }
  }

  async openClinicalSterilizationCyclePdf(cycle: { id: string }): Promise<void> {
    if (!this.selectedClientId || !cycle?.id) return;
    try {
      const blob = await this.odontology.getSterilizationCyclePdf(this.selectedClientId, cycle.id);
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF del ciclo asociado.';
      this.refreshViewSoon();
    }
  }

  async openFirstClinicalSterilizationCyclePdf(record: OdontologyClinicalRecordDto): Promise<void> {
    const cycle = record.sterilization_cycles?.[0];
    if (!cycle) return;
    await this.openClinicalSterilizationCyclePdf(cycle);
  }

  async openSterilizationCycleLabelsPdf(cycle: OdontologySterilizationCycleDto): Promise<void> {
    if (!this.selectedClientId) return;
    try {
      const blob = await this.odontology.getSterilizationCycleLabelsPdf(this.selectedClientId, cycle.id);
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron abrir las etiquetas del ciclo.';
      this.refreshViewSoon();
    }
  }

  async openSterilizationReportPdf(): Promise<void> {
    if (!this.selectedClientId) return;
    try {
      const blob = await this.odontology.getSterilizationCyclesReportPdf(this.selectedClientId, {
        result: this.sterilizationResultFilter,
        method: this.sterilizationMethodFilter,
        search: this.sterilizationSearchTerm,
        startDate: this.sterilizationReportStartDate,
        endDate: this.sterilizationReportEndDate,
        responsible: this.sterilizationResponsibleFilter
      });
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el reporte de esterilización.';
      this.refreshViewSoon();
    }
  }

  async loadPaymentData(): Promise<void> {
    if (!this.selectedClientId || !this.canManagePayments) return;
    this.paymentsLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [patients, treatmentPlans, payments, cashClosures] = await Promise.all([
        this.odontology.listPatients(this.selectedClientId),
        this.canManageTreatmentPlans ? this.odontology.listTreatmentPlans(this.selectedClientId, {}) : Promise.resolve([]),
        this.odontology.listPayments(this.selectedClientId, {
          patientId: this.paymentPatientFilter,
          treatmentPlanId: this.paymentPlanFilter,
          status: this.paymentStatusFilter,
          search: this.paymentSearchTerm,
          startDate: this.paymentStartDateFilter,
          endDate: this.paymentEndDateFilter,
          cashier: this.paymentCashierFilter
        }),
        this.odontology.listCashClosures(this.selectedClientId, {
          startDate: this.paymentStartDateFilter,
          endDate: this.paymentEndDateFilter,
          cashier: this.paymentCashierFilter
        })
      ]);
      this.patients = patients;
      this.treatmentPlans = treatmentPlans;
      this.payments = payments;
      this.cashClosures = cashClosures;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar los pagos odontológicos.';
    } finally {
      this.paymentsLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreatePayment(): void {
    this.paymentForm = this.emptyPaymentForm();
    if (this.paymentPatientFilter) this.paymentForm.patientId = this.paymentPatientFilter;
    if (this.paymentPlanFilter) this.paymentForm.treatmentPlanId = this.paymentPlanFilter;
    this.paymentMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelPaymentForm(): void {
    this.paymentMode = 'list';
    this.paymentForm = this.emptyPaymentForm();
    this.refreshViewSoon();
  }

  resetPaymentFilters(): void {
    this.paymentSearchTerm = '';
    this.paymentPatientFilter = '';
    this.paymentStatusFilter = '';
    this.paymentPlanFilter = '';
    this.paymentStartDateFilter = this.monthStartString();
    this.paymentEndDateFilter = this.todayString();
    this.paymentCashierFilter = '';
    void this.loadPaymentData();
  }

  onPaymentPatientChange(): void {
    this.paymentForm.treatmentPlanId = '';
  }

  onPaymentPlanChange(): void {
    const plan = this.paymentSelectedPlan;
    if (!plan) return;
    const balance = Number(plan.balance_amount ?? plan.total_amount ?? 0);
    if (balance > 0) this.paymentForm.amount = balance;
    if (!this.paymentForm.concept.trim()) this.paymentForm.concept = `Abono ${plan.title}`;
  }

  async savePayment(): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para registrar valores económicos.';
      this.refreshViewSoon();
      return;
    }
    const validationMessage = this.validatePaymentForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.paymentSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.createPayment(this.selectedClientId, this.paymentPayload());
      this.successMessage = 'Pago registrado correctamente.';
      this.cancelPaymentForm();
      await Promise.all([this.loadPaymentData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo registrar el pago.';
    } finally {
      this.paymentSaving = false;
      this.refreshViewSoon();
    }
  }

  async voidPayment(payment: OdontologyPaymentDto): Promise<void> {
    if (!this.selectedClientId || payment.status === 'voided') return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para anular valores económicos.';
      this.refreshViewSoon();
      return;
    }
    const reason = prompt(`Motivo para anular el pago de ${this.financialValue(payment.amount)}:`);
    if (!reason?.trim()) return;
    this.paymentVoiding = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.voidPayment(this.selectedClientId, payment.id, reason.trim());
      this.successMessage = 'Pago anulado correctamente.';
      await Promise.all([this.loadPaymentData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo anular el pago.';
    } finally {
      this.paymentVoiding = false;
      this.refreshViewSoon();
    }
  }

  async openPaymentReceiptPdf(payment: OdontologyPaymentDto): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para ver valores económicos del recibo.';
      this.refreshViewSoon();
      return;
    }
    try {
      const blob = await this.odontology.getPaymentReceiptPdf(this.selectedClientId, payment.id);
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el recibo del pago.';
      this.refreshViewSoon();
    }
  }

  async openPaymentsReportPdf(): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para exportar valores económicos.';
      this.refreshViewSoon();
      return;
    }
    try {
      const blob = await this.odontology.getPaymentsReportPdf(this.selectedClientId, {
        patientId: this.paymentPatientFilter,
        treatmentPlanId: this.paymentPlanFilter,
        status: this.paymentStatusFilter,
        search: this.paymentSearchTerm,
        startDate: this.paymentStartDateFilter,
        endDate: this.paymentEndDateFilter,
        cashier: this.paymentCashierFilter
      });
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el reporte de pagos.';
      this.refreshViewSoon();
    }
  }

  async createCashClosure(): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para cerrar caja con valores económicos.';
      this.refreshViewSoon();
      return;
    }
    if (!this.paymentStartDateFilter || !this.paymentEndDateFilter) {
      this.errorMessage = 'Selecciona fecha inicial y fecha final para cerrar caja.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    const confirmed = confirm(
      `¿Deseas cerrar caja del ${this.displayDateOnly(this.paymentStartDateFilter)} al ${this.displayDateOnly(this.paymentEndDateFilter)}?`
    );
    if (!confirmed) return;

    this.cashClosureSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const closure = await this.odontology.createCashClosure(this.selectedClientId, {
        dateFrom: this.paymentStartDateFilter,
        dateTo: this.paymentEndDateFilter,
        cashier: this.paymentCashierFilter.trim() || null,
        notes: this.cashClosureNotes.trim() || null
      });
      this.cashClosureNotes = '';
      this.successMessage = 'Cierre de caja generado correctamente.';
      await this.loadPaymentData();
      await this.openCashClosurePdf(closure);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo generar el cierre de caja.';
    } finally {
      this.cashClosureSaving = false;
      this.refreshViewSoon();
    }
  }

  async openCashClosurePdf(closure: OdontologyCashClosureDto): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para ver valores económicos del cierre.';
      this.refreshViewSoon();
      return;
    }
    try {
      const blob = await this.odontology.getCashClosurePdf(this.selectedClientId, closure.id);
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF del cierre de caja.';
      this.refreshViewSoon();
    }
  }

  cashClosureNet(closure: OdontologyCashClosureDto): number {
    return Number(closure.total_registered || 0) - Number(closure.total_voided || 0);
  }

  get filteredRegisteredPaymentTotal(): number {
    return this.payments
      .filter((payment) => payment.status === 'registered')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  get filteredVoidedPaymentTotal(): number {
    return this.payments
      .filter((payment) => payment.status === 'voided')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  get filteredRegisteredPaymentCount(): number {
    return this.payments.filter((payment) => payment.status === 'registered').length;
  }

  get filteredVoidedPaymentCount(): number {
    return this.payments.filter((payment) => payment.status === 'voided').length;
  }

  paymentMethodLabel(value: string): string {
    return this.paymentMethods.find((item) => item.value === value)?.label ?? value;
  }

  paymentStatusLabel(value: string): string {
    return value === 'voided' ? 'Anulado' : 'Registrado';
  }

  displayDateOnly(value: string | null | undefined): string {
    if (!value) return '-';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    if (!year || !month || !day) return String(value);
    return `${day}/${month}/${year}`;
  }

  async loadPrescriptionData(): Promise<void> {
    if (!this.selectedClientId || !this.canManagePrescriptions) return;
    this.prescriptionLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [patients, clinicalRecords, medications, prescriptions] = await Promise.all([
        this.odontology.listPatients(this.selectedClientId),
        this.canManageClinicalRecords ? this.odontology.listClinicalRecords(this.selectedClientId, {}) : Promise.resolve([]),
        this.odontology.listMedications(this.selectedClientId, { activeOnly: true }),
        this.odontology.listPrescriptions(this.selectedClientId, {
          patientId: this.prescriptionPatientFilter,
          status: this.prescriptionStatusFilter,
          search: this.prescriptionSearchTerm
        })
      ]);
      this.patients = patients;
      this.clinicalRecords = clinicalRecords;
      this.medications = medications;
      this.prescriptions = prescriptions;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar las recetas odontológicas.';
    } finally {
      this.prescriptionLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreatePrescription(): void {
    this.prescriptionForm = this.emptyPrescriptionForm();
    if (this.prescriptionPatientFilter) this.prescriptionForm.patientId = this.prescriptionPatientFilter;
    this.prescriptionMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelPrescriptionForm(): void {
    this.prescriptionMode = 'list';
    this.prescriptionForm = this.emptyPrescriptionForm();
    this.showMedicationForm = false;
    this.refreshViewSoon();
  }

  addPrescriptionItem(): void {
    this.prescriptionForm.items.push(this.emptyPrescriptionItem());
    this.refreshViewSoon();
  }

  removePrescriptionItem(index: number): void {
    if (this.prescriptionForm.items.length <= 1) return;
    this.prescriptionForm.items.splice(index, 1);
    this.refreshViewSoon();
  }

  applyPrescriptionMedication(index: number): void {
    const item = this.prescriptionForm.items[index];
    const medication = this.medications.find((entry) => entry.id === item.medicationCatalogId);
    if (!item || !medication) return;
    item.medicationId = medication.id;
    item.medicationName = medication.name;
    item.concentration = medication.concentration ?? '';
    item.pharmaceuticalForm = medication.pharmaceutical_form ?? '';
    item.dose = medication.default_dose ?? item.dose;
    item.frequency = medication.default_frequency ?? item.frequency;
    item.duration = medication.default_duration ?? item.duration;
    item.instructions = medication.default_instructions ?? item.instructions;
    this.refreshViewSoon();
  }

  async savePrescription(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validatePrescriptionForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.prescriptionSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const prescription = await this.odontology.createPrescription(this.selectedClientId, this.prescriptionPayload());
      this.successMessage = 'Receta creada y PDF generado correctamente.';
      this.cancelPrescriptionForm();
      await this.loadPrescriptionData();
      if (prescription.pdf_path) this.openPrescriptionPdf(prescription.pdf_path);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear la receta odontológica.';
    } finally {
      this.prescriptionSaving = false;
      this.refreshViewSoon();
    }
  }

  async saveMedication(): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.medicationForm.name.trim()) {
      this.errorMessage = 'Nombre del medicamento obligatorio.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.medicationSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.createMedication(this.selectedClientId, this.medicationPayload());
      this.successMessage = 'Medicamento agregado al catálogo.';
      this.medicationForm = this.emptyMedicationForm();
      this.showMedicationForm = false;
      this.medications = await this.odontology.listMedications(this.selectedClientId, { activeOnly: true });
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el medicamento.';
    } finally {
      this.medicationSaving = false;
      this.refreshViewSoon();
    }
  }

  prescriptionStatusLabel(status: string): string {
    return status === 'voided' ? 'Anulada' : 'Emitida';
  }

  openPrescriptionPdf(path: string | null): void {
    if (!path) return;
    window.open(joinBase(this.publicBase, path), '_blank', 'noopener');
  }

  async loadClinicalDocumentData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageClinicalDocuments) return;
    this.clinicalDocumentLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [patients, clinicalRecords, documents] = await Promise.all([
        this.odontology.listPatients(this.selectedClientId),
        this.canManageClinicalRecords ? this.odontology.listClinicalRecords(this.selectedClientId, {}) : Promise.resolve([]),
        this.odontology.listClinicalDocuments(this.selectedClientId, {
          patientId: this.clinicalDocumentPatientFilter,
          documentType: this.clinicalDocumentTypeFilter,
          status: this.clinicalDocumentStatusFilter,
          search: this.clinicalDocumentSearchTerm
        })
      ]);
      this.patients = patients;
      this.clinicalRecords = clinicalRecords;
      this.clinicalDocuments = documents;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar los documentos clínicos.';
    } finally {
      this.clinicalDocumentLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreateClinicalDocument(): void {
    this.clinicalDocumentForm = this.emptyClinicalDocumentForm();
    if (this.clinicalDocumentPatientFilter) this.clinicalDocumentForm.patientId = this.clinicalDocumentPatientFilter;
    this.clinicalDocumentMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelClinicalDocumentForm(): void {
    this.clinicalDocumentMode = 'list';
    this.clinicalDocumentForm = this.emptyClinicalDocumentForm();
    this.refreshViewSoon();
  }

  onClinicalDocumentTypeChange(): void {
    if (this.clinicalDocumentForm.documentType === 'incapacidad') {
      if (!this.clinicalDocumentForm.title.trim() || this.clinicalDocumentForm.title === 'Certificado odontológico') {
        this.clinicalDocumentForm.title = 'Incapacidad odontológica';
      }
      if (!this.clinicalDocumentForm.body.trim()) {
        this.clinicalDocumentForm.body = 'Se certifica que el paciente requiere incapacidad odontológica según valoración clínica realizada.';
      }
    } else if (!this.clinicalDocumentForm.title.trim() || this.clinicalDocumentForm.title === 'Incapacidad odontológica') {
      this.clinicalDocumentForm.title = this.clinicalDocumentTypeLabel(this.clinicalDocumentForm.documentType);
    }
    this.refreshViewSoon();
  }

  async saveClinicalDocument(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateClinicalDocumentForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.clinicalDocumentSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const documentRow = await this.odontology.createClinicalDocument(this.selectedClientId, this.clinicalDocumentPayload());
      this.successMessage = 'Documento clínico creado y PDF generado correctamente.';
      this.cancelClinicalDocumentForm();
      await this.loadClinicalDocumentData();
      if (documentRow.pdf_path) this.openClinicalDocumentPdf(documentRow.pdf_path);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear el documento clínico.';
    } finally {
      this.clinicalDocumentSaving = false;
      this.refreshViewSoon();
    }
  }

  clinicalDocumentTypeLabel(value: string): string {
    return this.clinicalDocumentTypes.find((item) => item.value === value)?.label ?? value;
  }

  clinicalDocumentStatusLabel(status: string): string {
    return status === 'voided' ? 'Anulado' : 'Emitido';
  }

  openClinicalDocumentPdf(path: string | null): void {
    if (!path) return;
    window.open(joinBase(this.publicBase, path), '_blank', 'noopener');
  }

  currencyValue(value: string | number | null | undefined): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  financialValue(value: string | number | null | undefined): string {
    return this.canViewFinancialValues ? this.currencyValue(value) : 'Valor restringido';
  }

  financialExportValue(value: string | number | null | undefined): string | number {
    return this.canViewFinancialValues ? Number(value || 0) : 'Valor restringido';
  }

  async loadReports(): Promise<void> {
    if (!this.selectedClientId || !this.canViewReports) return;
    this.reportsLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      this.reportData = await this.odontology.getReports(this.selectedClientId, {
        startDate: this.reportStartDate,
        endDate: this.reportEndDate
      });
      this.reportStartDate = this.reportData.range.startDate;
      this.reportEndDate = this.reportData.range.endDate;
    } catch (error: any) {
      console.error(error);
      this.reportData = null;
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar los reportes odontológicos.';
    } finally {
      this.reportsLoading = false;
      this.refreshViewSoon();
    }
  }

  exportReportsCsv(): void {
    if (!this.reportData) return;
    const rows = this.reportExportRows();
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, `reporte-odontologia-${this.reportData.range.startDate}-${this.reportData.range.endDate}.csv`);
  }

  async exportReportsExcel(): Promise<void> {
    if (!this.reportData) return;
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'INBIHOSPITALARIO';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Resumen', {
      views: [{ state: 'frozen', ySplit: 5 }]
    });
    summary.columns = [
      { header: 'Indicador', key: 'indicator', width: 34 },
      { header: 'Valor', key: 'value', width: 24 },
      { header: 'Observación', key: 'note', width: 44 }
    ];
    summary.mergeCells('A1:C1');
    summary.getCell('A1').value = 'Reporte odontológico';
    summary.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFA64045' } };
    summary.getCell('A2').value = `Cliente: ${this.selectedClientInfo?.name || 'Cliente'}`;
    summary.getCell('A3').value = `Rango: ${this.reportData.range.startDate} - ${this.reportData.range.endDate}`;
    summary.getRow(5).values = ['Indicador', 'Valor', 'Observación'];
    this.styleExcelHeader(summary.getRow(5));
    [
      ['Pacientes nuevos', this.reportData.counters.newPatients, 'Registros creados en el rango'],
      ['Citas', this.reportData.counters.appointments, `${this.reportData.counters.attendedAppointments} atendidas`],
      ['Canceladas / no asistió', this.reportData.counters.cancelledOrMissedAppointments, 'Seguimiento administrativo'],
      ['Historias firmadas', this.reportData.counters.clinicalSigned, `${this.reportData.counters.clinicalDrafts} en borrador`],
      ['Planes de tratamiento', this.reportData.counters.treatmentPlans, this.financialValue(this.reportData.counters.treatmentPlanAmount)],
      ['Pagos registrados', this.reportData.counters.payments, this.financialValue(this.reportData.counters.paymentAmount)],
      ['Consentimientos firmados', this.reportData.counters.consentsSigned, `${this.reportData.counters.consentsDraft} borradores`],
      ['Adjuntos cargados', this.reportData.counters.attachments, 'Soportes por fecha documental']
    ].forEach((row) => summary.addRow({ indicator: row[0], value: row[1], note: row[2] }));
    this.styleExcelBody(summary);

    this.addReportSheet(workbook, 'Citas por estado', ['Estado', 'Cantidad'], this.reportData.appointmentsByStatus.map((row) => [row.status, row.total]));
    this.addReportSheet(workbook, 'Procedimientos', ['Procedimiento', 'Cantidad'], this.reportData.topProcedures.map((row) => [row.name, row.total]));
    this.addReportSheet(workbook, 'Pagos por metodo', ['Método', 'Cantidad', 'Valor'], this.reportData.paymentsByMethod.map((row) => [this.paymentMethodLabel(row.method), row.total, this.financialExportValue(row.total_amount)]));
    this.addReportSheet(
      workbook,
      'Ingresos por periodo',
      ['Fecha', 'Pagos', 'Valor'],
      this.reportData.revenueByPeriod.map((row) => [
        this.dateOnly(row.period_date),
        row.total,
        this.financialExportValue(row.total_amount)
      ])
    );
    this.addReportSheet(workbook, 'Planes por estado', ['Estado', 'Cantidad'], this.reportData.treatmentPlansByStatus.map((row) => [this.reportStatusLabel(row.status), row.total]));
    this.addReportSheet(
      workbook,
      'Tratamientos por estado',
      ['Estado', 'Cantidad', 'Valor proyectado'],
      this.reportData.treatmentPlanValuesByStatus.map((row) => [
        this.reportStatusLabel(row.status),
        row.total,
        this.financialExportValue(row.total_amount)
      ])
    );
    this.addReportSheet(
      workbook,
      'Planes por estado pago',
      ['Estado pago', 'Planes', 'Valor total', 'Pagado', 'Saldo'],
      this.reportData.treatmentPlanFinancialSummary.map((row) => [
        this.treatmentFinancialStatusStaticLabel(row.financial_status),
        row.total,
        this.financialExportValue(row.total_amount),
        this.financialExportValue(row.paid_amount),
        this.financialExportValue(row.balance_amount)
      ])
    );
    this.addReportSheet(workbook, 'Historias clinicas', ['Estado', 'Cantidad'], this.reportData.clinicalByStatus.map((row) => [this.reportStatusLabel(row.status), row.total]));
    this.addReportSheet(workbook, 'Consentimientos', ['Estado', 'Cantidad'], this.reportData.consentsByStatus.map((row) => [this.reportStatusLabel(row.status), row.total]));
    this.addReportSheet(
      workbook,
      'Consumo inventario',
      ['Procedimiento', 'Odontólogo', 'Insumo', 'Citas', 'Cantidad', 'Unidad', 'Costo estimado'],
      this.reportData.inventoryConsumptionByProcedureDentist.map((row) => [
        row.procedure_name,
        row.dentist_name,
        row.item_name,
        row.appointments,
        Number(row.total_quantity || 0),
        row.item_unit || '',
        this.financialExportValue(row.estimated_total_cost)
      ])
    );
    this.addReportSheet(
      workbook,
      'Produccion odontologos',
      ['Odontólogo', 'Citas totales', 'Atendidas', 'Canceladas / no asistió', 'Efectividad'],
      this.reportData.productionByDentist.map((row) => [
        row.dentist_name,
        row.total,
        row.attended,
        row.cancelled_or_missed,
        row.total ? `${Math.round((Number(row.attended || 0) / Number(row.total || 1)) * 100)}%` : '0%'
      ])
    );
    this.addReportSheet(
      workbook,
      'Inasistencias',
      ['Fecha', 'Hora', 'Estado', 'Paciente', 'Documento', 'Teléfono', 'Odontólogo', 'Procedimiento', 'Motivo'],
      this.reportData.cancellationsAndNoShows.map((row) => [
        this.dateOnly(row.scheduled_date),
        this.timeOnly(row.start_time),
        row.status,
        row.patient_name,
        row.patient_document_number,
        row.patient_phone || '',
        row.dentist_name,
        row.procedure_name || '',
        row.cancellation_reason || ''
      ])
    );

    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadBlob(
      new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `reporte-odontologia-${this.reportData.range.startDate}-${this.reportData.range.endDate}.xlsx`
    );
  }

  async exportReportDetailsExcel(): Promise<void> {
    if (!this.selectedClientId || !this.reportData) return;
    this.reportsLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const details = await this.odontology.getReportDetails(this.selectedClientId, {
        startDate: this.reportData.range.startDate,
        endDate: this.reportData.range.endDate
      });
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'INBIHOSPITALARIO';
      workbook.created = new Date();

      const summary = workbook.addWorksheet('Resumen');
      summary.columns = [
        { header: 'Detalle', key: 'detail', width: 30 },
        { header: 'Registros', key: 'count', width: 16 }
      ];
      summary.mergeCells('A1:B1');
      summary.getCell('A1').value = 'Detalle exportable odontología';
      summary.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFA64045' } };
      summary.getCell('A2').value = `Cliente: ${this.selectedClientInfo?.name || 'Cliente'}`;
      summary.getCell('A3').value = `Rango: ${details.range.startDate} - ${details.range.endDate}`;
      summary.getRow(5).values = ['Detalle', 'Registros'];
      this.styleExcelHeader(summary.getRow(5));
      [
        ['Agenda / citas', details.appointments.length],
        ['Pacientes nuevos', details.patients.length],
        ['Pagos', details.payments.length],
        ['Recordatorios', details.reminders.length]
      ].forEach((row) => summary.addRow({ detail: row[0], count: row[1] }));
      this.styleExcelBody(summary);

      this.addReportSheet(
        workbook,
        'Agenda',
        ['Fecha', 'Hora', 'Paciente', 'Documento', 'Telefono', 'Correo', 'Odontologo', 'Procedimiento', 'Sede', 'Unidad', 'Estado', 'Notas'],
        details.appointments.map((item) => [
          this.dateOnly(item.scheduled_date),
          `${this.timeOnly(item.start_time)} - ${this.timeOnly(item.end_time)}`,
          item.patient_name,
          item.patient_document_number,
          item.patient_phone || '',
          item.patient_email || '',
          item.dentist_name,
          item.procedure_name || '',
          item.site_name || '',
          item.chair_name || '',
          item.status,
          item.notes || ''
        ])
      );

      this.addReportSheet(
        workbook,
        'Pacientes nuevos',
        ['Codigo', 'Paciente', 'Documento', 'Telefono', 'Correo', 'Tipo', 'Estado', 'Autorizacion', 'Creado'],
        details.patients.map((item) => [
          item.internal_code,
          item.full_name,
          item.document_number,
          item.phone || '',
          item.email || '',
          item.patient_type,
          item.status,
          item.authorization_required ? 'Si' : 'No',
          this.dateOnly(item.created_at)
        ])
      );

      this.addReportSheet(
        workbook,
        'Pagos',
        ['Fecha', 'Paciente', 'Documento', 'Concepto', 'Metodo', 'Valor', 'Estado', 'Referencia', 'Plan', 'Responsable'],
        details.payments.map((item) => [
          this.dateOnly(item.payment_date),
          item.patient_name,
          item.patient_document_number,
          item.concept,
          this.paymentMethodLabel(item.payment_method),
          this.financialExportValue(item.amount),
          this.reportStatusLabel(item.status),
          item.reference || '',
          item.treatment_plan_title || '',
          item.created_by_name || ''
        ])
      );

      this.addReportSheet(
        workbook,
        'Recordatorios',
        ['Envio', 'Canal', 'Tipo', 'Estado', 'Paciente', 'Documento', 'Destino', 'Cita', 'Procedimiento', 'Error'],
        details.reminders.map((item) => [
          this.dateOnly(item.sent_at),
          item.channel,
          this.reminderKindLabel(item.reminder_kind),
          item.status === 'sent' ? 'Enviado' : 'Fallido',
          item.patient_name || item.recipient_name || '',
          item.patient_document_number || '',
          item.recipient_email || item.recipient_phone || '',
          `${this.dateOnly(item.appointment_date || '')} ${this.timeOnly(item.appointment_start_time || '')}`,
          item.procedure_name || '',
          item.error_message || ''
        ])
      );

      this.addReportSheet(
        workbook,
        'Inasistencias',
        ['Fecha', 'Hora', 'Paciente', 'Documento', 'Telefono', 'Correo', 'Odontologo', 'Procedimiento', 'Estado', 'Motivo'],
        details.appointments
          .filter((item) => ['Cancelada', 'No asistió'].includes(item.status))
          .map((item) => [
            this.dateOnly(item.scheduled_date),
            `${this.timeOnly(item.start_time)} - ${this.timeOnly(item.end_time)}`,
            item.patient_name,
            item.patient_document_number,
            item.patient_phone || '',
            item.patient_email || '',
            item.dentist_name,
            item.procedure_name || '',
            item.status,
            item.cancellation_reason || item.notes || ''
          ])
      );

      const buffer = await workbook.xlsx.writeBuffer();
      this.downloadBlob(
        new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `detalle-odontologia-${details.range.startDate}-${details.range.endDate}.xlsx`
      );
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo exportar el detalle odontológico.';
    } finally {
      this.reportsLoading = false;
      this.refreshViewSoon();
    }
  }

  async exportReportsPdf(): Promise<void> {
    if (!this.selectedClientId || !this.reportData) return;
    if (!this.canViewFinancialValues) {
      this.errorMessage = 'No tienes permiso para exportar valores económicos.';
      this.refreshViewSoon();
      return;
    }
    try {
      const blob = await this.odontology.getReportsPdf(this.selectedClientId, {
        startDate: this.reportData.range.startDate,
        endDate: this.reportData.range.endDate
      });
      this.openPdfBlob(blob);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF de reportes odontológicos.';
      this.refreshViewSoon();
    }
  }

  private reportExportRows(): (string | number)[][] {
    if (!this.reportData) return [];
    return [
      ['Reporte odontológico', this.selectedClientInfo?.name || 'Cliente'],
      ['Desde', this.reportData.range.startDate],
      ['Hasta', this.reportData.range.endDate],
      [],
      ['Indicador', 'Valor'],
      ['Pacientes nuevos', String(this.reportData.counters.newPatients)],
      ['Citas', String(this.reportData.counters.appointments)],
      ['Citas atendidas', String(this.reportData.counters.attendedAppointments)],
      ['Canceladas / no asistió', String(this.reportData.counters.cancelledOrMissedAppointments)],
      ['Historias firmadas', String(this.reportData.counters.clinicalSigned)],
      ['Historias en borrador', String(this.reportData.counters.clinicalDrafts)],
      ['Planes de tratamiento', String(this.reportData.counters.treatmentPlans)],
      ['Valor planes', String(this.financialExportValue(this.reportData.counters.treatmentPlanAmount))],
      ['Pagos registrados', String(this.reportData.counters.payments)],
      ['Valor pagos', String(this.financialExportValue(this.reportData.counters.paymentAmount))],
      ['Consentimientos firmados', String(this.reportData.counters.consentsSigned)],
      ['Consentimientos borrador', String(this.reportData.counters.consentsDraft)],
      ['Adjuntos cargados', String(this.reportData.counters.attachments)],
      [],
      ['Citas por estado', 'Cantidad'],
      ...this.reportData.appointmentsByStatus.map((row) => [row.status, String(row.total)]),
      [],
      ['Procedimientos principales', 'Cantidad'],
      ...this.reportData.topProcedures.map((row) => [row.name, String(row.total)]),
      [],
      ['Pagos por método', 'Cantidad', 'Valor'],
      ...this.reportData.paymentsByMethod.map((row) => [this.paymentMethodLabel(row.method), String(row.total), String(this.financialExportValue(row.total_amount))]),
      [],
      ['Ingresos por periodo', 'Pagos', 'Valor'],
      ...this.reportData.revenueByPeriod.map((row) => [this.dateOnly(row.period_date), String(row.total), String(this.financialExportValue(row.total_amount))]),
      [],
      ['Tratamientos por estado', 'Cantidad', 'Valor proyectado'],
      ...this.reportData.treatmentPlanValuesByStatus.map((row) => [this.reportStatusLabel(row.status), String(row.total), String(this.financialExportValue(row.total_amount))]),
      [],
      ['Planes por estado de pago', 'Planes', 'Valor total', 'Pagado', 'Saldo'],
      ...this.reportData.treatmentPlanFinancialSummary.map((row) => [
        this.treatmentFinancialStatusStaticLabel(row.financial_status),
        String(row.total),
        String(this.financialExportValue(row.total_amount)),
        String(this.financialExportValue(row.paid_amount)),
        String(this.financialExportValue(row.balance_amount))
      ]),
      [],
      ['Consumo inventario', 'Odontólogo', 'Insumo', 'Citas', 'Cantidad', 'Unidad', 'Costo estimado'],
      ...this.reportData.inventoryConsumptionByProcedureDentist.map((row) => [
        row.procedure_name,
        row.dentist_name,
        row.item_name,
        String(row.appointments),
        String(row.total_quantity),
        row.item_unit || '',
        String(this.financialExportValue(row.estimated_total_cost))
      ]),
      [],
      ['Producción por odontólogo', 'Citas', 'Atendidas', 'Canceladas / no asistió'],
      ...this.reportData.productionByDentist.map((row) => [row.dentist_name, String(row.total), String(row.attended), String(row.cancelled_or_missed)]),
      [],
      ['Inasistencias y cancelaciones', 'Hora', 'Estado', 'Paciente', 'Odontólogo', 'Motivo'],
      ...this.reportData.cancellationsAndNoShows.map((row) => [
        this.dateOnly(row.scheduled_date),
        this.timeOnly(row.start_time),
        row.status,
        row.patient_name,
        row.dentist_name,
        row.cancellation_reason || ''
      ])
    ];
  }

  reportStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Borrador',
      signed: 'Firmado',
      proposed: 'Propuesto',
      accepted: 'Aceptado',
      in_progress: 'En tratamiento',
      completed: 'Completado',
      cancelled: 'Cancelado'
    };
    return labels[status] ?? status;
  }

  treatmentFinancialStatusStaticLabel(status: string): string {
    const labels: Record<string, string> = {
      'no-value': 'Sin valor',
      unpaid: 'Sin abonos',
      partial: 'Abono parcial',
      paid: 'Pagado'
    };
    return labels[status] ?? status;
  }

  purchaseRequestStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      requested: 'Solicitada',
      quoted: 'Cotizada',
      ordered: 'Ordenada',
      received: 'Recibida',
      cancelled: 'Cancelada'
    };
    return labels[status] ?? status;
  }

  selectClinicalSubTab(tab: ClinicalSubTab): void {
    this.selectedClinicalSubTab = tab;
    if (tab === 'odontogram' && this.selectedClientId && this.odontogramPatientId) {
      void this.loadOdontogram();
    }
    if (tab === 'periodontogram' && this.selectedClientId && this.canManagePeriodontogram) {
      void this.loadPeriodontogramData();
    }
    this.refreshViewSoon();
  }

  async loadOdontogram(): Promise<void> {
    if (!this.selectedClientId || !this.odontogramPatientId || !this.canManageOdontogram) return;
    this.odontogramLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      this.odontogram = await this.odontology.getOdontogram(this.selectedClientId, this.odontogramPatientId);
    } catch (error: any) {
      console.error(error);
      this.odontogram = null;
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar el odontograma.';
    } finally {
      this.odontogramLoading = false;
      this.refreshViewSoon();
    }
  }

  selectTooth(toothNumber: string): void {
    this.selectedToothNumber = toothNumber;
    const latest = this.latestToothEntry(toothNumber);
    if (latest?.condition_item_id) {
      this.odontogramConditionItemId = latest.condition_item_id;
    }
    this.refreshViewSoon();
  }

  latestToothEntry(toothNumber: string): OdontologyOdontogramEntryDto | null {
    return this.odontogram?.latest.find((entry) => entry.tooth_number === toothNumber && entry.surface === 'whole') ?? null;
  }

  toothStyle(toothNumber: string): Record<string, string> {
    const latest = this.latestToothEntry(toothNumber);
    if (!latest?.condition_color) return {};
    return {
      '--tooth-color': latest.condition_color
    };
  }

  async saveOdontogramEntry(): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.odontogramPatientId || !this.selectedToothNumber || !this.odontogramConditionItemId) {
      this.errorMessage = 'Selecciona paciente, diente y condición.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.odontogramSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload: OdontologyOdontogramPayload = {
        patientId: this.odontogramPatientId,
        dentition: this.odontogramDentition,
        toothNumber: this.selectedToothNumber,
        surface: 'whole',
        conditionItemId: this.odontogramConditionItemId,
        notes: this.odontogramNotes.trim() || null,
        recordDate: this.odontogramRecordDate
      };
      await this.odontology.createOdontogramEntry(this.selectedClientId, payload);
      this.successMessage = 'Odontograma actualizado correctamente.';
      this.odontogramNotes = '';
      await this.loadOdontogram();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el odontograma.';
    } finally {
      this.odontogramSaving = false;
      this.refreshViewSoon();
    }
  }

  async loadPeriodontogramData(): Promise<void> {
    if (!this.selectedClientId || !this.canManagePeriodontogram) return;
    this.periodontogramLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [patients, clinicalRecords, periodontograms] = await Promise.all([
        this.odontology.listPatients(this.selectedClientId),
        this.canManageClinicalRecords ? this.odontology.listClinicalRecords(this.selectedClientId, {}) : Promise.resolve([]),
        this.odontology.listPeriodontograms(this.selectedClientId, {
          patientId: this.periodontogramPatientFilter,
          search: this.periodontogramSearchTerm
        })
      ]);
      this.patients = patients;
      this.clinicalRecords = clinicalRecords;
      this.periodontograms = periodontograms;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar los periodontogramas.';
    } finally {
      this.periodontogramLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreatePeriodontogram(): void {
    this.periodontogramForm = this.emptyPeriodontogramForm();
    if (this.periodontogramPatientFilter) this.periodontogramForm.patientId = this.periodontogramPatientFilter;
    this.periodontogramMode = 'form';
    this.periodontogramDetail = null;
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelPeriodontogramForm(): void {
    this.periodontogramMode = 'list';
    this.periodontogramForm = this.emptyPeriodontogramForm();
    this.refreshViewSoon();
  }

  refreshPeriodontogramTeeth(): void {
    this.periodontogramForm.measurements = this.periodontalTeethForDentition(this.periodontogramForm.dentition)
      .map((toothNumber) => this.emptyPeriodontalMeasurement(toothNumber));
    this.refreshViewSoon();
  }

  async viewPeriodontogram(chart: OdontologyPeriodontogramDto): Promise<void> {
    if (!this.selectedClientId) return;
    this.periodontogramLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      this.periodontogramDetail = await this.odontology.getPeriodontogram(this.selectedClientId, chart.id);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar el detalle del periodontograma.';
    } finally {
      this.periodontogramLoading = false;
      this.refreshViewSoon();
    }
  }

  async savePeriodontogram(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validatePeriodontogramForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.periodontogramSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const chart = await this.odontology.createPeriodontogram(this.selectedClientId, this.periodontogramPayload());
      this.successMessage = 'Periodontograma guardado correctamente.';
      this.cancelPeriodontogramForm();
      await this.loadPeriodontogramData();
      this.periodontogramDetail = chart;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el periodontograma.';
    } finally {
      this.periodontogramSaving = false;
      this.refreshViewSoon();
    }
  }

  dentitionLabel(value: string): string {
    if (value === 'temporary') return 'Temporal';
    if (value === 'mixed') return 'Mixta';
    return 'Permanente';
  }

  selectConsentSubTab(tab: 'consents' | 'templates'): void {
    this.selectedConsentSubTab = tab;
    this.cancelSignPatientConsent();
    if (this.selectedClientId && this.canManageConsents) {
      void this.loadConsentData();
    }
    this.refreshViewSoon();
  }

  async loadConsentData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageConsents) return;
    this.consentsLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [patients, appointments, templates, consents] = await Promise.all([
        this.odontology.listPatients(this.selectedClientId),
        this.odontology.listAppointments(this.selectedClientId, {}),
        this.odontology.listConsentTemplates(this.selectedClientId),
        this.odontology.listPatientConsents(this.selectedClientId, {
          patientId: this.consentPatientFilter,
          status: this.consentStatusFilter,
          search: this.consentSearchTerm
        })
      ]);
      this.patients = patients;
      this.appointments = appointments;
      this.consentTemplates = templates;
      this.patientConsents = consents;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar los consentimientos.';
    } finally {
      this.consentsLoading = false;
      this.refreshViewSoon();
    }
  }

  startCreatePatientConsent(): void {
    this.cancelSignPatientConsent();
    this.patientConsentForm = this.emptyPatientConsentForm();
    if (this.consentPatientFilter) {
      this.patientConsentForm.patientId = this.consentPatientFilter;
      this.onConsentPatientChange();
    }
    this.consentMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  startCreateDataProcessingConsent(): void {
    this.prepareDataProcessingConsentForm(this.consentPatientFilter || '');
  }

  private prepareDataProcessingConsentForm(patientId = ''): void {
    this.cancelSignPatientConsent();
    const template = this.preferredDataProcessingConsentTemplate();
    if (!template) {
      this.consentMode = 'list';
      this.errorMessage = 'No existe una plantilla activa de tratamiento de datos personales.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.patientConsentForm = {
      ...this.emptyPatientConsentForm(),
      patientId,
      templateId: template.id
    };
    if (patientId) this.onConsentPatientChange();
    this.consentMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
    this.scrollToSelector('.consent-form');
  }

  cancelPatientConsentForm(): void {
    this.consentMode = 'list';
    this.patientConsentForm = this.emptyPatientConsentForm();
    this.refreshViewSoon();
  }

  onConsentPatientChange(): void {
    const patient = this.patients.find((item) => item.id === this.patientConsentForm.patientId);
    if (!patient) return;
    if (this.patientConsentForm.appointmentId && !this.selectedConsentPatientAppointments.some((appointment) => appointment.id === this.patientConsentForm.appointmentId)) {
      this.patientConsentForm.appointmentId = '';
    }
    if (!this.patientConsentForm.signerName.trim()) {
      this.patientConsentForm.signerName = patient.guardian_name || patient.full_name;
    }
    if (!this.patientConsentForm.signerDocumentNumber.trim()) {
      this.patientConsentForm.signerDocumentNumber = patient.guardian_document_number || patient.document_number;
      this.patientConsentForm.signerDocumentType = patient.guardian_document_type || patient.document_type || 'cedula_ciudadania';
    }
    if (!this.patientConsentForm.signerRelationship?.trim()) {
      this.patientConsentForm.signerRelationship = patient.guardian_relationship || 'Paciente';
    }
  }

  onConsentAppointmentChange(): void {
    const appointment = this.appointments.find((item) => item.id === this.patientConsentForm.appointmentId);
    if (!appointment) return;
    const template = this.preferredConsentTemplateForProcedure(appointment.procedure_type_id);
    if (template) {
      this.patientConsentForm.templateId = template.id;
    }
    this.refreshViewSoon();
  }

  async savePatientConsent(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validatePatientConsentForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }

    this.patientConsentSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      await this.odontology.createPatientConsent(this.selectedClientId, this.patientConsentPayload());
      this.successMessage = 'Consentimiento creado como borrador. Ahora puedes revisarlo y firmarlo.';
      this.cancelPatientConsentForm();
      await Promise.all([this.loadConsentData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear el consentimiento.';
    } finally {
      this.patientConsentSaving = false;
      this.refreshViewSoon();
    }
  }

  startSignPatientConsent(consent: OdontologyPatientConsentDto): void {
    if (consent.status === 'signed') return;
    this.selectedConsentToSign = consent;
    this.consentSignerSignatureDataUrl = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    this.scrollToSelector('.consent-signature-panel');
  }

  cancelSignPatientConsent(): void {
    this.selectedConsentToSign = null;
    this.consentSignerSignatureDataUrl = '';
    this.consentSignatureDrawing = false;
    this.refreshViewSoon();
  }

  startConsentSignatureDraw(event: PointerEvent): void {
    event.preventDefault();
    const canvas = event.currentTarget as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    this.consentSignatureDrawing = true;
    canvas.setPointerCapture?.(event.pointerId);
    context.strokeStyle = '#0f172a';
    context.lineWidth = 3.2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    const point = this.consentSignaturePoint(event, canvas);
    context.moveTo(point.x, point.y);
  }

  drawConsentSignature(event: PointerEvent): void {
    if (!this.consentSignatureDrawing) return;
    event.preventDefault();
    const canvas = event.currentTarget as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    const point = this.consentSignaturePoint(event, canvas);
    context.lineTo(point.x, point.y);
    context.stroke();
    this.consentSignerSignatureDataUrl = canvas.toDataURL('image/png');
  }

  endConsentSignatureDraw(event?: PointerEvent): void {
    if (event?.currentTarget && event.pointerId !== undefined) {
      const canvas = event.currentTarget as HTMLCanvasElement;
      canvas.releasePointerCapture?.(event.pointerId);
    }
    this.consentSignatureDrawing = false;
  }

  clearConsentSignature(canvas?: HTMLCanvasElement | null): void {
    if (canvas) {
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.consentSignerSignatureDataUrl = '';
    this.consentSignatureDrawing = false;
    this.refreshViewSoon();
  }

  private consentSignaturePoint(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  async signPatientConsent(): Promise<void> {
    if (!this.selectedClientId || !this.selectedConsentToSign) return;
    if (!this.consentSignerSignatureDataUrl) {
      this.errorMessage = 'Dibuja la firma del paciente o acudiente antes de finalizar.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    const consent = this.selectedConsentToSign;
    if (!confirm('¿Firmar este consentimiento? Se generará el PDF y quedará bloqueado.')) return;
    this.consentSigning = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const signed = await this.odontology.signPatientConsent(this.selectedClientId, consent.id, this.consentSignerSignatureDataUrl);
      this.successMessage = 'Consentimiento firmado y PDF generado correctamente.';
      this.cancelSignPatientConsent();
      await Promise.all([this.loadConsentData(), this.reloadBootstrapOnly()]);
      if (signed.pdf_path) this.openConsentPdf(signed.pdf_path);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo firmar el consentimiento.';
    } finally {
      this.consentSigning = false;
      this.refreshViewSoon();
    }
  }

  async saveSettings(): Promise<void> {
    if (!this.selectedClientId || !this.canManageSettings) return;
    this.settingsSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload: OdontologySettingsPayload = {
        ...this.settingsForm,
        requiredPatientFields: this.normalizePatientRequiredFields(this.settingsForm.requiredPatientFields)
      };
      const settings = await this.odontology.updateSettings(this.selectedClientId, payload);
      if (this.bootstrap) {
        this.bootstrap = { ...this.bootstrap, settings };
      } else {
        await this.reloadBootstrapOnly();
      }
      this.settingsForm = this.settingsPayloadFromBootstrap();
      this.successMessage = 'Configuración odontológica actualizada correctamente.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar la configuración odontológica.';
    } finally {
      this.settingsSaving = false;
      this.refreshViewSoon();
    }
  }

  resetSettingsForm(): void {
    this.settingsForm = this.settingsPayloadFromBootstrap();
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  async loadSettingsData(): Promise<void> {
    await Promise.all([this.loadCatalogData(), this.loadScheduleData()]);
  }

  async loadScheduleData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageSettings) return;
    this.scheduleLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      const [dentists, schedules] = await Promise.all([
        this.odontology.listDentists(this.selectedClientId),
        this.odontology.listDentistSchedules(this.selectedClientId)
      ]);
      this.dentists = dentists;
      this.dentistSchedules = schedules;
      if (!this.selectedScheduleDentistId && dentists.length) {
        this.selectedScheduleDentistId = dentists[0].id;
      }
      this.scheduleFormRows = this.scheduleRowsForSelectedDentist();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron cargar los horarios odontológicos.';
    } finally {
      this.scheduleLoading = false;
      this.refreshViewSoon();
    }
  }

  onScheduleDentistChange(): void {
    this.scheduleFormRows = this.scheduleRowsForSelectedDentist();
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  addScheduleRow(): void {
    this.scheduleFormRows = [
      ...this.scheduleFormRows,
      {
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '17:00',
        isActive: true
      }
    ];
    this.refreshViewSoon();
  }

  applyWeekdaySchedule(): void {
    this.scheduleFormRows = [1, 2, 3, 4, 5].map((day) => ({
      dayOfWeek: day,
      startTime: '08:00',
      endTime: '17:00',
      isActive: true
    }));
    this.refreshViewSoon();
  }

  removeScheduleRow(index: number): void {
    this.scheduleFormRows = this.scheduleFormRows.filter((_, rowIndex) => rowIndex !== index);
    this.refreshViewSoon();
  }

  async saveDentistSchedules(): Promise<void> {
    if (!this.selectedClientId || !this.canManageSettings || !this.selectedScheduleDentistId) return;
    this.scheduleSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = this.scheduleFormRows.map((row) => ({
        dayOfWeek: Number(row.dayOfWeek),
        startTime: this.timeInputValue(row.startTime),
        endTime: this.timeInputValue(row.endTime),
        isActive: row.isActive
      }));
      const schedules = await this.odontology.replaceDentistSchedules(
        this.selectedClientId,
        this.selectedScheduleDentistId,
        payload
      );
      this.dentistSchedules = [
        ...this.dentistSchedules.filter((row) => row.dentist_user_id !== this.selectedScheduleDentistId),
        ...schedules
      ];
      this.scheduleFormRows = this.scheduleRowsForSelectedDentist();
      this.successMessage = 'Horarios del odontólogo actualizados correctamente.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron guardar los horarios del odontólogo.';
    } finally {
      this.scheduleSaving = false;
      this.refreshViewSoon();
    }
  }

  async loadCatalogData(): Promise<void> {
    if (!this.selectedClientId || !this.canManageSettings) return;
    this.catalogLoading = true;
    this.errorMessage = '';
    this.refreshViewSoon();
    try {
      this.catalogItems = await this.odontology.listCatalog(this.selectedClientId, this.selectedCatalogType);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo cargar el catálogo odontológico.';
    } finally {
      this.catalogLoading = false;
      this.refreshViewSoon();
    }
  }

  onCatalogTypeChange(): void {
    this.cancelCatalogEdit();
    void this.loadCatalogData();
  }

  startCreateCatalogItem(): void {
    this.editingCatalogItemId = null;
    this.catalogForm = this.emptyCatalogForm();
    this.catalogForm.catalogType = this.selectedCatalogType;
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  editCatalogItem(item: OdontologyCatalogItemDto): void {
    this.editingCatalogItemId = item.id;
    this.catalogForm = {
      catalogType: item.catalog_type,
      name: item.name,
      description: item.description ?? '',
      color: item.color || '#a64045',
      isActive: item.is_active
    };
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelCatalogEdit(): void {
    this.editingCatalogItemId = null;
    this.catalogForm = this.emptyCatalogForm();
    this.catalogForm.catalogType = this.selectedCatalogType;
    this.refreshViewSoon();
  }

  async saveCatalogItem(): Promise<void> {
    if (!this.selectedClientId || !this.canManageSettings) return;
    if (!this.catalogForm.name.trim()) {
      this.errorMessage = 'Nombre del elemento obligatorio.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.catalogSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload: OdontologyCatalogItemPayload = {
        catalogType: this.selectedCatalogType,
        name: this.catalogForm.name.trim(),
        description: this.catalogForm.description?.trim() || null,
        color: this.catalogForm.color || '#a64045',
        isActive: this.catalogForm.isActive
      };
      if (this.editingCatalogItemId) {
        await this.odontology.updateCatalogItem(this.selectedClientId, this.editingCatalogItemId, payload);
        this.successMessage = 'Elemento del catálogo actualizado correctamente.';
      } else {
        await this.odontology.createCatalogItem(this.selectedClientId, payload);
        this.successMessage = 'Elemento del catálogo creado correctamente.';
      }
      this.cancelCatalogEdit();
      await Promise.all([this.loadCatalogData(), this.reloadBootstrapOnly()]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el elemento del catálogo.';
    } finally {
      this.catalogSaving = false;
      this.refreshViewSoon();
    }
  }

  startCreateProcedureType(): void {
    this.editingProcedureTypeId = null;
    this.procedureForm = this.emptyProcedureForm();
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  editProcedureType(procedure: OdontologyProcedureTypeDto): void {
    this.editingProcedureTypeId = procedure.id;
    this.procedureForm = {
      name: procedure.name,
      code: procedure.code ?? '',
      category: procedure.category ?? '',
      defaultDurationMinutes: Number(procedure.default_duration_minutes || 30),
      defaultPrice: procedure.default_price ?? '',
      color: procedure.color || '#a64045',
      requiresConsent: procedure.requires_consent,
      isActive: procedure.is_active
    };
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelProcedureEdit(): void {
    this.editingProcedureTypeId = null;
    this.procedureForm = this.emptyProcedureForm();
    this.refreshViewSoon();
  }

  async saveProcedureType(): Promise<void> {
    if (!this.selectedClientId || !this.canManageSettings) return;
    if (!this.procedureForm.name.trim()) {
      this.errorMessage = 'Nombre del procedimiento obligatorio.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    if (!Number.isFinite(Number(this.procedureForm.defaultDurationMinutes)) || Number(this.procedureForm.defaultDurationMinutes) <= 0) {
      this.errorMessage = 'La duración del procedimiento debe ser mayor a cero.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.procedureSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload: OdontologyProcedureTypePayload = {
        name: this.procedureForm.name.trim(),
        code: this.procedureForm.code?.toString().trim() || null,
        category: this.procedureForm.category?.toString().trim() || null,
        defaultDurationMinutes: Number(this.procedureForm.defaultDurationMinutes),
        defaultPrice: this.procedureForm.defaultPrice === '' || this.procedureForm.defaultPrice === null
          ? null
          : this.procedureForm.defaultPrice,
        color: this.procedureForm.color || '#a64045',
        requiresConsent: this.procedureForm.requiresConsent,
        isActive: this.procedureForm.isActive
      };
      if (this.editingProcedureTypeId) {
        await this.odontology.updateProcedureType(this.selectedClientId, this.editingProcedureTypeId, payload);
        this.successMessage = 'Procedimiento actualizado correctamente.';
      } else {
        await this.odontology.createProcedureType(this.selectedClientId, payload);
        this.successMessage = 'Procedimiento creado correctamente.';
      }
      this.cancelProcedureEdit();
      await this.reloadBootstrapOnly();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el procedimiento.';
    } finally {
      this.procedureSaving = false;
      this.refreshViewSoon();
    }
  }

  startCreateConsentTemplate(): void {
    this.editingConsentTemplateId = null;
    this.consentTemplateForm = this.emptyConsentTemplateForm();
    this.consentTemplateMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  editConsentTemplate(template: OdontologyConsentTemplateDto): void {
    this.editingConsentTemplateId = template.id;
    this.consentTemplateForm = {
      title: template.title,
      body: template.body,
      procedureTypeId: template.procedure_type_id ?? '',
      version: template.version,
      isActive: template.is_active
    };
    this.consentTemplateMode = 'form';
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelConsentTemplateForm(): void {
    this.editingConsentTemplateId = null;
    this.consentTemplateMode = 'list';
    this.consentTemplateForm = this.emptyConsentTemplateForm();
    this.refreshViewSoon();
  }

  async saveConsentTemplate(): Promise<void> {
    if (!this.selectedClientId) return;
    const validationMessage = this.validateConsentTemplateForm();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.consentTemplateSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = this.consentTemplatePayload();
      if (this.editingConsentTemplateId) {
        await this.odontology.updateConsentTemplate(this.selectedClientId, this.editingConsentTemplateId, payload);
        this.successMessage = 'Plantilla de consentimiento actualizada correctamente.';
      } else {
        await this.odontology.createConsentTemplate(this.selectedClientId, payload);
        this.successMessage = 'Plantilla de consentimiento creada correctamente.';
      }
      this.cancelConsentTemplateForm();
      await this.loadConsentData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar la plantilla.';
    } finally {
      this.consentTemplateSaving = false;
      this.refreshViewSoon();
    }
  }

  consentStatusLabel(status: string): string {
    return status === 'signed' ? 'Firmado' : 'Borrador';
  }

  consentStatusClass(status: string): string {
    return status === 'signed' ? 'signed' : 'draft';
  }

  openConsentPdf(path: string | null): void {
    if (!path) return;
    window.open(joinBase(this.publicBase, path), '_blank', 'noopener');
  }

  editSite(site: { id: string; name: string; address: string | null; phone: string | null; is_active: boolean }): void {
    this.editingSiteId = site.id;
    this.siteForm = {
      name: site.name,
      address: site.address ?? '',
      phone: site.phone ?? '',
      isActive: site.is_active
    };
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelSiteEdit(): void {
    this.editingSiteId = null;
    this.siteForm = this.emptySiteForm();
    this.refreshViewSoon();
  }

  async saveSite(): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.siteForm.name.trim()) {
      this.errorMessage = 'Nombre de sede obligatorio.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.siteSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = {
        name: this.siteForm.name.trim(),
        address: this.siteForm.address.trim() || null,
        phone: this.siteForm.phone.trim() || null,
        isActive: this.siteForm.isActive
      };
      if (this.editingSiteId) {
        await this.odontology.updateSite(this.selectedClientId, this.editingSiteId, payload);
        this.successMessage = 'Sede actualizada correctamente.';
      } else {
        await this.odontology.createSite(this.selectedClientId, payload);
        this.successMessage = 'Sede creada correctamente.';
      }
      this.cancelSiteEdit();
      await this.reloadBootstrapOnly();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar la sede.';
    } finally {
      this.siteSaving = false;
      this.refreshViewSoon();
    }
  }

  editChair(chair: { id: string; site_id: string | null; name: string; code: string | null; is_active: boolean }): void {
    this.editingChairId = chair.id;
    this.chairForm = {
      name: chair.name,
      code: chair.code ?? '',
      siteId: chair.site_id ?? '',
      isActive: chair.is_active
    };
    this.successMessage = '';
    this.errorMessage = '';
    this.refreshViewSoon();
  }

  cancelChairEdit(): void {
    this.editingChairId = null;
    this.chairForm = this.emptyChairForm();
    this.refreshViewSoon();
  }

  async saveChair(): Promise<void> {
    if (!this.selectedClientId) return;
    if (!this.chairForm.name.trim()) {
      this.errorMessage = 'Nombre de unidad obligatorio.';
      this.successMessage = '';
      this.refreshViewSoon();
      return;
    }
    this.chairSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshViewSoon();
    try {
      const payload = {
        name: this.chairForm.name.trim(),
        code: this.chairForm.code.trim() || null,
        siteId: this.chairForm.siteId || null,
        isActive: this.chairForm.isActive
      };
      if (this.editingChairId) {
        await this.odontology.updateChair(this.selectedClientId, this.editingChairId, payload);
        this.successMessage = 'Unidad actualizada correctamente.';
      } else {
        await this.odontology.createChair(this.selectedClientId, payload);
        this.successMessage = 'Unidad creada correctamente.';
      }
      this.cancelChairEdit();
      await this.reloadBootstrapOnly();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar la unidad.';
    } finally {
      this.chairSaving = false;
      this.refreshViewSoon();
    }
  }

  clientLogoUrl(client: ClientOption | null): string | null {
    if (!client?.logoPath) return null;
    return joinBase(this.publicBase, client.logoPath);
  }

  private async loadOwnClient(): Promise<ClientOption | null> {
    try {
      const client = await firstValueFrom(
        this.http.get<{ name: string; nit: string; city: string; address?: string | null; email: string; logo_path?: string | null }>(
          `${this.apiBase}/clients/me?t=${Date.now()}`
        )
      );
      return {
        id: this.auth.currentUser()?.clientId ?? '',
        name: client.name,
        nit: client.nit,
        city: client.city,
        address: client.address ?? null,
        email: client.email,
        logoPath: client.logo_path ?? null
      };
    } catch {
      return null;
    }
  }

  private async reloadBootstrapOnly(): Promise<void> {
    if (!this.selectedClientId) return;
    this.bootstrap = await this.odontology.getBootstrap(this.selectedClientId);
  }

  private emptyPatientForm(): OdontologyPatientPayload {
    return {
      documentType: 'cedula_ciudadania',
      documentNumber: '',
      fullName: '',
      birthDate: '',
      sex: 'femenino',
      phone: '',
      email: '',
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      patientType: 'particular',
      payerName: '',
      authorizationRequired: false,
      status: 'Activo',
      guardianName: '',
      guardianDocumentType: 'cedula_ciudadania',
      guardianDocumentNumber: '',
      guardianPhone: '',
      guardianRelationship: '',
      allergies: '',
      medicalConditions: '',
      currentMedications: '',
      pregnancy: false,
      bleedingRisk: false,
      diabetes: false,
      hypertension: false,
      pacemaker: false,
      importantObservation: ''
    };
  }

  private emptyPatientHistory(): PatientHistoryData {
    return {
      appointments: [],
      clinicalRecords: [],
      clinicalRecordNotes: [],
      treatmentPlans: [],
      consents: [],
      prescriptions: [],
      clinicalDocuments: [],
      attachments: [],
      periodontograms: [],
      payments: [],
      odontogram: null
    };
  }

  private emptyAppointmentForm(): OdontologyAppointmentPayload {
    return {
      patientId: '',
      dentistUserId: '',
      procedureTypeId: '',
      treatmentPlanId: '',
      treatmentPlanItemId: '',
      siteId: '',
      chairId: '',
      scheduledDate: this.todayString(),
      startTime: '08:00',
      durationMinutes: 30,
      status: 'Programada',
      notes: '',
      cancellationReason: ''
    };
  }

  private emptyClinicalForm(): OdontologyClinicalRecordPayload {
    return {
      patientId: '',
      appointmentId: '',
      chiefComplaint: '',
      currentIllness: '',
      medicalHistory: '',
      dentalHistory: '',
      familyHistory: '',
      currentMedications: '',
      allergies: '',
      habits: '',
      extraoralExam: '',
      intraoralExam: '',
      diagnosisCode: '',
      diagnosisText: '',
      treatmentPlan: '',
      clinicalNotes: ''
    };
  }

  private emptyClinicalSignerForm(): {
    name: string;
    documentType: string;
    documentNumber: string;
    relationship: string;
  } {
    return {
      name: '',
      documentType: 'cedula_ciudadania',
      documentNumber: '',
      relationship: 'Paciente'
    };
  }

  private emptyClinicalNoteForm(): OdontologyClinicalRecordNotePayload {
    return {
      reason: '',
      noteText: ''
    };
  }

  private emptyTreatmentPlanForm(): OdontologyTreatmentPlanPayload {
    return {
      patientId: '',
      clinicalRecordId: '',
      title: '',
      diagnosisText: '',
      objective: '',
      notes: '',
      status: 'draft',
      items: [this.emptyTreatmentPlanItem()]
    };
  }

  private emptyTreatmentPlanSignerForm(): {
    name: string;
    documentType: string;
    documentNumber: string;
    relationship: string;
  } {
    return {
      name: '',
      documentType: 'cedula_ciudadania',
      documentNumber: '',
      relationship: 'Paciente'
    };
  }

  private emptyTreatmentPlanItem(): OdontologyTreatmentPlanItemPayload {
    return {
      procedureTypeId: '',
      procedureName: '',
      toothNumber: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      estimatedSessions: 1,
      status: 'pending'
    };
  }

  private emptyAttachmentForm(): {
    patientId: string;
    clinicalRecordId: string;
    treatmentPlanId: string;
    category: string;
    title: string;
    description: string;
    documentDate: string;
  } {
    return {
      patientId: '',
      clinicalRecordId: '',
      treatmentPlanId: '',
      category: 'radiografia',
      title: '',
      description: '',
      documentDate: this.todayString()
    };
  }

  private emptyInventoryItemForm(): OdontologyInventoryItemPayload {
    return {
      code: '',
      name: '',
      category: '',
      presentation: '',
      unit: 'unidad',
      brand: '',
      supplier: '',
      minStock: 0,
      currentStock: 0,
      unitCost: null,
      isActive: true,
      notes: ''
    };
  }

  private emptyInventoryMovementForm(): OdontologyInventoryMovementPayload {
    return {
      itemId: '',
      movementType: 'entry',
      quantity: 0,
      movementDate: this.todayString(),
      reason: '',
      reference: '',
      unitCost: null
    };
  }

  private emptySupplierForm(): OdontologySupplierPayload {
    return {
      name: '',
      nit: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      category: '',
      notes: '',
      isActive: true
    };
  }

  private emptyInventoryPurchaseForm(): OdontologyPurchaseRequestPayload {
    return {
      itemId: '',
      quantity: 1,
      neededByDate: '',
      preferredSupplier: '',
      reason: ''
    };
  }

  private emptyInstrumentForm(): OdontologyInstrumentPayload {
    return {
      code: '',
      name: '',
      category: '',
      totalQuantity: 1,
      isActive: true,
      notes: ''
    };
  }

  private emptySterilizationCycleItem(): OdontologySterilizationCycleItemPayload {
    return {
      instrumentId: '',
      quantity: 1,
      notes: ''
    };
  }

  private emptySterilizationCycleForm(): OdontologySterilizationCyclePayload {
    return {
      cycleCode: '',
      method: 'autoclave',
      cycleDate: this.todayString(),
      startTime: '',
      endTime: '',
      temperature: '',
      pressure: '',
      operatorUserId: '',
      appointmentId: '',
      biologicalIndicator: '',
      chemicalIndicator: '',
      result: 'successful',
      observations: '',
      items: [this.emptySterilizationCycleItem()]
    };
  }

  private emptyPaymentForm(): OdontologyPaymentPayload {
    return {
      patientId: '',
      treatmentPlanId: '',
      concept: 'Abono odontológico',
      amount: 0,
      paymentMethod: 'efectivo',
      paymentDate: this.todayString(),
      reference: '',
      notes: ''
    };
  }

  private emptyPrescriptionForm(): {
    patientId: string;
    clinicalRecordId: string;
    appointmentId: string;
    prescriptionDate: string;
    diagnosis: string;
    generalInstructions: string;
    items: PrescriptionItemForm[];
  } {
    return {
      patientId: '',
      clinicalRecordId: '',
      appointmentId: '',
      prescriptionDate: this.todayString(),
      diagnosis: '',
      generalInstructions: '',
      items: [this.emptyPrescriptionItem()]
    };
  }

  private emptyPrescriptionItem(): PrescriptionItemForm {
    return {
      medicationCatalogId: '',
      medicationId: null,
      medicationName: '',
      concentration: '',
      pharmaceuticalForm: '',
      dose: '',
      frequency: '',
      duration: '',
      quantity: '',
      instructions: ''
    };
  }

  private emptyMedicationForm(): OdontologyMedicationPayload {
    return {
      name: '',
      concentration: '',
      pharmaceuticalForm: '',
      defaultDose: '',
      defaultFrequency: '',
      defaultDuration: '',
      defaultInstructions: '',
      isActive: true
    };
  }

  private emptyPeriodontogramForm(): {
    patientId: string;
    clinicalRecordId: string;
    chartDate: string;
    dentition: 'permanent' | 'temporary' | 'mixed';
    notes: string;
    measurements: PeriodontalMeasurementForm[];
  } {
    return {
      patientId: '',
      clinicalRecordId: '',
      chartDate: this.todayString(),
      dentition: 'permanent',
      notes: '',
      measurements: this.periodontalTeethForDentition('permanent').map((toothNumber) => this.emptyPeriodontalMeasurement(toothNumber))
    };
  }

  private emptyPeriodontalMeasurement(toothNumber: string): PeriodontalMeasurementForm {
    return {
      toothNumber,
      probingMb: null,
      probingB: null,
      probingDb: null,
      probingMl: null,
      probingL: null,
      probingDl: null,
      recessionMb: null,
      recessionB: null,
      recessionDb: null,
      recessionMl: null,
      recessionL: null,
      recessionDl: null,
      bleedingMb: false,
      bleedingB: false,
      bleedingDb: false,
      bleedingMl: false,
      bleedingL: false,
      bleedingDl: false,
      plaque: false,
      calculus: false,
      mobility: '',
      furcation: '',
      notes: ''
    };
  }

  private emptyClinicalDocumentForm(): OdontologyClinicalDocumentPayload {
    return {
      patientId: '',
      clinicalRecordId: '',
      appointmentId: '',
      documentType: 'certificado',
      title: 'Certificado odontológico',
      documentDate: this.todayString(),
      startDate: '',
      endDate: '',
      days: null,
      body: '',
      recommendations: ''
    };
  }

  private emptyPatientConsentForm(): OdontologyPatientConsentPayload {
    return {
      patientId: '',
      templateId: '',
      appointmentId: '',
      signerName: '',
      signerDocumentType: 'cedula_ciudadania',
      signerDocumentNumber: '',
      signerRelationship: 'Paciente'
    };
  }

  private emptyConsentTemplateForm(): OdontologyConsentTemplatePayload {
    return {
      title: '',
      body: 'Yo, {{signer_name}}, identificado(a) con documento {{signer_document}}, autorizo la atención odontológica del paciente {{patient_name}} identificado con documento {{patient_document}} para el procedimiento {{procedure_name}}. Declaro que he recibido información clara sobre beneficios, riesgos, alternativas, cuidados y posibles complicaciones.',
      procedureTypeId: '',
      version: 1,
      isActive: true
    };
  }

  private defaultPatientRequiredFields(): string[] {
    return this.patientRequiredFieldOptions.map((field) => field.value);
  }

  private normalizePatientRequiredFields(fields: string[] | null | undefined): string[] {
    const validFields = new Set(this.patientRequiredFieldOptions.map((field) => field.value));
    const selected = new Set(this.patientCoreRequiredFields);
    (Array.isArray(fields) ? fields : this.defaultPatientRequiredFields()).forEach((field) => {
      if (validFields.has(field)) selected.add(field);
    });
    return this.patientRequiredFieldOptions
      .map((field) => field.value)
      .filter((field) => selected.has(field));
  }

  private emptySettingsForm(): OdontologySettingsPayload {
    return {
      allowAllPatientsForDentists: true,
      assistantCanPrefillClinical: true,
      requireDiagnosisBeforeSign: true,
      requirePlanBeforeSign: true,
      requireTreatmentPlanSignature: true,
      requireAuthorizationByDefault: false,
      autoGenerateVisitPdf: false,
      blockBiomedUnitsOutOfService: true,
      enforceDentistSchedule: false,
      enableTeleconsultation: false,
      enablePatientPortal: false,
      enableClinicalTasks: true,
      enableAdminTasks: true,
      enablePurchaseOrders: false,
      enableWhatsappReminders: false,
      whatsappProvider: '',
      whatsappBusinessPhone: '',
      whatsappDayBeforeTemplate: 'Hola {{patient_name}}, te recordamos tu cita odontológica mañana {{appointment_date}} a las {{appointment_time}}.',
      whatsappSameDayTemplate: 'Hola {{patient_name}}, te recordamos que tu cita odontológica es hoy a las {{appointment_time}}.',
      requiredPatientFields: [
        'documentType',
        'documentNumber',
        'fullName',
        'birthDate',
        'sex',
        'phone',
        'email',
        'address',
        'emergencyContactName',
        'emergencyContactPhone'
      ],
      defaultLandingPage: 'dashboard'
    };
  }

  private scheduleRowsForSelectedDentist(): OdontologyDentistSchedulePayload[] {
    return this.dentistSchedules
      .filter((row) => row.dentist_user_id === this.selectedScheduleDentistId)
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return this.timeOnly(a.start_time).localeCompare(this.timeOnly(b.start_time));
      })
      .map((row) => ({
        dayOfWeek: row.day_of_week,
        startTime: this.timeOnly(row.start_time),
        endTime: this.timeOnly(row.end_time),
        isActive: row.is_active
      }));
  }

  private timeInputValue(value: string): string {
    return this.timeOnly(value || '');
  }

  private appointmentQueryRange(): { date?: string; dateFrom?: string; dateTo?: string } {
    if (this.appointmentViewMode === 'week') {
      const range = this.appointmentWeekRange();
      return { dateFrom: range.start, dateTo: range.end };
    }
    return { date: this.appointmentDateFilter };
  }

  private appointmentReminderQueryFilters(): {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    channel?: string;
    reminderKind?: string;
    search?: string;
  } {
    return {
      ...this.appointmentQueryRange(),
      status: this.appointmentReminderStatusFilter,
      channel: this.appointmentReminderChannelFilter,
      reminderKind: this.appointmentReminderKindFilter,
      search: this.appointmentReminderSearchTerm
    };
  }

  private appointmentWeekRange(): { start: string; end: string } {
    const base = this.parseDateInput(this.appointmentDateFilter) ?? new Date();
    const weekDay = base.getDay();
    const mondayOffset = weekDay === 0 ? -6 : 1 - weekDay;
    const start = new Date(base);
    start.setDate(base.getDate() + mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start: this.formatDateObject(start),
      end: this.formatDateObject(end)
    };
  }

  private shortDateLabel(value: string): string {
    const date = this.parseDateInput(value);
    if (!date) return value;
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private settingsPayloadFromBootstrap(): OdontologySettingsPayload {
    const settings = this.bootstrap?.settings;
    if (!settings) return this.emptySettingsForm();
    return {
      allowAllPatientsForDentists: settings.allow_all_patients_for_dentists,
      assistantCanPrefillClinical: settings.assistant_can_prefill_clinical,
      requireDiagnosisBeforeSign: settings.require_diagnosis_before_sign,
      requirePlanBeforeSign: settings.require_plan_before_sign,
      requireTreatmentPlanSignature: settings.require_treatment_plan_signature,
      requireAuthorizationByDefault: settings.require_authorization_by_default,
      autoGenerateVisitPdf: settings.auto_generate_visit_pdf,
      blockBiomedUnitsOutOfService: settings.block_biomed_units_out_of_service,
      enforceDentistSchedule: settings.enforce_dentist_schedule,
      enableTeleconsultation: settings.enable_teleconsultation,
      enablePatientPortal: settings.enable_patient_portal,
      enableClinicalTasks: settings.enable_clinical_tasks,
      enableAdminTasks: settings.enable_admin_tasks,
      enablePurchaseOrders: settings.enable_purchase_orders,
      enableWhatsappReminders: settings.enable_whatsapp_reminders,
      whatsappProvider: settings.whatsapp_provider ?? '',
      whatsappBusinessPhone: settings.whatsapp_business_phone ?? '',
      whatsappDayBeforeTemplate: settings.whatsapp_day_before_template ?? '',
      whatsappSameDayTemplate: settings.whatsapp_same_day_template ?? '',
      requiredPatientFields: this.normalizePatientRequiredFields(settings.required_patient_fields),
      defaultLandingPage: settings.default_landing_page || 'dashboard'
    };
  }

  private landingPageToTab(value: string): OdontologyTab {
    const map: Record<string, OdontologyTab> = {
      dashboard: 'dashboard',
      agenda: 'agenda',
      pacientes: 'patients',
      reportes: 'reports'
    };
    const tab = map[value] ?? 'dashboard';
    if (tab === 'agenda' && !this.canManageAppointments) return 'dashboard';
    if (tab === 'patients' && !this.canManagePatients) return 'dashboard';
    if (tab === 'reports' && !this.canViewReports) return 'dashboard';
    return tab;
  }

  private emptySiteForm(): { name: string; address: string; phone: string; isActive: boolean } {
    return {
      name: '',
      address: '',
      phone: '',
      isActive: true
    };
  }

  private emptyChairForm(): { name: string; code: string; siteId: string; isActive: boolean } {
    return {
      name: '',
      code: '',
      siteId: '',
      isActive: true
    };
  }

  private emptyCatalogForm(): OdontologyCatalogItemPayload {
    return {
      catalogType: this.selectedCatalogType || 'appointment_status',
      name: '',
      description: '',
      color: '#a64045',
      isActive: true
    };
  }

  private emptyProcedureForm(): OdontologyProcedureTypePayload {
    return {
      name: '',
      code: '',
      category: '',
      defaultDurationMinutes: 30,
      defaultPrice: '',
      color: '#a64045',
      requiresConsent: false,
      isActive: true
    };
  }

  private treatmentPlanPayload(): OdontologyTreatmentPlanPayload {
    return {
      ...this.treatmentForm,
      clinicalRecordId: this.treatmentForm.clinicalRecordId || null,
      title: this.treatmentForm.title.trim(),
      diagnosisText: this.treatmentForm.diagnosisText?.trim() || null,
      objective: this.treatmentForm.objective?.trim() || null,
      notes: this.treatmentForm.notes?.trim() || null,
      items: this.treatmentForm.items.map((item) => ({
        procedureTypeId: item.procedureTypeId || null,
        procedureName: item.procedureName.trim(),
        toothNumber: item.toothNumber?.trim() || null,
        description: item.description?.trim() || null,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        estimatedSessions: Number(item.estimatedSessions || 1),
        status: item.status
      }))
    };
  }

  private validateTreatmentPlanForm(): string {
    if (!this.treatmentForm.patientId) return 'Selecciona un paciente.';
    if (!this.treatmentForm.title.trim()) return 'Titulo del plan obligatorio.';
    if (this.bootstrap?.settings.require_treatment_plan_signature && this.treatmentForm.status === 'accepted') {
      return 'Usa el botón Aceptar para firmar y aceptar el plan de tratamiento.';
    }
    if (!this.treatmentForm.items.length) return 'Agrega al menos un procedimiento.';
    const invalidIndex = this.treatmentForm.items.findIndex((item) =>
      !item.procedureName.trim() ||
      Number(item.quantity) <= 0 ||
      Number(item.unitPrice) < 0 ||
      Number(item.estimatedSessions) <= 0
    );
    if (invalidIndex >= 0) {
      return `Revisa el procedimiento ${invalidIndex + 1}: nombre, cantidad, valor y sesiones son obligatorios.`;
    }
    return '';
  }

  private validateAttachmentForm(): string {
    if (!this.attachmentForm.patientId) return 'Selecciona un paciente.';
    if (!this.attachmentForm.category) return 'Selecciona una categoría.';
    if (!this.attachmentForm.title.trim()) return 'Título del adjunto obligatorio.';
    if (!this.attachmentForm.documentDate) return 'Fecha del documento obligatoria.';
    if (!this.attachmentFile) return 'Selecciona un archivo.';
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(this.attachmentFile.type)) {
      const name = this.attachmentFile.name.toLowerCase();
      const okByExtension = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].some((ext) => name.endsWith(ext));
      if (!okByExtension) return 'Solo se permiten archivos PDF, JPG, PNG o WEBP.';
    }
    if (this.attachmentFile.size > 15 * 1024 * 1024) return 'El archivo no puede superar 15 MB.';
    return '';
  }

  private inventoryItemPayload(): OdontologyInventoryItemPayload {
    return {
      code: this.inventoryItemForm.code?.trim() || null,
      name: this.inventoryItemForm.name.trim(),
      category: this.inventoryItemForm.category?.trim() || null,
      presentation: this.inventoryItemForm.presentation?.trim() || null,
      unit: this.inventoryItemForm.unit.trim(),
      brand: this.inventoryItemForm.brand?.trim() || null,
      supplier: this.inventoryItemForm.supplier?.trim() || null,
      minStock: Number(this.inventoryItemForm.minStock || 0),
      currentStock: Number(this.inventoryItemForm.currentStock || 0),
      unitCost: this.inventoryItemForm.unitCost === null || this.inventoryItemForm.unitCost === undefined || String(this.inventoryItemForm.unitCost) === ''
        ? null
        : Number(this.inventoryItemForm.unitCost),
      isActive: Boolean(this.inventoryItemForm.isActive),
      notes: this.inventoryItemForm.notes?.trim() || null
    };
  }

  private validateInventoryItemForm(): string {
    if (!this.inventoryItemForm.name.trim()) return 'Nombre del insumo obligatorio.';
    if (!this.inventoryItemForm.unit.trim()) return 'Unidad obligatoria.';
    if (Number(this.inventoryItemForm.minStock) < 0) return 'El stock mínimo no puede ser negativo.';
    if (!this.editingInventoryItemId && Number(this.inventoryItemForm.currentStock) < 0) return 'El stock inicial no puede ser negativo.';
    const unitCost = this.inventoryItemForm.unitCost;
    if (unitCost !== null && unitCost !== undefined && String(unitCost) !== '' && Number(unitCost) < 0) {
      return 'El costo unitario no puede ser negativo.';
    }
    return '';
  }

  private inventoryMovementPayload(): OdontologyInventoryMovementPayload {
    return {
      itemId: this.inventoryMovementForm.itemId,
      movementType: this.inventoryMovementForm.movementType,
      quantity: Number(this.inventoryMovementForm.quantity || 0),
      movementDate: this.inventoryMovementForm.movementDate,
      reason: this.inventoryMovementForm.reason?.trim() || null,
      reference: this.inventoryMovementForm.reference?.trim() || null,
      unitCost: this.inventoryMovementForm.unitCost === null || this.inventoryMovementForm.unitCost === undefined || String(this.inventoryMovementForm.unitCost) === ''
        ? null
        : Number(this.inventoryMovementForm.unitCost)
    };
  }

  private validateInventoryMovementForm(): string {
    if (!this.inventoryMovementForm.itemId) return 'Selecciona un insumo.';
    if (!this.inventoryMovementForm.movementDate) return 'Fecha del movimiento obligatoria.';
    if (this.inventoryMovementForm.movementType !== 'adjustment' && Number(this.inventoryMovementForm.quantity) <= 0) {
      return 'La cantidad debe ser mayor a cero.';
    }
    if (this.inventoryMovementForm.movementType === 'adjustment' && Number(this.inventoryMovementForm.quantity) < 0) {
      return 'El stock físico no puede ser negativo.';
    }
    const unitCost = this.inventoryMovementForm.unitCost;
    if (unitCost !== null && unitCost !== undefined && String(unitCost) !== '' && Number(unitCost) < 0) {
      return 'El costo unitario no puede ser negativo.';
    }
    return '';
  }

  private supplierPayload(): OdontologySupplierPayload {
    return {
      name: this.supplierForm.name.trim(),
      nit: this.supplierForm.nit?.trim() || null,
      contactName: this.supplierForm.contactName?.trim() || null,
      phone: this.supplierForm.phone?.trim() || null,
      email: this.supplierForm.email?.trim() || null,
      address: this.supplierForm.address?.trim() || null,
      category: this.supplierForm.category?.trim() || null,
      notes: this.supplierForm.notes?.trim() || null,
      isActive: Boolean(this.supplierForm.isActive)
    };
  }

  private validateSupplierForm(): string {
    if (!this.supplierForm.name.trim()) return 'Nombre del proveedor obligatorio.';
    return '';
  }

  private inventoryPurchasePayload(): OdontologyPurchaseRequestPayload {
    return {
      itemId: this.inventoryPurchaseForm.itemId,
      quantity: Number(this.inventoryPurchaseForm.quantity || 0),
      neededByDate: this.inventoryPurchaseForm.neededByDate || null,
      preferredSupplier: this.inventoryPurchaseForm.preferredSupplier?.trim() || null,
      reason: this.inventoryPurchaseForm.reason?.trim() || null
    };
  }

  private validateInventoryPurchaseForm(): string {
    if (!this.inventoryPurchaseForm.itemId) return 'Selecciona un insumo.';
    if (Number(this.inventoryPurchaseForm.quantity) <= 0) return 'La cantidad solicitada debe ser mayor a cero.';
    return '';
  }

  private inventoryKitPayload(): OdontologyProcedureInventoryKitItemPayload[] {
    return this.inventoryKitItems
      .filter((item) => item.itemId)
      .map((item) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity || 0),
        isActive: Boolean(item.isActive),
        notes: item.notes?.trim() || null
      }));
  }

  private validateInventoryKitForm(): string {
    if (!this.inventoryKitProcedureId) return 'Selecciona el procedimiento.';
    const filledItems = this.inventoryKitItems.filter((item) => item.itemId);
    const seen = new Set<string>();
    for (const [index, item] of filledItems.entries()) {
      if (seen.has(item.itemId)) return 'No repitas el mismo insumo en el kit.';
      seen.add(item.itemId);
      if (Number(item.quantity) <= 0) return `La cantidad del insumo ${index + 1} debe ser mayor a cero.`;
    }
    return '';
  }

  private instrumentPayload(): OdontologyInstrumentPayload {
    return {
      code: this.instrumentForm.code?.trim() || null,
      name: this.instrumentForm.name.trim(),
      category: this.instrumentForm.category?.trim() || null,
      totalQuantity: Number(this.instrumentForm.totalQuantity || 0),
      isActive: Boolean(this.instrumentForm.isActive),
      notes: this.instrumentForm.notes?.trim() || null
    };
  }

  private validateInstrumentForm(): string {
    if (!this.instrumentForm.name.trim()) return 'Nombre del instrumental obligatorio.';
    if (Number(this.instrumentForm.totalQuantity) < 0) return 'La cantidad no puede ser negativa.';
    return '';
  }

  private sterilizationCyclePayload(): OdontologySterilizationCyclePayload {
    return {
      cycleCode: this.sterilizationCycleForm.cycleCode?.trim() || null,
      method: this.sterilizationCycleForm.method,
      cycleDate: this.sterilizationCycleForm.cycleDate,
      startTime: this.sterilizationCycleForm.startTime || null,
      endTime: this.sterilizationCycleForm.endTime || null,
      temperature: this.sterilizationCycleForm.temperature?.trim() || null,
      pressure: this.sterilizationCycleForm.pressure?.trim() || null,
      operatorUserId: this.sterilizationCycleForm.operatorUserId || null,
      appointmentId: this.sterilizationCycleForm.appointmentId || null,
      biologicalIndicator: this.sterilizationCycleForm.biologicalIndicator?.trim() || null,
      chemicalIndicator: this.sterilizationCycleForm.chemicalIndicator?.trim() || null,
      result: this.sterilizationCycleForm.result,
      observations: this.sterilizationCycleForm.observations?.trim() || null,
      items: this.sterilizationCycleForm.items
        .filter((item) => item.instrumentId)
        .map((item) => ({
          instrumentId: item.instrumentId,
          quantity: Number(item.quantity || 0),
          notes: item.notes?.trim() || null
        }))
    };
  }

  private validateSterilizationCycleForm(): string {
    if (!this.sterilizationCycleForm.cycleDate) return 'Fecha del ciclo obligatoria.';
    const filledItems = this.sterilizationCycleForm.items.filter((item) => item.instrumentId);
    if (!filledItems.length) return 'Agrega al menos un instrumental al ciclo.';
    const seen = new Set<string>();
    for (const [index, item] of filledItems.entries()) {
      if (seen.has(item.instrumentId)) return 'No repitas el mismo instrumental en el ciclo.';
      seen.add(item.instrumentId);
      if (Number(item.quantity) <= 0) return `La cantidad del instrumental ${index + 1} debe ser mayor a cero.`;
    }
    return '';
  }

  private paymentPayload(): OdontologyPaymentPayload {
    return {
      ...this.paymentForm,
      treatmentPlanId: this.paymentForm.treatmentPlanId || null,
      concept: this.paymentForm.concept.trim(),
      amount: Number(this.paymentForm.amount || 0),
      reference: this.paymentForm.reference?.trim() || null,
      notes: this.paymentForm.notes?.trim() || null
    };
  }

  private validatePaymentForm(): string {
    if (!this.paymentForm.patientId) return 'Selecciona un paciente.';
    if (!this.paymentForm.concept.trim()) return 'Concepto obligatorio.';
    if (!this.paymentForm.paymentDate) return 'Fecha de pago obligatoria.';
    if (Number(this.paymentForm.amount) <= 0) return 'El valor debe ser mayor a cero.';
    if (!this.paymentForm.paymentMethod) return 'Selecciona un método de pago.';
    return '';
  }

  private prescriptionPayload(): OdontologyPrescriptionPayload {
    return {
      patientId: this.prescriptionForm.patientId,
      clinicalRecordId: this.prescriptionForm.clinicalRecordId || null,
      appointmentId: this.prescriptionForm.appointmentId || null,
      prescriptionDate: this.prescriptionForm.prescriptionDate,
      diagnosis: this.prescriptionForm.diagnosis.trim() || null,
      generalInstructions: this.prescriptionForm.generalInstructions.trim() || null,
      items: this.prescriptionForm.items.map((item) => ({
        medicationId: item.medicationId || null,
        medicationName: item.medicationName.trim(),
        concentration: item.concentration?.trim() || null,
        pharmaceuticalForm: item.pharmaceuticalForm?.trim() || null,
        dose: item.dose.trim(),
        frequency: item.frequency.trim(),
        duration: item.duration.trim(),
        quantity: item.quantity?.trim() || null,
        instructions: item.instructions?.trim() || null
      }))
    };
  }

  private validatePrescriptionForm(): string {
    if (!this.prescriptionForm.patientId) return 'Selecciona un paciente.';
    if (!this.prescriptionForm.prescriptionDate) return 'Fecha de receta obligatoria.';
    if (!this.prescriptionForm.items.length) return 'Agrega al menos un medicamento.';
    const invalidIndex = this.prescriptionForm.items.findIndex((item) =>
      !item.medicationName.trim() ||
      !item.dose.trim() ||
      !item.frequency.trim() ||
      !item.duration.trim()
    );
    if (invalidIndex >= 0) {
      return `Revisa el medicamento ${invalidIndex + 1}: nombre, dosis, frecuencia y duración son obligatorios.`;
    }
    return '';
  }

  private medicationPayload(): OdontologyMedicationPayload {
    return {
      name: this.medicationForm.name.trim(),
      concentration: this.medicationForm.concentration?.trim() || null,
      pharmaceuticalForm: this.medicationForm.pharmaceuticalForm?.trim() || null,
      defaultDose: this.medicationForm.defaultDose?.trim() || null,
      defaultFrequency: this.medicationForm.defaultFrequency?.trim() || null,
      defaultDuration: this.medicationForm.defaultDuration?.trim() || null,
      defaultInstructions: this.medicationForm.defaultInstructions?.trim() || null,
      isActive: this.medicationForm.isActive
    };
  }

  private clinicalDocumentPayload(): OdontologyClinicalDocumentPayload {
    return {
      patientId: this.clinicalDocumentForm.patientId,
      clinicalRecordId: this.clinicalDocumentForm.clinicalRecordId || null,
      appointmentId: this.clinicalDocumentForm.appointmentId || null,
      documentType: this.clinicalDocumentForm.documentType,
      title: this.clinicalDocumentForm.title.trim(),
      documentDate: this.clinicalDocumentForm.documentDate,
      startDate: this.clinicalDocumentForm.startDate || null,
      endDate: this.clinicalDocumentForm.endDate || null,
      days: this.clinicalDocumentForm.days === null || this.clinicalDocumentForm.days === undefined
        ? null
        : Number(this.clinicalDocumentForm.days),
      body: this.clinicalDocumentForm.body.trim(),
      recommendations: this.clinicalDocumentForm.recommendations?.trim() || null
    };
  }

  private validateClinicalDocumentForm(): string {
    if (!this.clinicalDocumentForm.patientId) return 'Selecciona un paciente.';
    if (!this.clinicalDocumentForm.documentType) return 'Selecciona el tipo de documento.';
    if (!this.clinicalDocumentForm.title.trim()) return 'Título obligatorio.';
    if (!this.clinicalDocumentForm.documentDate) return 'Fecha del documento obligatoria.';
    if (!this.clinicalDocumentForm.body.trim()) return 'Contenido obligatorio.';
    if (this.clinicalDocumentForm.documentType === 'incapacidad') {
      if (!this.clinicalDocumentForm.startDate || !this.clinicalDocumentForm.endDate) {
        return 'Para incapacidades, indica fecha inicial y final.';
      }
      if (Number(this.clinicalDocumentForm.days || 0) <= 0) {
        return 'Para incapacidades, indica los días de incapacidad.';
      }
    }
    return '';
  }

  private clinicalDocumentBodyFromRecord(record: OdontologyClinicalRecordDto): string {
    const reason = record.chief_complaint?.trim();
    const diagnosis = record.diagnosis_text?.trim();
    const plan = record.treatment_plan?.trim();
    const lines = [
      `Se certifica que el paciente ${record.patient_name}, identificado con documento ${record.patient_document_number}, fue valorado en consulta odontológica.`,
      reason ? `Motivo de consulta: ${reason}.` : '',
      diagnosis ? `Diagnóstico / impresión clínica: ${diagnosis}.` : '',
      plan ? `Plan de manejo indicado: ${plan}.` : '',
      'Este documento se expide a solicitud del interesado para los fines pertinentes.'
    ].filter(Boolean);
    return lines.join('\n\n');
  }

  private periodontogramPayload(): OdontologyPeriodontogramPayload {
    return {
      patientId: this.periodontogramForm.patientId,
      clinicalRecordId: this.periodontogramForm.clinicalRecordId || null,
      chartDate: this.periodontogramForm.chartDate,
      dentition: this.periodontogramForm.dentition,
      notes: this.periodontogramForm.notes.trim() || null,
      measurements: this.periodontogramForm.measurements.map((item) => ({
        toothNumber: item.toothNumber,
        probingMb: this.numberOrNull(item.probingMb),
        probingB: this.numberOrNull(item.probingB),
        probingDb: this.numberOrNull(item.probingDb),
        probingMl: this.numberOrNull(item.probingMl),
        probingL: this.numberOrNull(item.probingL),
        probingDl: this.numberOrNull(item.probingDl),
        recessionMb: this.numberOrNull(item.recessionMb),
        recessionB: this.numberOrNull(item.recessionB),
        recessionDb: this.numberOrNull(item.recessionDb),
        recessionMl: this.numberOrNull(item.recessionMl),
        recessionL: this.numberOrNull(item.recessionL),
        recessionDl: this.numberOrNull(item.recessionDl),
        bleedingMb: Boolean(item.bleedingMb),
        bleedingB: Boolean(item.bleedingB),
        bleedingDb: Boolean(item.bleedingDb),
        bleedingMl: Boolean(item.bleedingMl),
        bleedingL: Boolean(item.bleedingL),
        bleedingDl: Boolean(item.bleedingDl),
        plaque: Boolean(item.plaque),
        calculus: Boolean(item.calculus),
        mobility: item.mobility?.trim() || null,
        furcation: item.furcation?.trim() || null,
        notes: item.notes?.trim() || null
      }))
    };
  }

  private validatePeriodontogramForm(): string {
    if (!this.periodontogramForm.patientId) return 'Selecciona un paciente.';
    if (!this.periodontogramForm.chartDate) return 'Fecha del periodontograma obligatoria.';
    if (!this.periodontogramForm.measurements.length) return 'No hay dientes para registrar.';
    const hasAnyValue = this.periodontogramForm.measurements.some((item) =>
      item.probingMb !== null || item.probingB !== null || item.probingDb !== null ||
      item.probingMl !== null || item.probingL !== null || item.probingDl !== null ||
      item.recessionMb !== null || item.recessionB !== null || item.recessionDb !== null ||
      item.recessionMl !== null || item.recessionL !== null || item.recessionDl !== null ||
      item.bleedingMb || item.bleedingB || item.bleedingDb || item.bleedingMl || item.bleedingL || item.bleedingDl ||
      item.plaque || item.calculus || String(item.mobility || '').trim() || String(item.furcation || '').trim() || String(item.notes || '').trim()
    );
    if (!hasAnyValue) return 'Registra al menos una medición o hallazgo.';
    return '';
  }

  private periodontalTeethForDentition(dentition: 'permanent' | 'temporary' | 'mixed'): string[] {
    if (dentition === 'temporary') {
      return ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65', '85', '84', '83', '82', '81', '71', '72', '73', '74', '75'];
    }
    if (dentition === 'mixed') {
      return ['16', '55', '54', '53', '52', '51', '61', '62', '63', '64', '65', '26', '46', '85', '84', '83', '82', '81', '71', '72', '73', '74', '75', '36'];
    }
    return ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28', '48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
  }

  private numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private patientConsentPayload(): OdontologyPatientConsentPayload {
    return {
      ...this.patientConsentForm,
      appointmentId: this.patientConsentForm.appointmentId || null,
      signerName: this.patientConsentForm.signerName.trim(),
      signerDocumentNumber: this.patientConsentForm.signerDocumentNumber.trim(),
      signerRelationship: this.patientConsentForm.signerRelationship?.trim() || null
    };
  }

  private validatePatientConsentForm(): string {
    const required = [
      ['paciente', this.patientConsentForm.patientId],
      ['plantilla', this.patientConsentForm.templateId],
      ['nombre del firmante', this.patientConsentForm.signerName],
      ['tipo de documento del firmante', this.patientConsentForm.signerDocumentType],
      ['número de documento del firmante', this.patientConsentForm.signerDocumentNumber]
    ];
    const missing = required.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
    if (missing.length) return `Campos obligatorios: ${missing.join(', ')}.`;
    return '';
  }

  private preferredConsentTemplateForPlan(plan: OdontologyTreatmentPlanDto): OdontologyConsentTemplateDto | null {
    const activeTemplates = this.activeConsentTemplates;
    if (!activeTemplates.length) return null;
    const procedureIds = (plan.items || [])
      .map((item) => item.procedure_type_id)
      .filter((id): id is string => Boolean(id));
    return activeTemplates.find((template) => template.procedure_type_id && procedureIds.includes(template.procedure_type_id)) ??
      activeTemplates.find((template) => !template.procedure_type_id) ??
      activeTemplates[0];
  }

  private preferredGeneralConsentTemplate(): OdontologyConsentTemplateDto | null {
    const activeTemplates = this.activeConsentTemplates;
    if (!activeTemplates.length) return null;
    return activeTemplates.find((template) => !template.procedure_type_id) ?? activeTemplates[0];
  }

  private preferredConsentTemplateForProcedure(procedureTypeId: string | null | undefined): OdontologyConsentTemplateDto | null {
    const activeTemplates = this.activeConsentTemplates.filter((template) => !this.isDataProcessingConsentTemplate(template));
    if (!activeTemplates.length) return null;
    if (procedureTypeId) {
      const specificTemplate = activeTemplates.find((template) => template.procedure_type_id === procedureTypeId);
      if (specificTemplate) return specificTemplate;
    }
    return activeTemplates.find((template) => !template.procedure_type_id) ?? activeTemplates[0];
  }

  private preferredDataProcessingConsentTemplate(): OdontologyConsentTemplateDto | null {
    const activeTemplates = this.activeConsentTemplates;
    if (!activeTemplates.length) return null;
    return activeTemplates.find((template) => this.isDataProcessingConsentTemplate(template)) ?? null;
  }

  private isDataProcessingConsentTemplate(template: OdontologyConsentTemplateDto): boolean {
    const key = this.normalizeStatusKey(template.title);
    return key.includes('tratamiento-de-datos-personales') || key.includes('datos-personales');
  }

  private consentTemplatePayload(): OdontologyConsentTemplatePayload {
    return {
      ...this.consentTemplateForm,
      title: this.consentTemplateForm.title.trim(),
      body: this.consentTemplateForm.body.trim(),
      procedureTypeId: this.consentTemplateForm.procedureTypeId || null,
      version: Number(this.consentTemplateForm.version || 1),
      isActive: this.consentTemplateForm.isActive
    };
  }

  private validateConsentTemplateForm(): string {
    if (!this.consentTemplateForm.title.trim()) return 'Título de plantilla obligatorio.';
    if (!this.consentTemplateForm.body.trim()) return 'Texto de consentimiento obligatorio.';
    const version = Number(this.consentTemplateForm.version);
    if (!Number.isFinite(version) || version < 1) return 'La versión debe ser mayor o igual a 1.';
    return '';
  }

  private patientPayload(): OdontologyPatientPayload {
    const payload = {
      ...this.patientForm,
      documentNumber: this.patientForm.documentNumber.trim(),
      fullName: this.patientForm.fullName.trim(),
      phone: this.patientForm.phone.trim(),
      email: this.patientForm.email.trim(),
      address: this.patientForm.address.trim(),
      emergencyContactName: this.patientForm.emergencyContactName.trim(),
      emergencyContactPhone: this.patientForm.emergencyContactPhone.trim(),
      payerName: this.patientForm.payerName?.trim() || null,
      guardianName: this.patientForm.guardianName?.trim() || null,
      guardianDocumentNumber: this.patientForm.guardianDocumentNumber?.trim() || null,
      guardianPhone: this.patientForm.guardianPhone?.trim() || null,
      guardianRelationship: this.patientForm.guardianRelationship?.trim() || null,
      allergies: this.patientForm.allergies?.trim() || null,
      medicalConditions: this.patientForm.medicalConditions?.trim() || null,
      currentMedications: this.patientForm.currentMedications?.trim() || null,
      importantObservation: this.patientForm.importantObservation?.trim() || null
    };
    this.ensurePatientAuthorizationByAge(payload);
    return payload;
  }

  private validatePatientForm(): string {
    const values: Record<string, string> = {
      documentType: this.patientForm.documentType,
      documentNumber: this.patientForm.documentNumber,
      fullName: this.patientForm.fullName,
      birthDate: this.patientForm.birthDate,
      sex: this.patientForm.sex,
      phone: this.patientForm.phone,
      email: this.patientForm.email,
      address: this.patientForm.address,
      emergencyContactName: this.patientForm.emergencyContactName,
      emergencyContactPhone: this.patientForm.emergencyContactPhone
    };
    const labels: Record<string, string> = {
      documentType: 'tipo de documento',
      documentNumber: 'número de documento',
      fullName: 'nombre completo',
      birthDate: 'fecha de nacimiento',
      sex: 'sexo',
      phone: 'teléfono',
      email: 'correo',
      address: 'dirección',
      emergencyContactName: 'contacto de emergencia',
      emergencyContactPhone: 'teléfono de emergencia'
    };
    const missing = Object.entries(values)
      .filter(([field, value]) => this.patientFieldRequired(field) && !String(value || '').trim())
      .map(([field]) => labels[field] ?? field);
    if (missing.length) return `Campos obligatorios: ${missing.join(', ')}.`;
    if (this.patientForm.email && !this.patientForm.email.includes('@')) return 'Correo inválido.';
    if (this.patientIsMinor) {
      const guardianMissing = [
        ['nombre del acudiente', this.patientForm.guardianName],
        ['teléfono del acudiente', this.patientForm.guardianPhone],
        ['parentesco del acudiente', this.patientForm.guardianRelationship]
      ].filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
      if (guardianMissing.length) return `Paciente menor de edad. Campos obligatorios: ${guardianMissing.join(', ')}.`;
    }
    return '';
  }

  private setPatientImportMessage(message: string, type: 'info' | 'success' | 'error'): void {
    this.patientImportMessage = message;
    this.patientImportMessageType = type;
  }

  private buildPatientImportPreview(rows: Record<string, unknown>[]): PatientImportPreviewRow[] {
    const previews = rows.map((row, index) => {
      const result = this.patientImportPayloadFromRow(row);
      return {
        rowNumber: index + 2,
        originalRow: row,
        payload: result.payload,
        errors: result.errors
      };
    });
    const keyCounts = new Map<string, number>();
    previews.forEach((preview) => {
      if (!preview.payload) return;
      const key = `${preview.payload.documentType}|${preview.payload.documentNumber}`.toLowerCase();
      keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
    });
    previews.forEach((preview) => {
      if (!preview.payload) return;
      const key = `${preview.payload.documentType}|${preview.payload.documentNumber}`.toLowerCase();
      if ((keyCounts.get(key) || 0) > 1) preview.errors.push('Documento repetido dentro del archivo');
    });
    return previews;
  }

  private patientImportPayloadFromRow(row: Record<string, unknown>): { payload: OdontologyPatientPayload | null; errors: string[] } {
    const errors: string[] = [];
    const documentType = this.optionValueFromImport(
      this.patientImportValue(row, 'Tipo documento*'),
      this.documentTypes,
      'Tipo documento',
      errors,
      true
    );
    const sex = this.optionValueFromImport(this.patientImportValue(row, 'Sexo*'), this.sexOptions, 'Sexo', errors, true);
    const patientType = this.optionValueFromImport(
      this.patientImportValue(row, 'Tipo paciente'),
      this.patientTypes,
      'Tipo paciente',
      errors,
      false
    ) || 'particular';
    const guardianDocumentType = this.optionValueFromImport(
      this.patientImportValue(row, 'Tipo documento acudiente'),
      this.documentTypes,
      'Tipo documento acudiente',
      errors,
      false
    );
    const status = this.importString(this.patientImportValue(row, 'Estado')) || 'Activo';
    const payload: OdontologyPatientPayload = {
      documentType,
      documentNumber: this.importString(this.patientImportValue(row, 'Número documento*')),
      fullName: this.importString(this.patientImportValue(row, 'Nombre completo*')),
      birthDate: this.importDateString(this.patientImportValue(row, 'Fecha nacimiento*')),
      sex,
      phone: this.importString(this.patientImportValue(row, 'Teléfono*')),
      email: this.importString(this.patientImportValue(row, 'Correo*')),
      address: this.importString(this.patientImportValue(row, 'Dirección*')),
      emergencyContactName: this.importString(this.patientImportValue(row, 'Contacto emergencia*')),
      emergencyContactPhone: this.importString(this.patientImportValue(row, 'Teléfono emergencia*')),
      patientType,
      payerName: this.importString(this.patientImportValue(row, 'EPS / convenio')) || null,
      authorizationRequired: this.importBoolean(this.patientImportValue(row, 'Requiere autorización')),
      status,
      guardianName: this.importString(this.patientImportValue(row, 'Nombre acudiente')) || null,
      guardianDocumentType: guardianDocumentType || null,
      guardianDocumentNumber: this.importString(this.patientImportValue(row, 'Documento acudiente')) || null,
      guardianPhone: this.importString(this.patientImportValue(row, 'Teléfono acudiente')) || null,
      guardianRelationship: this.importString(this.patientImportValue(row, 'Parentesco acudiente')) || null,
      allergies: this.importString(this.patientImportValue(row, 'Alergias')) || null,
      medicalConditions: this.importString(this.patientImportValue(row, 'Enfermedades / antecedentes')) || null,
      currentMedications: this.importString(this.patientImportValue(row, 'Medicamentos actuales')) || null,
      pregnancy: this.importBoolean(this.patientImportValue(row, 'Embarazo')),
      bleedingRisk: this.importBoolean(this.patientImportValue(row, 'Riesgo sangrado')),
      diabetes: this.importBoolean(this.patientImportValue(row, 'Diabetes')),
      hypertension: this.importBoolean(this.patientImportValue(row, 'Hipertensión')),
      pacemaker: this.importBoolean(this.patientImportValue(row, 'Marcapasos')),
      importantObservation: this.importString(this.patientImportValue(row, 'Observación importante')) || null
    };
    this.ensurePatientAuthorizationByAge(payload);
    errors.push(...this.validatePatientImportPayload(payload));
    return { payload: errors.length ? null : payload, errors };
  }

  private validatePatientImportPayload(payload: OdontologyPatientPayload): string[] {
    const values: Record<string, string> = {
      documentType: payload.documentType,
      documentNumber: payload.documentNumber,
      fullName: payload.fullName,
      birthDate: payload.birthDate,
      sex: payload.sex,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactPhone: payload.emergencyContactPhone
    };
    const labels: Record<string, string> = {
      documentType: 'Tipo documento',
      documentNumber: 'Número documento',
      fullName: 'Nombre completo',
      birthDate: 'Fecha nacimiento',
      sex: 'Sexo',
      phone: 'Teléfono',
      email: 'Correo',
      address: 'Dirección',
      emergencyContactName: 'Contacto emergencia',
      emergencyContactPhone: 'Teléfono emergencia'
    };
    const errors = Object.entries(values)
      .filter(([field, value]) => this.patientFieldRequired(field) && !String(value || '').trim())
      .map(([field]) => `${labels[field] ?? field} es obligatorio`);
    if (payload.email && !payload.email.includes('@')) errors.push('Correo inválido');
    const age = this.calculateAge(payload.birthDate);
    if (age === null || age < 0) {
      errors.push('Fecha de nacimiento inválida');
    } else if (age < 18 && (!payload.guardianName || !payload.guardianPhone || !payload.guardianRelationship)) {
      errors.push('Paciente menor de edad: acudiente, teléfono y parentesco son obligatorios');
    }
    return errors;
  }

  patientImportValue(row: Record<string, unknown>, header: string): unknown {
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header];
    const expected = this.normalizeImportKey(header);
    const key = Object.keys(row).find((current) => this.normalizeImportKey(current) === expected);
    return key ? row[key] : '';
  }

  private optionValueFromImport(
    value: unknown,
    options: Array<{ value: string; label: string }>,
    label: string,
    errors: string[],
    required: boolean
  ): string {
    const text = this.importString(value);
    if (!text) {
      if (required) errors.push(`${label} es obligatorio`);
      return '';
    }
    const normalized = this.normalizeImportKey(text);
    const match = options.find((option) =>
      this.normalizeImportKey(option.value) === normalized ||
      this.normalizeImportKey(option.label) === normalized
    );
    if (!match) {
      errors.push(`${label} no es válido`);
      return '';
    }
    return match.value;
  }

  private importString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return this.formatDateObject(value);
    return String(value).trim();
  }

  private importDateString(value: unknown): string {
    if (value instanceof Date) return this.formatDateObject(value);
    if (typeof value === 'number' && Number.isFinite(value)) {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      return this.formatDateObject(date);
    }
    const text = this.importString(value);
    if (!text) return '';
    const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }
    const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (slashMatch) {
      return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? '' : this.formatDateObject(parsed);
  }

  private importBoolean(value: unknown): boolean {
    const text = this.normalizeImportKey(this.importString(value));
    return ['si', 'sí', 'true', '1', 'x', 'activo', 'yes'].includes(text);
  }

  private importRowHasAnyValue(row: Record<string, unknown>): boolean {
    return Object.values(row).some((value) => String(value ?? '').trim() !== '');
  }

  private normalizeImportKey(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private normalizeStatusKey(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private formatDateObject(date: Date): string {
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  private styleExcelHeader(row: any): void {
    row.eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA64045' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF0CFD3' } },
        left: { style: 'thin', color: { argb: 'FFF0CFD3' } },
        bottom: { style: 'thin', color: { argb: 'FFF0CFD3' } },
        right: { style: 'thin', color: { argb: 'FFF0CFD3' } }
      };
    });
  }

  private styleExcelBody(worksheet: any): void {
    worksheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber <= 5) return;
      row.eachCell((cell: any) => {
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFF8DDE0' } },
          left: { style: 'thin', color: { argb: 'FFF8DDE0' } },
          bottom: { style: 'thin', color: { argb: 'FFF8DDE0' } },
          right: { style: 'thin', color: { argb: 'FFF8DDE0' } }
        };
      });
    });
  }

  private addReportSheet(workbook: any, name: string, headers: string[], rows: Array<Array<string | number>>): void {
    const worksheet = workbook.addWorksheet(name.substring(0, 31), {
      views: [{ state: 'frozen', ySplit: 1 }]
    });
    worksheet.columns = headers.map((header) => ({
      header,
      key: this.normalizeImportKey(header),
      width: Math.min(Math.max(header.length + 12, 18), 42)
    }));
    this.styleExcelHeader(worksheet.getRow(1));
    rows.forEach((values) => worksheet.addRow(values));
    worksheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return;
      row.eachCell((cell: any, columnNumber: number) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: typeof cell.value === 'number' || columnNumber > 1 ? 'right' : 'left',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFF8DDE0' } },
          left: { style: 'thin', color: { argb: 'FFF8DDE0' } },
          bottom: { style: 'thin', color: { argb: 'FFF8DDE0' } },
          right: { style: 'thin', color: { argb: 'FFF8DDE0' } }
        };
        if (name === 'Pagos por metodo' && columnNumber === 3) {
          cell.numFmt = '"$"#,##0';
        }
      });
    });
  }

  private appointmentPayload(): OdontologyAppointmentPayload {
    return {
      ...this.appointmentForm,
      procedureTypeId: this.appointmentForm.procedureTypeId || null,
      treatmentPlanId: this.appointmentForm.treatmentPlanId || null,
      treatmentPlanItemId: this.appointmentForm.treatmentPlanItemId || null,
      siteId: this.appointmentForm.siteId || null,
      chairId: this.appointmentForm.chairId || null,
      durationMinutes: Number(this.appointmentForm.durationMinutes || 30),
      notes: this.appointmentForm.notes?.trim() || null,
      cancellationReason: this.appointmentForm.cancellationReason?.trim() || null
    };
  }

  private appointmentPayloadFromDto(appointment: OdontologyAppointmentDto, status: string): OdontologyAppointmentPayload {
    return {
      patientId: appointment.patient_id,
      dentistUserId: appointment.dentist_user_id,
      procedureTypeId: appointment.procedure_type_id || null,
      treatmentPlanId: appointment.treatment_plan_id || null,
      treatmentPlanItemId: appointment.treatment_plan_item_id || null,
      siteId: appointment.site_id || null,
      chairId: appointment.chair_id || null,
      scheduledDate: this.dateOnly(appointment.scheduled_date),
      startTime: this.timeOnly(appointment.start_time),
      durationMinutes: Number(appointment.duration_minutes || 30),
      status,
      notes: appointment.notes || null,
      cancellationReason: appointment.cancellation_reason || null
    };
  }

  private validateAppointmentForm(): string {
    const required = [
      ['paciente', this.appointmentForm.patientId],
      ['odontólogo', this.appointmentForm.dentistUserId],
      ['fecha', this.appointmentForm.scheduledDate],
      ['hora inicial', this.appointmentForm.startTime],
      ['estado', this.appointmentForm.status]
    ];
    const missing = required.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
    if (missing.length) return `Campos obligatorios: ${missing.join(', ')}.`;
    const duration = Number(this.appointmentForm.durationMinutes);
    if (!Number.isFinite(duration) || duration < 5 || duration > 600) {
      return 'La duración debe estar entre 5 y 600 minutos.';
    }
    if (!this.appointmentEndTime) return 'La hora final debe quedar dentro del mismo día.';
    return '';
  }

  private clinicalPayload(): OdontologyClinicalRecordPayload {
    return {
      ...this.clinicalForm,
      appointmentId: this.clinicalForm.appointmentId || null,
      chiefComplaint: this.clinicalForm.chiefComplaint.trim(),
      currentIllness: this.clinicalForm.currentIllness?.trim() || null,
      medicalHistory: this.clinicalForm.medicalHistory?.trim() || null,
      dentalHistory: this.clinicalForm.dentalHistory?.trim() || null,
      familyHistory: this.clinicalForm.familyHistory?.trim() || null,
      currentMedications: this.clinicalForm.currentMedications?.trim() || null,
      allergies: this.clinicalForm.allergies?.trim() || null,
      habits: this.clinicalForm.habits?.trim() || null,
      extraoralExam: this.clinicalForm.extraoralExam?.trim() || null,
      intraoralExam: this.clinicalForm.intraoralExam?.trim() || null,
      diagnosisCode: this.clinicalForm.diagnosisCode?.trim() || null,
      diagnosisText: this.clinicalForm.diagnosisText?.trim() || null,
      treatmentPlan: this.clinicalForm.treatmentPlan?.trim() || null,
      clinicalNotes: this.clinicalForm.clinicalNotes?.trim() || null
    };
  }

  private validateClinicalForm(requireSignatureFields: boolean): string {
    if (!this.clinicalForm.patientId) return 'Selecciona un paciente.';
    if (!this.clinicalForm.chiefComplaint.trim()) return 'Motivo de consulta obligatorio.';
    if (requireSignatureFields && this.bootstrap?.settings.require_diagnosis_before_sign) {
      if (!this.clinicalForm.diagnosisText?.trim()) return 'Diagnóstico obligatorio antes de firmar.';
    }
    if (requireSignatureFields && this.bootstrap?.settings.require_plan_before_sign) {
      if (!this.clinicalForm.treatmentPlan?.trim()) return 'Plan de manejo obligatorio antes de firmar.';
    }
    return '';
  }

  private calculateAge(value: string): number | null {
    if (!value) return null;
    const birth = new Date(`${value}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  }

  private ensurePatientAuthorizationByAge(form = this.patientForm): void {
    const age = this.calculateAge(form.birthDate);
    if (age !== null && age < 18) {
      form.authorizationRequired = true;
    }
  }

  dateOnly(value: string): string {
    return String(value || '').slice(0, 10);
  }

  timeOnly(value: string): string {
    return String(value || '').slice(0, 5);
  }

  private parseDateInput(value: string): Date | null {
    const [year, month, day] = String(value || '').split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private timelineDate(dateValue: string, timeValue = '00:00'): string {
    const date = this.dateOnly(dateValue);
    const time = this.timeOnly(timeValue) || '00:00';
    return date ? `${date}T${time}:00` : this.todayString();
  }

  private timelineSortValue(value: string): number {
    const normalized = String(value || '').includes('T')
      ? String(value || '')
      : this.timelineDate(value || this.todayString());
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  private calculateEndTime(startTime: string, durationMinutes: number): string {
    if (!startTime) return '';
    const [hoursRaw, minutesRaw] = startTime.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    const duration = Number(durationMinutes || 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(duration)) return '';
    const total = hours * 60 + minutes + duration;
    if (total <= 0 || total >= 24 * 60) return '';
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  private todayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private monthStartString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private refreshViewSoon(): void {
    setTimeout(() => this.cdr.detectChanges(), 0);
  }

  private scrollToSelector(selector: string): void {
    setTimeout(() => {
      document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}
