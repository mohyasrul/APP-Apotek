import { describe, it, expect } from 'vitest';
import type {
  SipnapReportItem,
  SipnapReport,
  BukuHarianItem,
  DrugDestruction,
  ScreeningChecklist,
  PrescriptionScreening,
  NarcoticHandover,
} from '../lib/types';

describe('SipnapReportItem type', () => {
  it('can construct a valid SipnapReportItem', () => {
    const item: SipnapReportItem = {
      medicine_id: 'med-001',
      medicine_name: 'Codein 10mg',
      unit: 'tablet',
      saldo_awal: 100,
      penerimaan: 50,
      pengeluaran: 30,
      saldo_akhir: 120,
      keterangan: '',
    };
    expect(item.medicine_name).toBe('Codein 10mg');
    expect(item.saldo_akhir).toBe(item.saldo_awal + item.penerimaan - item.pengeluaran);
  });

  it('validates saldo consistency', () => {
    const item: SipnapReportItem = {
      medicine_id: 'med-002',
      medicine_name: 'Tramadol 50mg',
      unit: 'kapsul',
      saldo_awal: 200,
      penerimaan: 100,
      pengeluaran: 50,
      saldo_akhir: 250,
      keterangan: 'test',
    };
    const expectedSaldoAkhir = item.saldo_awal + item.penerimaan - item.pengeluaran;
    expect(expectedSaldoAkhir).toBe(250);
    expect(item.saldo_akhir).toBe(expectedSaldoAkhir);
  });
});

describe('SipnapReport type', () => {
  it('can construct a valid narkotika report', () => {
    const report: SipnapReport = {
      user_id: 'user-001',
      periode_bulan: 3,
      periode_tahun: 2026,
      jenis: 'narkotika',
      items: [],
      status: 'draft',
    };
    expect(report.jenis).toBe('narkotika');
    expect(report.periode_bulan).toBe(3);
  });

  it('can construct a valid psikotropika report', () => {
    const report: SipnapReport = {
      user_id: 'user-001',
      periode_bulan: 3,
      periode_tahun: 2026,
      jenis: 'psikotropika',
      items: [],
      status: 'submitted',
      submitted_at: '2026-04-05T10:00:00Z',
    };
    expect(report.jenis).toBe('psikotropika');
    expect(report.status).toBe('submitted');
    expect(report.submitted_at).toBeTruthy();
  });
});

describe('BukuHarianItem type', () => {
  it('can construct a valid item', () => {
    const item: BukuHarianItem = {
      tanggal: '01/03/2026',
      no_dokumen: 'TRX/2026/03/0001',
      keterangan: 'Penjualan',
      masuk: 0,
      keluar: 5,
      saldo: 95,
    };
    expect(item.keluar).toBe(5);
    expect(item.saldo).toBe(95);
  });

  it('handles zero movement entries', () => {
    const item: BukuHarianItem = {
      tanggal: '01/03/2026',
      no_dokumen: 'ADJ/001',
      keterangan: 'Koreksi',
      masuk: 0,
      keluar: 0,
      saldo: 100,
    };
    expect(item.masuk).toBe(0);
    expect(item.keluar).toBe(0);
  });
});

