import React, { useEffect, useState } from 'react';
import { slaService, SlaPolicy, SlaCompliance, CreateSlaPolicyRequest } from '../../services/slaService';
import { adminService } from '../../services/adminService';
import { Team } from '../../types/Team';
import LoadingSpinner from '../common/LoadingSpinner';
import { notify } from '../../utils/notify';
import { extractErrorMessage } from '../../utils/errorMessages';
import './RoleManagement.css';
import './SlaManagement.css';

const PRIORITIES = [
  { value: '', label: 'Tüm öncelikler' },
  { value: 'URGENT', label: 'Acil' },
  { value: 'HIGH', label: 'Yüksek' },
  { value: 'NORMAL', label: 'Normal' },
];

const emptyForm: CreateSlaPolicyRequest = {
  name: '',
  priority: '',
  teamId: null,
  targetHours: 24,
  businessHoursOnly: false,
  isActive: true,
};

const SlaManagement: React.FC = () => {
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [compliance, setCompliance] = useState<SlaCompliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SlaPolicy | null>(null);
  const [form, setForm] = useState<CreateSlaPolicyRequest>(emptyForm);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [pol, tms, comp] = await Promise.all([
        slaService.getPolicies(),
        adminService.getAllTeams(),
        slaService.getCompliance(),
      ]);
      setPolicies(pol);
      setTeams(tms);
      setCompliance(comp);
    } catch (error: any) {
      notify.error(extractErrorMessage(error, 'SLA verileri yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleEdit = (p: SlaPolicy) => {
    setEditing(p);
    setForm({
      name: p.name,
      priority: p.priority ?? '',
      teamId: p.teamId,
      targetHours: p.targetHours,
      businessHoursOnly: p.businessHoursOnly,
      isActive: p.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bu SLA politikasını silmek istediğinizden emin misiniz?')) return;
    try {
      await slaService.deletePolicy(id);
      notify.success('SLA politikası silindi.');
      fetchAll();
    } catch (error: any) {
      notify.error(extractErrorMessage(error, 'Silme başarısız.'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const req: CreateSlaPolicyRequest = {
        ...form,
        priority: form.priority ? form.priority : null,
        teamId: form.teamId ? form.teamId : null,
      };
      if (editing) {
        await slaService.updatePolicy(editing.id, req);
        notify.success('SLA politikası güncellendi.');
      } else {
        await slaService.createPolicy(req);
        notify.success('SLA politikası oluşturuldu.');
      }
      setShowModal(false);
      fetchAll();
    } catch (error: any) {
      notify.error(extractErrorMessage(error, 'İşlem başarısız oldu.'));
    }
  };

  const priorityLabel = (p: string | null) =>
    PRIORITIES.find((x) => x.value === (p ?? ''))?.label ?? p;

  const formatTarget = (hours: number) =>
    hours % 24 === 0 ? `${hours / 24} gün` : `${hours} saat`;

  if (loading) {
    return <LoadingSpinner showLabel label="Yükleniyor..." />;
  }

  return (
    <div className="sla-management role-management">
      {compliance && (
        <div className="sla-compliance">
          <div className="sla-stat sla-rate">
            <span className="sla-stat-value">%{compliance.complianceRate}</span>
            <span className="sla-stat-label">SLA Uyum Oranı</span>
          </div>
          <div className="sla-stat ontrack">
            <span className="sla-stat-value">{compliance.onTrack}</span>
            <span className="sla-stat-label">Zamanında</span>
          </div>
          <div className="sla-stat atrisk">
            <span className="sla-stat-value">{compliance.atRisk}</span>
            <span className="sla-stat-label">Risk Altında</span>
          </div>
          <div className="sla-stat breached">
            <span className="sla-stat-value">{compliance.breached}</span>
            <span className="sla-stat-label">İhlal</span>
          </div>
          <div className="sla-stat met">
            <span className="sla-stat-value">{compliance.met}</span>
            <span className="sla-stat-label">Karşılandı</span>
          </div>
        </div>
      )}

      <div className="role-management-header">
        <h2>SLA Politikaları</h2>
        <button className="btn-create" onClick={handleCreate}>
          Yeni Politika
        </button>
      </div>

      <table className="roles-table">
        <thead>
          <tr>
            <th>Ad</th>
            <th>Öncelik</th>
            <th>Birim</th>
            <th>Hedef Süre</th>
            <th>Mesai Saati</th>
            <th>Durum</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {policies.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.6 }}>Politika yok</td></tr>
          ) : policies.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{priorityLabel(p.priority)}</td>
              <td>{p.teamName ?? 'Tüm birimler'}</td>
              <td>{formatTarget(p.targetHours)}</td>
              <td>{p.businessHoursOnly ? 'Evet (hafta içi)' : 'Hayır (7/24)'}</td>
              <td>
                <span className={`sla-badge-status ${p.isActive ? 'active' : 'passive'}`}>
                  {p.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </td>
              <td>
                <button className="btn-edit" onClick={() => handleEdit(p)}>Düzenle</button>
                <button className="btn-delete" onClick={() => handleDelete(p.id)}>Sil</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'SLA Politikası Düzenle' : 'Yeni SLA Politikası'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="role-form">
              <div className="form-group">
                <label>Politika Adı *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Öncelik</label>
                <select
                  value={form.priority ?? ''}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Birim</label>
                <select
                  value={form.teamId ?? ''}
                  onChange={(e) => setForm({ ...form, teamId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Tüm birimler</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Hedef Çözüm Süresi (saat) *</label>
                <input
                  type="number"
                  min={1}
                  value={form.targetHours}
                  onChange={(e) => setForm({ ...form, targetHours: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="form-group checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.businessHoursOnly}
                    onChange={(e) => setForm({ ...form, businessHoursOnly: e.target.checked })}
                  />
                  Sadece hafta içi günler sayılsın (hafta sonu duraklat)
                </label>
              </div>
              <div className="form-group checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Aktif
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-cancel">İptal</button>
                <button type="submit" className="btn-submit">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlaManagement;
