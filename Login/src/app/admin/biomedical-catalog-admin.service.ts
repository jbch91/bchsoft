import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';

export type BiomedicalCatalogNodeType = 'equipment' | 'brand' | 'model';
export type BiomedicalCatalogReviewStatus = 'pending' | 'approved' | 'rejected';

export interface BiomedicalCatalogNodeBase {
  id: string;
  type: BiomedicalCatalogNodeType;
  name: string;
  reviewStatus: BiomedicalCatalogReviewStatus;
  isActive: boolean;
  submissionCount: number;
  submittedAt: string | null;
  lastSubmittedAt: string | null;
  submittedByName: string | null;
  submittedClientName: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BiomedicalCatalogModel extends BiomedicalCatalogNodeBase {
  type: 'model';
  brandId: string;
}

export interface BiomedicalCatalogBrand extends BiomedicalCatalogNodeBase {
  type: 'brand';
  equipmentId: string;
  models: BiomedicalCatalogModel[];
}

export interface BiomedicalCatalogEquipment extends BiomedicalCatalogNodeBase {
  type: 'equipment';
  brands: BiomedicalCatalogBrand[];
}

export type BiomedicalCatalogNode =
  | BiomedicalCatalogEquipment
  | BiomedicalCatalogBrand
  | BiomedicalCatalogModel;

export interface BiomedicalCatalogSyncResult {
  assets: number;
  guides: number;
}

@Injectable({ providedIn: 'root' })
export class BiomedicalCatalogAdminService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  list(): Promise<BiomedicalCatalogEquipment[]> {
    return firstValueFrom(
      this.http.get<BiomedicalCatalogEquipment[]>(`${this.apiBase}/admin/biomedical-catalog`)
    );
  }

  createNode(payload: {
    type: BiomedicalCatalogNodeType;
    name: string;
    parentId?: string | null;
  }): Promise<{ node: unknown }> {
    return firstValueFrom(
      this.http.post<{ node: unknown }>(`${this.apiBase}/admin/biomedical-catalog/nodes`, payload)
    );
  }

  updateNode(
    type: BiomedicalCatalogNodeType,
    id: string,
    payload: { name?: string; parentId?: string | null; isActive?: boolean }
  ): Promise<{ node: unknown; sync: BiomedicalCatalogSyncResult }> {
    return firstValueFrom(
      this.http.patch<{ node: unknown; sync: BiomedicalCatalogSyncResult }>(
        `${this.apiBase}/admin/biomedical-catalog/${type}/${id}`,
        payload
      )
    );
  }

  reviewNode(
    type: BiomedicalCatalogNodeType,
    id: string,
    payload: { decision: 'approve' | 'reject'; cascade?: boolean; notes?: string | null }
  ): Promise<{ decision: string; sync: BiomedicalCatalogSyncResult }> {
    return firstValueFrom(
      this.http.post<{ decision: string; sync: BiomedicalCatalogSyncResult }>(
        `${this.apiBase}/admin/biomedical-catalog/${type}/${id}/review`,
        payload
      )
    );
  }

  mergeNode(
    type: BiomedicalCatalogNodeType,
    id: string,
    targetId: string
  ): Promise<{ targetId: string; sync: BiomedicalCatalogSyncResult }> {
    return firstValueFrom(
      this.http.post<{ targetId: string; sync: BiomedicalCatalogSyncResult }>(
        `${this.apiBase}/admin/biomedical-catalog/${type}/${id}/merge`,
        { targetId }
      )
    );
  }
}