describe('DrugDestruction type', () => {
  it('can construct a valid destruction record', () => {
    const record: DrugDestruction = {
      id: 'dest-001',
      user_id: 'user-001',
      destruction_number: 'BAP/2026/03/0001',
      destruction_date: '2026-03-14',
      status: 'draft',
      penanggung_jawab: 'Apt. Budi Santoso, S.Farm',
      saksi_1: 'Siti Aminah',
      saksi_2: 'Ahmad Fauzi',
      metode: 'dibakar',
      items: [{
        medicine_id: 'med-001',
        medicine_name: 'Paracetamol 500mg',
        batch_number: 'B2025001',
        expiry_date: '2025-12-31',
        quantity: 100,
        unit: 'tablet',
        alasan: 'kadaluarsa',
      }],
      notes: 'Pemusnahan rutin',
    };
    expect(record.destruction_number).toMatch(/^BAP\//);
    expect(record.items.length).toBe(1);
    expect(record.items[0].alasan).toBe('kadaluarsa');
  });

  it('supports all status transitions', () => {
    const statuses: DrugDestruction['status'][] = ['draft', 'scheduled', 'completed'];
    statuses.forEach(status => {
      const record: DrugDestruction = {
        user_id: 'user-001',
        destruction_number: 'BAP/2026/03/0001',
        destruction_date: '2026-03-14',
        status,
        penanggung_jawab: 'Apt. Test',
        saksi_1: 'Saksi 1',
        saksi_2: 'Saksi 2',
        metode: 'dibakar',
        items: [],
      };
      expect(record.status).toBe(status);
    });
  });

  it('supports all destruction methods', () => {
    const methods = ['dibakar', 'diblender', 'dilarutkan', 'dikubur', 'dikembalikan', 'lainnya'];
    methods.forEach(metode => {
      const record: DrugDestruction = {
        user_id: 'u1', destruction_number: 'BAP/1', destruction_date: '2026-01-01',
        status: 'draft', penanggung_jawab: 'PJ', saksi_1: 'S1', saksi_2: 'S2',
        metode, items: [],
      };
      expect(record.metode).toBe(metode);
    });
  });
});

describe('ScreeningChecklist type', () => {
  it('has all required fields', () => {
    const checklist: ScreeningChecklist = {
      adm_nama_pasien: true,
      adm_umur_bb: true,
      adm_nama_dokter: true,
      adm_sip_dokter: false,
      adm_tanggal_resep: true,
      adm_paraf_dokter: true,
      adm_alamat_dokter: false,
      far_bentuk_sediaan: true,
      far_dosis: true,
      far_stabilitas: false,
      far_kompatibilitas: true,
      far_cara_pemberian: true,
      kli_ketepatan_indikasi: true,
      kli_dosis_tepat: true,
      kli_interaksi_obat: true,
      kli_efek_samping: false,
      kli_kontraindikasi: true,
      kli_alergi: true,
    };
    // All 18 checklist items
    expect(Object.keys(checklist).length).toBe(18);
    // Count checked items
    const checkedCount = Object.values(checklist).filter(Boolean).length;
    expect(checkedCount).toBe(14);
  });

  it('can calculate progress percentage', () => {
    const checklist: ScreeningChecklist = {
      adm_nama_pasien: true, adm_umur_bb: true, adm_nama_dokter: true,
      adm_sip_dokter: true, adm_tanggal_resep: true, adm_paraf_dokter: true,
      adm_alamat_dokter: true, far_bentuk_sediaan: true, far_dosis: true,
      far_stabilitas: true, far_kompatibilitas: true, far_cara_pemberian: true,
      kli_ketepatan_indikasi: true, kli_dosis_tepat: true, kli_interaksi_obat: true,
      kli_efek_samping: true, kli_kontraindikasi: true, kli_alergi: true,
    };
    const total = Object.keys(checklist).length;
    const checked = Object.values(checklist).filter(Boolean).length;
    const progress = Math.round((checked / total) * 100);
    expect(progress).toBe(100);
  });
});

describe('PrescriptionScreening type', () => {
  it('can construct a valid screening result', () => {
    const screening: PrescriptionScreening = {
      prescription_id: 'presc-001',
      screened_by: 'Apt. Budi',
      screened_at: '2026-03-14T10:00:00Z',
      checklist: {
        adm_nama_pasien: true, adm_umur_bb: true, adm_nama_dokter: true,
        adm_sip_dokter: true, adm_tanggal_resep: true, adm_paraf_dokter: true,
        adm_alamat_dokter: true, far_bentuk_sediaan: true, far_dosis: true,
        far_stabilitas: true, far_kompatibilitas: true, far_cara_pemberian: true,
        kli_ketepatan_indikasi: true, kli_dosis_tepat: true, kli_interaksi_obat: true,
        kli_efek_samping: true, kli_kontraindikasi: true, kli_alergi: true,
      },
      catatan: 'Semua OK',
      hasil: 'layak',
    };
    expect(screening.hasil).toBe('layak');
    expect(screening.catatan).toBe('Semua OK');
  });

  it('supports all result types', () => {
    const results: PrescriptionScreening['hasil'][] = ['layak', 'perlu_konfirmasi', 'tidak_layak'];
    results.forEach(hasil => {
      const screening: PrescriptionScreening = {
        prescription_id: 'p1', screened_by: 'Apt', screened_at: new Date().toISOString(),
        checklist: {
          adm_nama_pasien: false, adm_umur_bb: false, adm_nama_dokter: false,
          adm_sip_dokter: false, adm_tanggal_resep: false, adm_paraf_dokter: false,
          adm_alamat_dokter: false, far_bentuk_sediaan: false, far_dosis: false,
          far_stabilitas: false, far_kompatibilitas: false, far_cara_pemberian: false,
          kli_ketepatan_indikasi: false, kli_dosis_tepat: false, kli_interaksi_obat: false,
          kli_efek_samping: false, kli_kontraindikasi: false, kli_alergi: false,
        },
        catatan: '', hasil,
      };
      expect(screening.hasil).toBe(hasil);
    });
  });
});

describe('NarcoticHandover type', () => {
  it('can construct a valid handover record', () => {
    const handover: NarcoticHandover = {
      transaction_id: 'trx-001',
      user_id: 'user-001',
      penerima_nama: 'Ahmad Susanto',
      penerima_nik: '3501234567890123',
      hubungan_pasien: 'sendiri',
      items: [
        { medicine_name: 'Codein 10mg', quantity: 10, unit: 'tablet' },
      ],
    };
    expect(handover.penerima_nik).toHaveLength(16);
    expect(handover.items.length).toBe(1);
    expect(handover.hubungan_pasien).toBe('sendiri');
  });

  it('validates NIK is 16 digits', () => {
    const validNIK = '3501234567890123';
    expect(validNIK).toMatch(/^\d{16}$/);

    const invalidNIK = '123';
    expect(invalidNIK).not.toMatch(/^\d{16}$/);
  });

  it('supports all relationship types', () => {
    const relations = ['sendiri', 'keluarga', 'wali'];
    relations.forEach(rel => {
      const handover: NarcoticHandover = {
        transaction_id: 't1', user_id: 'u1',
        penerima_nama: 'Test', penerima_nik: '1234567890123456',
        hubungan_pasien: rel, items: [],
      };
      expect(handover.hubungan_pasien).toBe(rel);
    });
  });
});
