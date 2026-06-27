# İş Kodu (Task Code) Üretimi — Tasarım Belgesi

**Tarih:** 2026-06-27
**Durum:** Onaylandı
**Kapsam:** Her göreve okunabilir, benzersiz, değişmez bir kod (`TORA-0001`). Git entegrasyonunun ön koşulu.

---

## 1. Kararlar

| Konu | Karar |
|---|---|
| Şema | **Tek global önek** + global sıra: `TORA-0001`, `TORA-0002`, ... |
| Format | Önek `TORA` + `-` + 4 haneli sıfır dolgulu sayı; 9999'dan sonra doğal büyür (`TORA-10000`) |
| Üretim | **Veritabanı düzeyi**: Postgres `SEQUENCE` + `tasks.code` kolonu DEFAULT ifadesi; Hibernate `@Generated(INSERT)` ile okur |
| Değişmezlik | Kod oluşturmada bir kez atanır; iş başka birime taşınsa da sabit |
| Kapsama | Tüm insert yolları otomatik kod alır (normal görev, **zincir görev**, örnek veri seed'i) — DB default sayesinde |
| Geriye dönük | Mevcut görevlere `id` sırasına göre kod atanır (en eski = `TORA-0001`); backfill sonrası NOT NULL + UNIQUE |
| Arama | Global arama (`SearchService`) görevleri **koda göre** de bulur |
| Gösterim | Görev kartı/liste/modal'da kod rozeti |

**Kapsam dışı (sonraya):** Excel/PDF raporlarında kod sütunu; önekin admin panelinden değiştirilmesi.

---

## 2. Veri modeli (Liquibase V32)

- `task_code_seq` — `CREATE SEQUENCE` (start 1).
- `tasks.code` — `VARCHAR(20)`, DEFAULT `'TORA-' || lpad(nextval('task_code_seq')::text, 4, '0')`.
- **Backfill:** mevcut satırlara `id ASC` sırasına göre kod (sadece `code IS NULL`); idempotent.
- Backfill sonrası: `NOT NULL` + UNIQUE constraint + `idx_tasks_code`.

> Not: Liquibase changeSet'leri ayrık tutulur (sequence → kolon+default → backfill → kısıtlar) ki yeniden çalıştırma güvenli olsun. V31'den sonra eklenir, sıralama bozulmaz.

---

## 3. Backend

- **`Task` entity:** yeni `code` alanı —
  `@Column(insertable = false, updatable = false)` + `@org.hibernate.annotations.Generated(event = INSERT)`.
  DB üretir, Hibernate insert sonrası geri okur. Uygulama kodunda kod set EDİLMEZ.
- **`TaskDTO`:** `code` alanı; `convertToDTO`'da `dto.setCode(task.getCode())`.
- **`SearchService`:** görev araması `code` alanını da kapsar (ILIKE veya mevcut sorguya ekleme).
  Liste/dashboard sorguları değişmez (kod sadece ek alan).

---

## 4. Frontend

- **`Task` tipi:** `code: string`.
- **Kod rozeti:** görev kartı/başlığı/liste satırı/TaskModal başlığında `TORA-0042` etiketi (mevcut stil/badge bileşeniyle).
- **Arama:** mevcut global arama çubuğu koda göre de sonuç döndürür (backend kapsadığı için ek frontend iş minimum).

---

## 5. Edge / test

- Eşzamanlı oluşturmada `nextval` atomik → çakışma yok.
- Zincir görevleri (DB default) otomatik kod alır → E2E doğrulanır.
- Backfill idempotent (`code IS NULL` filtreli) → migration yeniden çalışsa bozulmaz.
- Hibernate `@Generated` insert sonrası kodu okur → `createTask` yanıtında kod döner (doğrulanır).
- Uzunluk: `TORA-` (5) + sayı; VARCHAR(20) milyonlara kadar yeterli.

---

## 6. Sonraki adım (kapsam dışı, ileride)
- Raporlarda kod sütunu.
- **Git entegrasyonu:** kod = branch/MR başlığı glue (ayrı iş; bu özellik onun ön koşulu).
