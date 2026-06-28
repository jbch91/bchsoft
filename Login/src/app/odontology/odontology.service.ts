import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';

export interface OdontologySettingsDto {
  client_id: string;
  allow_all_patients_for_dentists: boolean;
  assistant_can_prefill_clinical: boolean;
  require_diagnosis_before_sign: boolean;
  require_plan_before_sign: boolean;
  require_treatment_plan_signature: boolean;
  require_authorization_by_default: boolean;
  auto_generate_visit_pdf: boolean;
  block_biomed_units_out_of_service: boolean;
  enforce_dentist_schedule: boolean;
  enable_teleconsultation: boolean;
  enable_patient_portal: boolean;
  enable_clinical_tasks: boolean;
  enable_admin_tasks: boolean;
  enable_purchase_orders: boolean;
  enable_whatsapp_reminders: boolean;
  whatsapp_provider: string | null;
  whatsapp_business_phone: string | null;
  whatsapp_day_before_template: string | null;
  whatsapp_same_day_template: string | null;
  required_patient_fields: string[];
  default_landing_page: string;
}

export interface OdontologySettingsPayload {
  allowAllPatientsForDentists: boolean;
  assistantCanPrefillClinical: boolean;
  requireDiagnosisBeforeSign: boolean;
  requirePlanBeforeSign: boolean;
  requireTreatmentPlanSignature: boolean;
  requireAuthorizationByDefault: boolean;
  autoGenerateVisitPdf: boolean;
  blockBiomedUnitsOutOfService: boolean;
  enforceDentistSchedule: boolean;
  enableTeleconsultation: boolean;
  enablePatientPortal: boolean;
  enableClinicalTasks: boolean;
  enableAdminTasks: boolean;
  enablePurchaseOrders: boolean;
  enableWhatsappReminders: boolean;
  whatsappProvider?: string | null;
  whatsappBusinessPhone?: string | null;
  whatsappDayBeforeTemplate?: string | null;
  whatsappSameDayTemplate?: string | null;
  requiredPatientFields: string[];
  defaultLandingPage: string;
}

