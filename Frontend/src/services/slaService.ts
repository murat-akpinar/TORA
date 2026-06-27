import api from './api';

export interface SlaPolicy {
  id: number;
  name: string;
  priority: string | null;       // null = any
  teamId: number | null;         // null = any
  teamName: string | null;
  targetHours: number;
  businessHoursOnly: boolean;
  isActive: boolean;
}

export interface CreateSlaPolicyRequest {
  name: string;
  priority?: string | null;
  teamId?: number | null;
  targetHours: number;
  businessHoursOnly: boolean;
  isActive: boolean;
}

export interface SlaCompliance {
  onTrack: number;
  atRisk: number;
  breached: number;
  met: number;
  complianceRate: number;
}

export const slaService = {
  getPolicies: async (): Promise<SlaPolicy[]> => {
    const res = await api.get<SlaPolicy[]>('/admin/sla-policies');
    return res.data;
  },
  createPolicy: async (req: CreateSlaPolicyRequest): Promise<SlaPolicy> => {
    const res = await api.post<SlaPolicy>('/admin/sla-policies', req);
    return res.data;
  },
  updatePolicy: async (id: number, req: CreateSlaPolicyRequest): Promise<SlaPolicy> => {
    const res = await api.put<SlaPolicy>(`/admin/sla-policies/${id}`, req);
    return res.data;
  },
  deletePolicy: async (id: number): Promise<void> => {
    await api.delete(`/admin/sla-policies/${id}`);
  },
  getCompliance: async (teamId?: number): Promise<SlaCompliance> => {
    const res = await api.get<SlaCompliance>('/reports/sla', {
      params: teamId ? { teamId } : {},
    });
    return res.data;
  },
};