export interface OdontologySiteDto {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface OdontologyChairDto {
  id: string;
  client_id: string;
  site_id: string | null;
  site_name: string | null;
  name: string;
  code: string | null;
  linked_asset_id: string | null;
  is_active: boolean;
}

export interface OdontologySitePayload {
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
}

export interface OdontologyChairPayload {
  name: string;
  code?: string | null;
  siteId?: string | null;
  isActive: boolean;
}

export interface OdontologyProcedureTypeDto {
  id: string;
  client_id: string | null;
  name: string;
  code: string | null;
  category: string | null;
  default_duration_minutes: number;
  default_price: string | null;
  color: string | null;
  requires_consent: boolean;
  is_system: boolean;
  is_active: boolean;
}

export interface OdontologyProcedureTypePayload {
  name: string;
  code?: string | null;
  category?: string | null;
  defaultDurationMinutes: number;
  defaultPrice?: string | number | null;
  color?: string | null;
  requiresConsent: boolean;
  isActive: boolean;
}

export interface OdontologyCatalogItemDto {
  id: string;
  client_id: string | null;
  catalog_type: string;
  name: string;
  description: string | null;
  color: string | null;
  is_system: boolean;
  is_active: boolean;
}

export interface OdontologyCatalogItemPayload {
  catalogType: string;
  name: string;
  description?: string | null;
  color?: string | null;
  isActive: boolean;
}

export interface OdontologyPatientDto {
  id: string;
  client_id: string;
  internal_code: string;
  document_type: string;
  document_number: string;
  full_name: string;
  birth_date: string;
  age?: number | null;
  sex: string;
  phone: string;
  email: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  patient_type: string;
  payer_name: string | null;
  authorization_required: boolean;
  status: string;
  guardian_name: string | null;
  guardian_document_type: string | null;
  guardian_document_number: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  current_medications: string | null;
  pregnancy: boolean;
  bleeding_risk: boolean;
  diabetes: boolean;
  hypertension: boolean;
  pacemaker: boolean;
  important_observation: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyPatientPayload {
  documentType: string;
  documentNumber: string;
  fullName: string;
  birthDate: string;
  sex: string;
  phone: string;
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  patientType: string;
  payerName?: string | null;
  authorizationRequired: boolean;
  status: string;
  guardianName?: string | null;
  guardianDocumentType?: string | null;
  guardianDocumentNumber?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
  allergies?: string | null;
  medicalConditions?: string | null;
  currentMedications?: string | null;
  pregnancy: boolean;
  bleedingRisk: boolean;
  diabetes: boolean;
  hypertension: boolean;
  pacemaker: boolean;
  importantObservation?: string | null;
}

export interface OdontologyDentistDto {
  id: string;
  display_name: string;
  email: string;
  is_active: boolean;
}

export interface OdontologyDentistScheduleDto {
  id: string;
  client_id: string;
  dentist_user_id: string;
  dentist_name?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OdontologyDentistSchedulePayload {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface OdontologyAppointmentDto {
  id: string;
  client_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_document_number: string;
  patient_phone: string;
  patient_email?: string | null;
  site_id: string | null;
  site_name: string | null;
  chair_id: string | null;
  chair_name: string | null;
  chair_code: string | null;
  dentist_user_id: string;
  dentist_name: string;
  procedure_type_id: string | null;
  procedure_name: string | null;
  procedure_color: string | null;
  treatment_plan_id?: string | null;
  treatment_plan_title?: string | null;
  treatment_plan_item_id?: string | null;
  treatment_plan_item_name?: string | null;
  treatment_plan_item_tooth_number?: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  cancellation_reason: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyAppointmentPayload {
  patientId: string;
  dentistUserId: string;
  procedureTypeId?: string | null;
  treatmentPlanId?: string | null;
  treatmentPlanItemId?: string | null;
  siteId?: string | null;
  chairId?: string | null;
  scheduledDate: string;
  startTime: string;
  durationMinutes: number;
  status: string;
  notes?: string | null;
  cancellationReason?: string | null;
}

export interface OdontologyAppointmentReminderDto {
  id: string;
  client_id: string;
  appointment_id: string;
  channel: 'email' | 'whatsapp';
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  subject: string | null;
  message: string;
  status: 'sent' | 'failed';
  reminder_kind: string;
  error_message: string | null;
  sent_by: string | null;
  sent_at: string;
  created_at: string;
  appointment_date?: string | null;
  appointment_start_time?: string | null;
  appointment_end_time?: string | null;
  appointment_status?: string | null;
  patient_name?: string | null;
  patient_document_number?: string | null;
  dentist_name?: string | null;
  procedure_name?: string | null;
}

export interface OdontologyClinicalRecordSterilizationCycleDto {
  id: string;
  cycle_code: string | null;
  method: 'autoclave' | 'chemical' | 'dry_heat' | 'other';
  cycle_date: string;
  start_time: string | null;
  end_time: string | null;
  result: 'successful' | 'failed' | 'pending';
  operator_name: string | null;
  item_count: number;
  pdf_path?: string | null;
}

export interface OdontologyClinicalRecordDto {
  id: string;
  client_id: string;
  patient_id: string;
  patient_code: string;
  patient_document_type?: string | null;
  patient_name: string;
  patient_document_number: string;
  patient_birth_date?: string | null;
  patient_sex?: string | null;
  patient_phone?: string | null;
  patient_email?: string | null;
  patient_address?: string | null;
  appointment_id: string | null;
  appointment_date: string | null;
  appointment_start_time: string | null;
  dentist_name: string | null;
  status: 'draft' | 'signed';
  chief_complaint: string;
  current_illness: string | null;
  medical_history: string | null;
  dental_history: string | null;
  family_history: string | null;
  current_medications: string | null;
  allergies: string | null;
  habits: string | null;
  extraoral_exam: string | null;
  intraoral_exam: string | null;
  diagnosis_code: string | null;
  diagnosis_text: string | null;
  treatment_plan: string | null;
  clinical_notes: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  patient_signer_name?: string | null;
  patient_signer_document_type?: string | null;
  patient_signer_document_number?: string | null;
  patient_signer_relationship?: string | null;
  patient_signature_path?: string | null;
  patient_signed_at?: string | null;
  signed_by_name?: string | null;
  signed_by_signature_path?: string | null;
  sterilization_cycles?: OdontologyClinicalRecordSterilizationCycleDto[];
  signed_by_document_type?: string | null;
  signed_by_document_number?: string | null;
  signed_by_invima_registration?: string | null;
  signed_at: string | null;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyClinicalRecordPayload {
  patientId: string;
  appointmentId?: string | null;
  chiefComplaint: string;
  currentIllness?: string | null;
  medicalHistory?: string | null;
  dentalHistory?: string | null;
  familyHistory?: string | null;
  currentMedications?: string | null;
  allergies?: string | null;
  habits?: string | null;
  extraoralExam?: string | null;
  intraoralExam?: string | null;
  diagnosisCode?: string | null;
  diagnosisText?: string | null;
  treatmentPlan?: string | null;
  clinicalNotes?: string | null;
}

export interface OdontologyClinicalRecordNoteDto {
  id: string;
  client_id: string;
  clinical_record_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_document_number: string;
  clinical_record_chief_complaint: string;
  clinical_record_signed_at: string | null;
  reason: string | null;
  note_text: string;
  created_by_name?: string | null;
  created_at: string;
}

export interface OdontologyClinicalRecordNotePayload {
  reason?: string | null;
  noteText: string;
}

export interface OdontologyOdontogramEntryDto {
  id: string;
  client_id: string;
  patient_id: string;
  dentition: 'permanent' | 'temporary' | 'mixed';
  tooth_number: string;
  surface: string;
  condition_item_id: string | null;
  condition_name: string;
  condition_color: string | null;
  notes: string | null;
  record_date: string;
  created_by_name?: string | null;
  created_at: string;
}

export interface OdontologyOdontogramDto {
  patient: OdontologyPatientDto;
  latest: OdontologyOdontogramEntryDto[];
  history: OdontologyOdontogramEntryDto[];
}

export interface OdontologyOdontogramPayload {
  patientId: string;
  dentition: 'permanent' | 'temporary' | 'mixed';
  toothNumber: string;
  surface: string;
  conditionItemId: string;
  notes?: string | null;
  recordDate: string;
}

export interface OdontologyPeriodontalMeasurementDto {
  id: string;
  chart_id: string;
  tooth_number: string;
  probing_mb: number | null;
  probing_b: number | null;
  probing_db: number | null;
  probing_ml: number | null;
  probing_l: number | null;
  probing_dl: number | null;
  recession_mb: number | null;
  recession_b: number | null;
  recession_db: number | null;
  recession_ml: number | null;
  recession_l: number | null;
  recession_dl: number | null;
  bleeding_mb: boolean;
  bleeding_b: boolean;
  bleeding_db: boolean;
  bleeding_ml: boolean;
  bleeding_l: boolean;
  bleeding_dl: boolean;
  plaque: boolean;
  calculus: boolean;
  mobility: string | null;
  furcation: string | null;
  notes: string | null;
  sort_order: number;
}

export interface OdontologyPeriodontogramDto {
  id: string;
  client_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_document_number: string;
  clinical_record_id: string | null;
  clinical_record_status: string | null;
  chart_date: string;
  dentition: 'permanent' | 'temporary' | 'mixed';
  notes: string | null;
  status: 'draft' | 'signed';
  created_by_name: string | null;
  measurement_count: number;
  created_at: string;
  updated_at: string;
  measurements?: OdontologyPeriodontalMeasurementDto[];
}

export interface OdontologyPeriodontalMeasurementPayload {
  toothNumber: string;
  probingMb?: number | null;
  probingB?: number | null;
  probingDb?: number | null;
  probingMl?: number | null;
  probingL?: number | null;
  probingDl?: number | null;
  recessionMb?: number | null;
  recessionB?: number | null;
  recessionDb?: number | null;
  recessionMl?: number | null;
  recessionL?: number | null;
  recessionDl?: number | null;
  bleedingMb?: boolean;
  bleedingB?: boolean;
  bleedingDb?: boolean;
  bleedingMl?: boolean;
  bleedingL?: boolean;
  bleedingDl?: boolean;
  plaque?: boolean;
  calculus?: boolean;
  mobility?: string | null;
  furcation?: string | null;
  notes?: string | null;
}

export interface OdontologyPeriodontogramPayload {
  patientId: string;
  clinicalRecordId?: string | null;
  chartDate: string;
  dentition: 'permanent' | 'temporary' | 'mixed';
  notes?: string | null;
  measurements: OdontologyPeriodontalMeasurementPayload[];
}

export interface OdontologyConsentTemplateDto {
  id: string;
  client_id: string;
  procedure_type_id: string | null;
  procedure_name: string | null;
  title: string;
  body: string;
  version: number;
  is_active: boolean;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyConsentTemplatePayload {
  title: string;
  body: string;
  procedureTypeId?: string | null;
  version: number;
  isActive: boolean;
}

export interface OdontologyPatientConsentDto {
  id: string;
  client_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_document_type: string;
  patient_document_number: string;
  appointment_id: string | null;
  appointment_date: string | null;
  appointment_start_time: string | null;
  template_id: string | null;
  procedure_type_id: string | null;
  procedure_name: string | null;
  template_title: string;
  template_version: number;
  rendered_body: string;
  status: 'draft' | 'signed';
  signer_name: string | null;
  signer_document_type: string | null;
  signer_document_number: string | null;
  signer_relationship: string | null;
  signer_signature_path: string | null;
  signed_by_name?: string | null;
  signed_by_signature_path?: string | null;
  signed_by_document_type?: string | null;
  signed_by_document_number?: string | null;
  signed_by_invima_registration?: string | null;
  signed_at: string | null;
  pdf_path: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyPatientConsentPayload {
  patientId: string;
  templateId: string;
  appointmentId?: string | null;
  signerName: string;
  signerDocumentType: string;
  signerDocumentNumber: string;
  signerRelationship?: string | null;
}

export interface OdontologyTreatmentPlanItemDto {
  id?: string;
  procedure_type_id: string | null;
  procedure_name: string;
  tooth_number: string | null;
  description: string | null;
  quantity: string | number;
  unit_price: string | number | null;
  estimated_sessions: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  sort_order: number;
}

export interface OdontologyTreatmentPlanDto {
  id: string;
  client_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_document_number: string;
  clinical_record_id: string | null;
  clinical_record_status: string | null;
  title: string;
  diagnosis_text: string | null;
  objective: string | null;
  notes: string | null;
  status: 'draft' | 'proposed' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  total_amount: string | number | null;
  paid_amount?: string | number | null;
  balance_amount?: string | number | null;
  accepted_signer_name?: string | null;
  accepted_signer_document_type?: string | null;
  accepted_signer_document_number?: string | null;
  accepted_signer_relationship?: string | null;
  accepted_signature_path?: string | null;
  accepted_at?: string | null;
  accepted_by_name?: string | null;
  created_by_signature_path?: string | null;
  items: OdontologyTreatmentPlanItemDto[];
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyTreatmentPlanItemPayload {
  procedureTypeId?: string | null;
  procedureName: string;
  toothNumber?: string | null;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  estimatedSessions: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface OdontologyTreatmentPlanPayload {
  patientId: string;
  clinicalRecordId?: string | null;
  title: string;
  diagnosisText?: string | null;
  objective?: string | null;
  notes?: string | null;
  status: 'draft' | 'proposed' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  items: OdontologyTreatmentPlanItemPayload[];
}

export interface OdontologyAttachmentDto {
  id: string;
  client_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_document_number: string;
  clinical_record_id: string | null;
  clinical_record_status: string | null;
  appointment_id: string | null;
  treatment_plan_id: string | null;
  treatment_plan_title: string | null;
  category: string;
  title: string;
  description: string | null;
  document_date: string;
  file_path: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyInventoryItemDto {
  id: string;
  client_id: string;
  code: string | null;
  name: string;
  category: string | null;
  presentation: string | null;
  unit: string;
  brand: string | null;
  supplier: string | null;
  min_stock: number;
  current_stock: number;
  unit_cost: number | null;
  is_active: boolean;
  low_stock: boolean;
  notes: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyInventoryItemPayload {
  code?: string | null;
  name: string;
  category?: string | null;
  presentation?: string | null;
  unit: string;
  brand?: string | null;
  supplier?: string | null;
  minStock: number;
  currentStock?: number;
  unitCost?: number | null;
  isActive: boolean;
  notes?: string | null;
}

export interface OdontologyInventoryMovementDto {
  id: string;
  client_id: string;
  item_id: string;
  item_name: string;
  item_code: string | null;
  item_unit: string;
  movement_type: 'entry' | 'exit' | 'adjustment';
  quantity: number;
  movement_date: string;
  reason: string | null;
  reference: string | null;
  unit_cost: number | null;
  stock_after: number;
  created_by_name?: string | null;
  created_at: string;
}

export interface OdontologyInventoryMovementPayload {
  itemId: string;
  movementType: 'entry' | 'exit' | 'adjustment';
  quantity: number;
  movementDate: string;
  reason?: string | null;
  reference?: string | null;
  unitCost?: number | null;
}

export interface OdontologySupplierDto {
  id: string;
  client_id: string;
  name: string;
  nit: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string | null;
  notes: string | null;
  is_active: boolean;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologySupplierPayload {
  name: string;
  nit?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  category?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface OdontologyPurchaseRequestDto {
  id: string;
  client_id: string;
  item_id: string;
  item_name: string;
  item_code: string | null;
  item_unit: string;
  current_stock: number;
  min_stock: number;
  quantity: number;
  needed_by_date: string | null;
  preferred_supplier: string | null;
  reason: string | null;
  status: 'requested' | 'quoted' | 'ordered' | 'received' | 'cancelled';
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyPurchaseRequestPayload {
  itemId: string;
  quantity: number;
  neededByDate?: string | null;
  preferredSupplier?: string | null;
  reason?: string | null;
}

export interface OdontologyProcedureInventoryKitDto {
  id: string;
  client_id: string;
  procedure_type_id: string;
  procedure_name: string;
  procedure_code: string | null;
  item_id: string;
  item_name: string;
  item_code: string | null;
  item_unit: string;
  current_stock: number;
  min_stock: number;
  item_is_active: boolean;
  quantity: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyProcedureInventoryKitItemPayload {
  itemId: string;
  quantity: number;
  isActive: boolean;
  notes?: string | null;
}

export interface OdontologyInstrumentDto {
  id: string;
  client_id: string;
  code: string | null;
  name: string;
  category: string | null;
  total_quantity: number;
  is_active: boolean;
  notes: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyInstrumentPayload {
  code?: string | null;
  name: string;
  category?: string | null;
  totalQuantity: number;
  isActive: boolean;
  notes?: string | null;
}

export interface OdontologySterilizationCycleItemDto {
  id: string;
  cycle_id: string;
  instrument_id: string;
  instrument_name: string;
  instrument_code: string | null;
  instrument_category: string | null;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface OdontologySterilizationCycleDto {
  id: string;
  client_id: string;
  cycle_code: string | null;
  method: 'autoclave' | 'chemical' | 'dry_heat' | 'other';
  cycle_date: string;
  start_time: string | null;
  end_time: string | null;
  temperature: string | null;
  pressure: string | null;
  operator_user_id: string | null;
  operator_name: string | null;
  appointment_id: string | null;
  appointment_date: string | null;
  appointment_start_time: string | null;
  patient_name: string | null;
  procedure_name: string | null;
  biological_indicator: string | null;
  chemical_indicator: string | null;
  result: 'successful' | 'failed' | 'pending';
  observations: string | null;
  pdf_path?: string | null;
  created_by_name?: string | null;
  item_count: number;
  items: OdontologySterilizationCycleItemDto[];
  created_at: string;
  updated_at: string;
}

export interface OdontologySterilizationCycleItemPayload {
  instrumentId: string;
  quantity: number;
  notes?: string | null;
}

export interface OdontologySterilizationCyclePayload {
  cycleCode?: string | null;
  method: 'autoclave' | 'chemical' | 'dry_heat' | 'other';
  cycleDate: string;
  startTime?: string | null;
  endTime?: string | null;
  temperature?: string | null;
  pressure?: string | null;
  operatorUserId?: string | null;
  appointmentId?: string | null;
  biologicalIndicator?: string | null;
  chemicalIndicator?: string | null;
  result: 'successful' | 'failed' | 'pending';
  observations?: string | null;
  items: OdontologySterilizationCycleItemPayload[];
}

export interface OdontologyPaymentDto {
  id: string;
  client_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_document_number: string;
  treatment_plan_id: string | null;
  treatment_plan_title: string | null;
  treatment_plan_total: string | number | null;
  concept: string;
  amount: string | number | null;
  payment_method: string;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  status: 'registered' | 'voided';
  void_reason: string | null;
  voided_by_name?: string | null;
  voided_at: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyPaymentPayload {
  patientId: string;
  treatmentPlanId?: string | null;
  concept: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string | null;
  notes?: string | null;
}

export interface OdontologyCashClosureDto {
  id: string;
  client_id: string;
  date_from: string;
  date_to: string;
  cashier_filter: string | null;
  total_registered: string | number | null;
  total_voided: string | number | null;
  registered_count: number;
  voided_count: number;
  notes: string | null;
  pdf_path: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyCashClosurePayload {
  dateFrom: string;
  dateTo: string;
  cashier?: string | null;
  notes?: string | null;
}

export interface OdontologyMedicationDto {
  id: string;
  client_id: string | null;
  name: string;
  concentration: string | null;
  pharmaceutical_form: string | null;
  default_dose: string | null;
  default_frequency: string | null;
  default_duration: string | null;
  default_instructions: string | null;
  is_active: boolean;
  is_system: boolean;
}

export interface OdontologyMedicationPayload {
  name: string;
  concentration?: string | null;
  pharmaceuticalForm?: string | null;
  defaultDose?: string | null;
  defaultFrequency?: string | null;
  defaultDuration?: string | null;
  defaultInstructions?: string | null;
  isActive: boolean;
}

export interface OdontologyPrescriptionItemDto {
  id: string;
  prescription_id: string;
  medication_id: string | null;
  medication_name: string;
  concentration: string | null;
  pharmaceutical_form: string | null;
  dose: string;
  frequency: string;
  duration: string;
  quantity: string | null;
  instructions: string | null;
  sort_order: number;
}

export interface OdontologyPrescriptionDto {
  id: string;
  client_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_document_type: string;
  patient_document_number: string;
  clinical_record_id: string | null;
  clinical_record_status: string | null;
  appointment_id: string | null;
  appointment_date: string | null;
  prescription_date: string;
  diagnosis: string | null;
  general_instructions: string | null;
  status: 'issued' | 'voided';
  pdf_path: string | null;
  issued_by_name: string | null;
  created_at: string;
  updated_at: string;
  items: OdontologyPrescriptionItemDto[];
}

export interface OdontologyPrescriptionItemPayload {
  medicationId?: string | null;
  medicationName: string;
  concentration?: string | null;
  pharmaceuticalForm?: string | null;
  dose: string;
  frequency: string;
  duration: string;
  quantity?: string | null;
  instructions?: string | null;
}

export interface OdontologyPrescriptionPayload {
  patientId: string;
  clinicalRecordId?: string | null;
  appointmentId?: string | null;
  prescriptionDate: string;
  diagnosis?: string | null;
  generalInstructions?: string | null;
  items: OdontologyPrescriptionItemPayload[];
}

export interface OdontologyClinicalDocumentDto {
  id: string;
  client_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_document_type: string;
  patient_document_number: string;
  clinical_record_id: string | null;
  clinical_record_status: string | null;
  appointment_id: string | null;
  appointment_date: string | null;
  document_type: string;
  title: string;
  document_date: string;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  body: string;
  recommendations: string | null;
  status: 'issued' | 'voided';
  pdf_path: string | null;
  issued_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface OdontologyClinicalDocumentPayload {
  patientId: string;
  clinicalRecordId?: string | null;
  appointmentId?: string | null;
  documentType: string;
  title: string;
  documentDate: string;
  startDate?: string | null;
  endDate?: string | null;
  days?: number | null;
  body: string;
  recommendations?: string | null;
}

export interface OdontologyReportStatusRowDto {
  status: string;
  total: number;
}

export interface OdontologyReportProcedureRowDto {
  name: string;
  total: number;
}

export interface OdontologyReportPaymentMethodRowDto {
  method: string;
  total: number;
  total_amount: number | null;
}

export interface OdontologyReportDentistProductionRowDto {
  dentist_name: string;
  total: number;
  attended: number;
  cancelled_or_missed: number;
}

export interface OdontologyReportCancellationRowDto {
  scheduled_date: string;
  start_time: string;
  status: string;
  cancellation_reason: string | null;
  patient_name: string;
  patient_document_number: string;
  patient_phone: string | null;
  dentist_name: string;
  procedure_name: string | null;
}

export interface OdontologyReportTreatmentValueRowDto {
  status: string;
  total: number;
  total_amount: number | null;
}

export interface OdontologyReportTreatmentFinancialRowDto {
  financial_status: 'no-value' | 'unpaid' | 'partial' | 'paid';
  total: number;
  total_amount: number | null;
  paid_amount: number | null;
  balance_amount: number | null;
}

export interface OdontologyReportRevenuePeriodRowDto {
  period_date: string;
  total: number;
  total_amount: number | null;
}

export interface OdontologyReportInventoryConsumptionRowDto {
  procedure_name: string;
  dentist_name: string;
  item_name: string;
  item_unit: string;
  appointments: number;
  total_quantity: number;
  estimated_total_cost: number | null;
}

export interface OdontologyReportDto {
  range: {
    startDate: string;
    endDate: string;
  };
  counters: {
    newPatients: number;
    appointments: number;
    attendedAppointments: number;
    cancelledOrMissedAppointments: number;
    clinicalDrafts: number;
    clinicalSigned: number;
    treatmentPlans: number;
    treatmentPlanAmount: number | null;
    payments: number;
    paymentAmount: number | null;
    consentsDraft: number;
    consentsSigned: number;
    attachments: number;
  };
  appointmentsByStatus: OdontologyReportStatusRowDto[];
  clinicalByStatus: OdontologyReportStatusRowDto[];
  consentsByStatus: OdontologyReportStatusRowDto[];
  topProcedures: OdontologyReportProcedureRowDto[];
  paymentsByMethod: OdontologyReportPaymentMethodRowDto[];
  treatmentPlansByStatus: OdontologyReportStatusRowDto[];
  productionByDentist: OdontologyReportDentistProductionRowDto[];
  cancellationsAndNoShows: OdontologyReportCancellationRowDto[];
  treatmentPlanValuesByStatus: OdontologyReportTreatmentValueRowDto[];
  treatmentPlanFinancialSummary: OdontologyReportTreatmentFinancialRowDto[];
  revenueByPeriod: OdontologyReportRevenuePeriodRowDto[];
  inventoryConsumptionByProcedureDentist: OdontologyReportInventoryConsumptionRowDto[];
}

export interface OdontologyReportDetailsDto {
  range: {
    startDate: string;
    endDate: string;
  };
  appointments: OdontologyAppointmentDto[];
  patients: OdontologyPatientDto[];
  payments: OdontologyPaymentDto[];
  reminders: OdontologyAppointmentReminderDto[];
}

export interface OdontologyDashboardDto {
  counters: {
    patients: number;
    appointmentsToday: number;
    pendingSignatures: number;
    pendingConsents: number;
    activeTreatmentPlans: number;
    paymentsToday: number | null;
    lowStockItems: number;
    sterilizationToday: number;
  };
  settings: OdontologySettingsDto;
  sites: OdontologySiteDto[];
  chairs: OdontologyChairDto[];
  procedures: OdontologyProcedureTypeDto[];
  appointmentStatuses: OdontologyCatalogItemDto[];
  patientStatuses: OdontologyCatalogItemDto[];
  toothConditions: OdontologyCatalogItemDto[];
}

@Injectable({ providedIn: 'root' })
export class OdontologyService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  async getBootstrap(clientId: string): Promise<OdontologyDashboardDto> {
    return firstValueFrom(
      this.http.get<OdontologyDashboardDto>(`${this.apiBase}/odontology/${clientId}/bootstrap`)
    );
  }

  async getReports(clientId: string, filters: { startDate?: string; endDate?: string } = {}): Promise<OdontologyReportDto> {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyReportDto>(
        `${this.apiBase}/odontology/${clientId}/reports${qs ? `?${qs}` : ''}`
      )
    );
  }

  async getReportDetails(clientId: string, filters: { startDate?: string; endDate?: string } = {}): Promise<OdontologyReportDetailsDto> {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyReportDetailsDto>(
        `${this.apiBase}/odontology/${clientId}/reports/details${qs ? `?${qs}` : ''}`
      )
    );
  }

  async getReportsPdf(clientId: string, filters: { startDate?: string; endDate?: string } = {}): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/reports/pdf${qs ? `?${qs}` : ''}`, {
        responseType: 'blob'
      })
    );
  }

  async updateSettings(clientId: string, payload: OdontologySettingsPayload): Promise<OdontologySettingsDto> {
    return firstValueFrom(
      this.http.patch<OdontologySettingsDto>(`${this.apiBase}/odontology/${clientId}/settings`, payload)
    );
  }

  async listCatalog(clientId: string, type?: string): Promise<OdontologyCatalogItemDto[]> {
    const url = type
      ? `${this.apiBase}/odontology/${clientId}/catalog?type=${encodeURIComponent(type)}`
      : `${this.apiBase}/odontology/${clientId}/catalog`;
    return firstValueFrom(this.http.get<OdontologyCatalogItemDto[]>(url));
  }

  async createProcedureType(clientId: string, payload: OdontologyProcedureTypePayload): Promise<OdontologyProcedureTypeDto> {
    return firstValueFrom(
      this.http.post<OdontologyProcedureTypeDto>(`${this.apiBase}/odontology/${clientId}/procedure-types`, payload)
    );
  }

  async updateProcedureType(clientId: string, procedureTypeId: string, payload: OdontologyProcedureTypePayload): Promise<OdontologyProcedureTypeDto> {
    return firstValueFrom(
      this.http.patch<OdontologyProcedureTypeDto>(
        `${this.apiBase}/odontology/${clientId}/procedure-types/${procedureTypeId}`,
        payload
      )
    );
  }

  async createCatalogItem(clientId: string, payload: OdontologyCatalogItemPayload): Promise<OdontologyCatalogItemDto> {
    return firstValueFrom(
      this.http.post<OdontologyCatalogItemDto>(`${this.apiBase}/odontology/${clientId}/catalog`, payload)
    );
  }

  async updateCatalogItem(clientId: string, itemId: string, payload: OdontologyCatalogItemPayload): Promise<OdontologyCatalogItemDto> {
    return firstValueFrom(
      this.http.patch<OdontologyCatalogItemDto>(`${this.apiBase}/odontology/${clientId}/catalog/${itemId}`, payload)
    );
  }

  async listPatients(clientId: string, filters: { search?: string; status?: string } = {}): Promise<OdontologyPatientDto[]> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyPatientDto[]>(
        `${this.apiBase}/odontology/${clientId}/patients${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createPatient(clientId: string, payload: OdontologyPatientPayload): Promise<OdontologyPatientDto> {
    return firstValueFrom(
      this.http.post<OdontologyPatientDto>(`${this.apiBase}/odontology/${clientId}/patients`, payload)
    );
  }

  async updatePatient(clientId: string, patientId: string, payload: OdontologyPatientPayload): Promise<OdontologyPatientDto> {
    return firstValueFrom(
      this.http.patch<OdontologyPatientDto>(
        `${this.apiBase}/odontology/${clientId}/patients/${patientId}`,
        payload
      )
    );
  }

  async importPatients(clientId: string, patients: OdontologyPatientPayload[]): Promise<{ imported: number; ids: string[] }> {
    return firstValueFrom(
      this.http.post<{ imported: number; ids: string[] }>(
        `${this.apiBase}/odontology/${clientId}/patients/import`,
        { patients }
      )
    );
  }

  async listDentists(clientId: string): Promise<OdontologyDentistDto[]> {
    return firstValueFrom(
      this.http.get<OdontologyDentistDto[]>(`${this.apiBase}/odontology/${clientId}/dentists`)
    );
  }

  async listDentistSchedules(clientId: string, dentistId = ''): Promise<OdontologyDentistScheduleDto[]> {
    const qs = dentistId ? `?dentistId=${encodeURIComponent(dentistId)}` : '';
    return firstValueFrom(
      this.http.get<OdontologyDentistScheduleDto[]>(`${this.apiBase}/odontology/${clientId}/dentist-schedules${qs}`)
    );
  }

  async replaceDentistSchedules(
    clientId: string,
    dentistId: string,
    schedules: OdontologyDentistSchedulePayload[]
  ): Promise<OdontologyDentistScheduleDto[]> {
    return firstValueFrom(
      this.http.put<OdontologyDentistScheduleDto[]>(
        `${this.apiBase}/odontology/${clientId}/dentist-schedules/${dentistId}`,
        { schedules }
      )
    );
  }

  async listAppointments(clientId: string, filters: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    dentistId?: string;
    patientId?: string;
    siteId?: string;
    chairId?: string;
    search?: string;
  } = {}): Promise<OdontologyAppointmentDto[]> {
    const params = new URLSearchParams();
    if (filters.date) params.set('date', filters.date);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.status) params.set('status', filters.status);
    if (filters.dentistId) params.set('dentistId', filters.dentistId);
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.siteId) params.set('siteId', filters.siteId);
    if (filters.chairId) params.set('chairId', filters.chairId);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyAppointmentDto[]>(
        `${this.apiBase}/odontology/${clientId}/appointments${qs ? `?${qs}` : ''}`
      )
    );
  }

  async listAppointmentReminders(clientId: string, filters: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    channel?: string;
    reminderKind?: string;
    search?: string;
  } = {}): Promise<OdontologyAppointmentReminderDto[]> {
    const params = new URLSearchParams();
    if (filters.date) params.set('date', filters.date);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.status) params.set('status', filters.status);
    if (filters.channel) params.set('channel', filters.channel);
    if (filters.reminderKind) params.set('reminderKind', filters.reminderKind);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyAppointmentReminderDto[]>(
        `${this.apiBase}/odontology/${clientId}/appointment-reminders${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createAppointment(clientId: string, payload: OdontologyAppointmentPayload): Promise<OdontologyAppointmentDto> {
    return firstValueFrom(
      this.http.post<OdontologyAppointmentDto>(`${this.apiBase}/odontology/${clientId}/appointments`, payload)
    );
  }

  async updateAppointment(
    clientId: string,
    appointmentId: string,
    payload: OdontologyAppointmentPayload
  ): Promise<OdontologyAppointmentDto> {
    return firstValueFrom(
      this.http.patch<OdontologyAppointmentDto>(
        `${this.apiBase}/odontology/${clientId}/appointments/${appointmentId}`,
        payload
      )
    );
  }

  async sendAppointmentEmailReminder(
    clientId: string,
    appointmentId: string
  ): Promise<{ ok: boolean; reminder: OdontologyAppointmentReminderDto }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; reminder: OdontologyAppointmentReminderDto }>(
        `${this.apiBase}/odontology/${clientId}/appointments/${appointmentId}/reminders/email`,
        {}
      )
    );
  }

  async sendAppointmentWhatsAppReminder(
    clientId: string,
    appointmentId: string
  ): Promise<{ ok: boolean; reminder: OdontologyAppointmentReminderDto }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; reminder: OdontologyAppointmentReminderDto }>(
        `${this.apiBase}/odontology/${clientId}/appointments/${appointmentId}/reminders/whatsapp`,
        {}
      )
    );
  }

  async createSite(clientId: string, payload: OdontologySitePayload): Promise<OdontologySiteDto> {
    return firstValueFrom(
      this.http.post<OdontologySiteDto>(`${this.apiBase}/odontology/${clientId}/sites`, payload)
    );
  }

  async updateSite(clientId: string, siteId: string, payload: OdontologySitePayload): Promise<OdontologySiteDto> {
    return firstValueFrom(
      this.http.patch<OdontologySiteDto>(`${this.apiBase}/odontology/${clientId}/sites/${siteId}`, payload)
    );
  }

  async createChair(clientId: string, payload: OdontologyChairPayload): Promise<OdontologyChairDto> {
    return firstValueFrom(
      this.http.post<OdontologyChairDto>(`${this.apiBase}/odontology/${clientId}/chairs`, payload)
    );
  }

  async updateChair(clientId: string, chairId: string, payload: OdontologyChairPayload): Promise<OdontologyChairDto> {
    return firstValueFrom(
      this.http.patch<OdontologyChairDto>(`${this.apiBase}/odontology/${clientId}/chairs/${chairId}`, payload)
    );
  }

  async listClinicalRecords(clientId: string, filters: {
    patientId?: string;
    status?: string;
    search?: string;
  } = {}): Promise<OdontologyClinicalRecordDto[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyClinicalRecordDto[]>(
        `${this.apiBase}/odontology/${clientId}/clinical-records${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createClinicalRecord(clientId: string, payload: OdontologyClinicalRecordPayload): Promise<OdontologyClinicalRecordDto> {
    return firstValueFrom(
      this.http.post<OdontologyClinicalRecordDto>(`${this.apiBase}/odontology/${clientId}/clinical-records`, payload)
    );
  }

  async updateClinicalRecord(
    clientId: string,
    recordId: string,
    payload: OdontologyClinicalRecordPayload
  ): Promise<OdontologyClinicalRecordDto> {
    return firstValueFrom(
      this.http.patch<OdontologyClinicalRecordDto>(
        `${this.apiBase}/odontology/${clientId}/clinical-records/${recordId}`,
        payload
      )
    );
  }

  async signClinicalRecord(
    clientId: string,
    recordId: string,
    payload: {
      patientSignatureDataUrl: string;
      patientSignerName: string;
      patientSignerDocumentType: string;
      patientSignerDocumentNumber: string;
      patientSignerRelationship?: string | null;
    }
  ): Promise<OdontologyClinicalRecordDto> {
    return firstValueFrom(
      this.http.post<OdontologyClinicalRecordDto>(
        `${this.apiBase}/odontology/${clientId}/clinical-records/${recordId}/sign`,
        payload
      )
    );
  }

  async getClinicalRecordPdf(clientId: string, recordId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/clinical-records/${recordId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async listClinicalRecordNotes(clientId: string, filters: {
    clinicalRecordId?: string;
    patientId?: string;
  } = {}): Promise<OdontologyClinicalRecordNoteDto[]> {
    const params = new URLSearchParams();
    if (filters.clinicalRecordId) params.set('clinicalRecordId', filters.clinicalRecordId);
    if (filters.patientId) params.set('patientId', filters.patientId);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyClinicalRecordNoteDto[]>(
        `${this.apiBase}/odontology/${clientId}/clinical-record-notes${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createClinicalRecordNote(
    clientId: string,
    recordId: string,
    payload: OdontologyClinicalRecordNotePayload
  ): Promise<OdontologyClinicalRecordNoteDto> {
    return firstValueFrom(
      this.http.post<OdontologyClinicalRecordNoteDto>(
        `${this.apiBase}/odontology/${clientId}/clinical-records/${recordId}/notes`,
        payload
      )
    );
  }

  async listTreatmentPlans(clientId: string, filters: {
    patientId?: string;
    status?: string;
    search?: string;
  } = {}): Promise<OdontologyTreatmentPlanDto[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyTreatmentPlanDto[]>(
        `${this.apiBase}/odontology/${clientId}/treatment-plans${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createTreatmentPlan(clientId: string, payload: OdontologyTreatmentPlanPayload): Promise<OdontologyTreatmentPlanDto> {
    return firstValueFrom(
      this.http.post<OdontologyTreatmentPlanDto>(`${this.apiBase}/odontology/${clientId}/treatment-plans`, payload)
    );
  }

  async updateTreatmentPlan(
    clientId: string,
    planId: string,
    payload: OdontologyTreatmentPlanPayload
  ): Promise<OdontologyTreatmentPlanDto> {
    return firstValueFrom(
      this.http.patch<OdontologyTreatmentPlanDto>(
        `${this.apiBase}/odontology/${clientId}/treatment-plans/${planId}`,
        payload
      )
    );
  }

  async acceptTreatmentPlan(
    clientId: string,
    planId: string,
    payload: {
      signatureDataUrl: string;
      signerName: string;
      signerDocumentType: string;
      signerDocumentNumber: string;
      signerRelationship?: string | null;
    }
  ): Promise<OdontologyTreatmentPlanDto> {
    return firstValueFrom(
      this.http.post<OdontologyTreatmentPlanDto>(
        `${this.apiBase}/odontology/${clientId}/treatment-plans/${planId}/accept`,
        payload
      )
    );
  }

  async getTreatmentPlanPdf(clientId: string, planId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/treatment-plans/${planId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async listAttachments(clientId: string, filters: {
    patientId?: string;
    category?: string;
    search?: string;
  } = {}): Promise<OdontologyAttachmentDto[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyAttachmentDto[]>(
        `${this.apiBase}/odontology/${clientId}/attachments${qs ? `?${qs}` : ''}`
      )
    );
  }

  async uploadAttachment(clientId: string, form: FormData): Promise<OdontologyAttachmentDto> {
    return firstValueFrom(
      this.http.post<OdontologyAttachmentDto>(`${this.apiBase}/odontology/${clientId}/attachments`, form)
    );
  }

  async deleteAttachment(clientId: string, attachmentId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<{ ok: boolean }>(`${this.apiBase}/odontology/${clientId}/attachments/${attachmentId}`)
    );
  }

  async listInventoryItems(clientId: string, filters: {
    status?: string;
    lowStockOnly?: boolean;
    search?: string;
  } = {}): Promise<OdontologyInventoryItemDto[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.lowStockOnly) params.set('lowStockOnly', 'true');
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyInventoryItemDto[]>(
        `${this.apiBase}/odontology/${clientId}/inventory/items${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createInventoryItem(clientId: string, payload: OdontologyInventoryItemPayload): Promise<OdontologyInventoryItemDto> {
    return firstValueFrom(
      this.http.post<OdontologyInventoryItemDto>(`${this.apiBase}/odontology/${clientId}/inventory/items`, payload)
    );
  }

  async updateInventoryItem(clientId: string, itemId: string, payload: OdontologyInventoryItemPayload): Promise<OdontologyInventoryItemDto> {
    return firstValueFrom(
      this.http.put<OdontologyInventoryItemDto>(`${this.apiBase}/odontology/${clientId}/inventory/items/${itemId}`, payload)
    );
  }

  async listInventoryMovements(clientId: string, filters: {
    itemId?: string;
    movementType?: string;
    search?: string;
  } = {}): Promise<OdontologyInventoryMovementDto[]> {
    const params = new URLSearchParams();
    if (filters.itemId) params.set('itemId', filters.itemId);
    if (filters.movementType) params.set('movementType', filters.movementType);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyInventoryMovementDto[]>(
        `${this.apiBase}/odontology/${clientId}/inventory/movements${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createInventoryMovement(
    clientId: string,
    payload: OdontologyInventoryMovementPayload
  ): Promise<{ item: OdontologyInventoryItemDto; movement: OdontologyInventoryMovementDto | null }> {
    return firstValueFrom(
      this.http.post<{ item: OdontologyInventoryItemDto; movement: OdontologyInventoryMovementDto | null }>(
        `${this.apiBase}/odontology/${clientId}/inventory/movements`,
        payload
      )
    );
  }

  async listSuppliers(clientId: string, filters: {
    status?: string;
    search?: string;
  } = {}): Promise<OdontologySupplierDto[]> {
    const params = new URLSearchParams();
    if (filters.status !== undefined) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologySupplierDto[]>(
        `${this.apiBase}/odontology/${clientId}/inventory/suppliers${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createSupplier(clientId: string, payload: OdontologySupplierPayload): Promise<OdontologySupplierDto> {
    return firstValueFrom(
      this.http.post<OdontologySupplierDto>(`${this.apiBase}/odontology/${clientId}/inventory/suppliers`, payload)
    );
  }

  async updateSupplier(clientId: string, supplierId: string, payload: OdontologySupplierPayload): Promise<OdontologySupplierDto> {
    return firstValueFrom(
      this.http.put<OdontologySupplierDto>(`${this.apiBase}/odontology/${clientId}/inventory/suppliers/${supplierId}`, payload)
    );
  }

  async listPurchaseRequests(clientId: string, filters: {
    status?: string;
    search?: string;
  } = {}): Promise<OdontologyPurchaseRequestDto[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyPurchaseRequestDto[]>(
        `${this.apiBase}/odontology/${clientId}/inventory/purchase-requests${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createPurchaseRequest(clientId: string, payload: OdontologyPurchaseRequestPayload): Promise<OdontologyPurchaseRequestDto> {
    return firstValueFrom(
      this.http.post<OdontologyPurchaseRequestDto>(
        `${this.apiBase}/odontology/${clientId}/inventory/purchase-requests`,
        payload
      )
    );
  }

  async updatePurchaseRequestStatus(clientId: string, requestId: string, status: string): Promise<OdontologyPurchaseRequestDto> {
    return firstValueFrom(
      this.http.patch<OdontologyPurchaseRequestDto>(
        `${this.apiBase}/odontology/${clientId}/inventory/purchase-requests/${requestId}/status`,
        { status }
      )
    );
  }

  async listProcedureInventoryKit(clientId: string, procedureTypeId?: string): Promise<OdontologyProcedureInventoryKitDto[]> {
    const params = new URLSearchParams();
    if (procedureTypeId) params.set('procedureTypeId', procedureTypeId);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyProcedureInventoryKitDto[]>(
        `${this.apiBase}/odontology/${clientId}/inventory/procedure-kits${qs ? `?${qs}` : ''}`
      )
    );
  }

  async replaceProcedureInventoryKit(
    clientId: string,
    procedureTypeId: string,
    items: OdontologyProcedureInventoryKitItemPayload[]
  ): Promise<OdontologyProcedureInventoryKitDto[]> {
    return firstValueFrom(
      this.http.put<OdontologyProcedureInventoryKitDto[]>(
        `${this.apiBase}/odontology/${clientId}/inventory/procedure-kits/${procedureTypeId}`,
        { items }
      )
    );
  }

  async listInstruments(clientId: string, filters: {
    status?: string;
    search?: string;
  } = {}): Promise<OdontologyInstrumentDto[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyInstrumentDto[]>(
        `${this.apiBase}/odontology/${clientId}/instruments${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createInstrument(clientId: string, payload: OdontologyInstrumentPayload): Promise<OdontologyInstrumentDto> {
    return firstValueFrom(
      this.http.post<OdontologyInstrumentDto>(`${this.apiBase}/odontology/${clientId}/instruments`, payload)
    );
  }

  async updateInstrument(clientId: string, instrumentId: string, payload: OdontologyInstrumentPayload): Promise<OdontologyInstrumentDto> {
    return firstValueFrom(
      this.http.put<OdontologyInstrumentDto>(`${this.apiBase}/odontology/${clientId}/instruments/${instrumentId}`, payload)
    );
  }

  async listSterilizationCycles(clientId: string, filters: {
    result?: string;
    method?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    responsible?: string;
  } = {}): Promise<OdontologySterilizationCycleDto[]> {
    const params = new URLSearchParams();
    if (filters.result) params.set('result', filters.result);
    if (filters.method) params.set('method', filters.method);
    if (filters.search) params.set('search', filters.search);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.responsible) params.set('responsible', filters.responsible);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologySterilizationCycleDto[]>(
        `${this.apiBase}/odontology/${clientId}/sterilization-cycles${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createSterilizationCycle(
    clientId: string,
    payload: OdontologySterilizationCyclePayload
  ): Promise<OdontologySterilizationCycleDto> {
    return firstValueFrom(
      this.http.post<OdontologySterilizationCycleDto>(`${this.apiBase}/odontology/${clientId}/sterilization-cycles`, payload)
    );
  }

  async getSterilizationCyclePdf(clientId: string, cycleId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/sterilization-cycles/${cycleId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async getSterilizationCycleLabelsPdf(clientId: string, cycleId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/sterilization-cycles/${cycleId}/labels/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async getSterilizationCyclesReportPdf(clientId: string, filters: {
    result?: string;
    method?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    responsible?: string;
  } = {}): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters.result) params.set('result', filters.result);
    if (filters.method) params.set('method', filters.method);
    if (filters.search) params.set('search', filters.search);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.responsible) params.set('responsible', filters.responsible);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/sterilization-cycles/report/pdf${qs ? `?${qs}` : ''}`, {
        responseType: 'blob'
      })
    );
  }

  async listPayments(clientId: string, filters: {
    patientId?: string;
    treatmentPlanId?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    cashier?: string;
  } = {}): Promise<OdontologyPaymentDto[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.treatmentPlanId) params.set('treatmentPlanId', filters.treatmentPlanId);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.cashier) params.set('cashier', filters.cashier);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyPaymentDto[]>(
        `${this.apiBase}/odontology/${clientId}/payments${qs ? `?${qs}` : ''}`
      )
    );
  }

  async getPaymentsReportPdf(clientId: string, filters: {
    patientId?: string;
    treatmentPlanId?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    cashier?: string;
  } = {}): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.treatmentPlanId) params.set('treatmentPlanId', filters.treatmentPlanId);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.cashier) params.set('cashier', filters.cashier);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/payments/report/pdf${qs ? `?${qs}` : ''}`, {
        responseType: 'blob'
      })
    );
  }

  async listCashClosures(clientId: string, filters: {
    startDate?: string;
    endDate?: string;
    cashier?: string;
  } = {}): Promise<OdontologyCashClosureDto[]> {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.cashier) params.set('cashier', filters.cashier);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyCashClosureDto[]>(
        `${this.apiBase}/odontology/${clientId}/payments/cash-closures${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createCashClosure(clientId: string, payload: OdontologyCashClosurePayload): Promise<OdontologyCashClosureDto> {
    return firstValueFrom(
      this.http.post<OdontologyCashClosureDto>(
        `${this.apiBase}/odontology/${clientId}/payments/cash-closures`,
        payload
      )
    );
  }

  async getCashClosurePdf(clientId: string, closureId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/payments/cash-closures/${closureId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async createPayment(clientId: string, payload: OdontologyPaymentPayload): Promise<OdontologyPaymentDto> {
    return firstValueFrom(
      this.http.post<OdontologyPaymentDto>(`${this.apiBase}/odontology/${clientId}/payments`, payload)
    );
  }

  async getPaymentReceiptPdf(clientId: string, paymentId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/payments/${paymentId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async voidPayment(clientId: string, paymentId: string, reason: string): Promise<OdontologyPaymentDto> {
    return firstValueFrom(
      this.http.post<OdontologyPaymentDto>(`${this.apiBase}/odontology/${clientId}/payments/${paymentId}/void`, { reason })
    );
  }

  async listMedications(clientId: string, filters: { search?: string; activeOnly?: boolean } = {}): Promise<OdontologyMedicationDto[]> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.activeOnly) params.set('activeOnly', 'true');
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyMedicationDto[]>(
        `${this.apiBase}/odontology/${clientId}/medications${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createMedication(clientId: string, payload: OdontologyMedicationPayload): Promise<OdontologyMedicationDto> {
    return firstValueFrom(
      this.http.post<OdontologyMedicationDto>(`${this.apiBase}/odontology/${clientId}/medications`, payload)
    );
  }

  async listPrescriptions(clientId: string, filters: {
    patientId?: string;
    status?: string;
    search?: string;
  } = {}): Promise<OdontologyPrescriptionDto[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyPrescriptionDto[]>(
        `${this.apiBase}/odontology/${clientId}/prescriptions${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createPrescription(clientId: string, payload: OdontologyPrescriptionPayload): Promise<OdontologyPrescriptionDto> {
    return firstValueFrom(
      this.http.post<OdontologyPrescriptionDto>(`${this.apiBase}/odontology/${clientId}/prescriptions`, payload)
    );
  }

  async listClinicalDocuments(clientId: string, filters: {
    patientId?: string;
    documentType?: string;
    status?: string;
    search?: string;
  } = {}): Promise<OdontologyClinicalDocumentDto[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.documentType) params.set('documentType', filters.documentType);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyClinicalDocumentDto[]>(
        `${this.apiBase}/odontology/${clientId}/clinical-documents${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createClinicalDocument(clientId: string, payload: OdontologyClinicalDocumentPayload): Promise<OdontologyClinicalDocumentDto> {
    return firstValueFrom(
      this.http.post<OdontologyClinicalDocumentDto>(`${this.apiBase}/odontology/${clientId}/clinical-documents`, payload)
    );
  }

  async getOdontogram(clientId: string, patientId: string): Promise<OdontologyOdontogramDto> {
    return firstValueFrom(
      this.http.get<OdontologyOdontogramDto>(
        `${this.apiBase}/odontology/${clientId}/patients/${patientId}/odontogram`
      )
    );
  }

  async getOdontogramPdf(clientId: string, patientId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/patients/${patientId}/odontogram/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async createOdontogramEntry(clientId: string, payload: OdontologyOdontogramPayload): Promise<OdontologyOdontogramEntryDto> {
    return firstValueFrom(
      this.http.post<OdontologyOdontogramEntryDto>(`${this.apiBase}/odontology/${clientId}/odontogram`, payload)
    );
  }

  async listPeriodontograms(clientId: string, filters: {
    patientId?: string;
    search?: string;
  } = {}): Promise<OdontologyPeriodontogramDto[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyPeriodontogramDto[]>(
        `${this.apiBase}/odontology/${clientId}/periodontograms${qs ? `?${qs}` : ''}`
      )
    );
  }

  async getPeriodontogram(clientId: string, chartId: string): Promise<OdontologyPeriodontogramDto> {
    return firstValueFrom(
      this.http.get<OdontologyPeriodontogramDto>(`${this.apiBase}/odontology/${clientId}/periodontograms/${chartId}`)
    );
  }

  async getPeriodontogramPdf(clientId: string, chartId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/odontology/${clientId}/periodontograms/${chartId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async createPeriodontogram(clientId: string, payload: OdontologyPeriodontogramPayload): Promise<OdontologyPeriodontogramDto> {
    return firstValueFrom(
      this.http.post<OdontologyPeriodontogramDto>(`${this.apiBase}/odontology/${clientId}/periodontograms`, payload)
    );
  }

  async listConsentTemplates(clientId: string, activeOnly = false): Promise<OdontologyConsentTemplateDto[]> {
    const qs = activeOnly ? '?activeOnly=true' : '';
    return firstValueFrom(
      this.http.get<OdontologyConsentTemplateDto[]>(`${this.apiBase}/odontology/${clientId}/consent-templates${qs}`)
    );
  }

  async createConsentTemplate(
    clientId: string,
    payload: OdontologyConsentTemplatePayload
  ): Promise<OdontologyConsentTemplateDto> {
    return firstValueFrom(
      this.http.post<OdontologyConsentTemplateDto>(`${this.apiBase}/odontology/${clientId}/consent-templates`, payload)
    );
  }

  async updateConsentTemplate(
    clientId: string,
    templateId: string,
    payload: OdontologyConsentTemplatePayload
  ): Promise<OdontologyConsentTemplateDto> {
    return firstValueFrom(
      this.http.patch<OdontologyConsentTemplateDto>(
        `${this.apiBase}/odontology/${clientId}/consent-templates/${templateId}`,
        payload
      )
    );
  }

  async listPatientConsents(clientId: string, filters: {
    patientId?: string;
    status?: string;
    search?: string;
  } = {}): Promise<OdontologyPatientConsentDto[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<OdontologyPatientConsentDto[]>(
        `${this.apiBase}/odontology/${clientId}/consents${qs ? `?${qs}` : ''}`
      )
    );
  }

  async createPatientConsent(clientId: string, payload: OdontologyPatientConsentPayload): Promise<OdontologyPatientConsentDto> {
    return firstValueFrom(
      this.http.post<OdontologyPatientConsentDto>(`${this.apiBase}/odontology/${clientId}/consents`, payload)
    );
  }

  async signPatientConsent(
    clientId: string,
    consentId: string,
    signerSignatureDataUrl: string
  ): Promise<OdontologyPatientConsentDto> {
    return firstValueFrom(
      this.http.post<OdontologyPatientConsentDto>(
        `${this.apiBase}/odontology/${clientId}/consents/${consentId}/sign`,
        { signerSignatureDataUrl }
      )
    );
  }
}
