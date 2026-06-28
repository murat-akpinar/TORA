# Smart-commit Komutları + Aktör Email-Eşleme — Tasarım Belgesi

**Tarih:** 2026-06-28
**Durum:** Onaylandı
**Kapsam:** Git inbound webhook akışının tamamlanması — (1) commit/MR mesajındaki smart-commit komutları (durum geçişi + yorum), (2) git commit yazarının email ile TORA kullanıcısına eşlenmesi.

**Ön koşul:** Git Entegrasyonu (Inbound / Webhook) — tamamlandı (`2026-06-27-git-entegrasyonu-inbound-design.md`).

**Kapsam dışı:** Outbound (Branch/MR oluştur) ayrı sub-project; `#time` komutu (zaman takibi modülü henüz yok).

---

## 1. Kararlar

| Konu | Karar |
|---|---|
| Komut eşleme | **Sabit alias seti** (kodda) — admin yapılandırması yok (YAGNI) |
| Komut konumu | Komut, bir iş kodundan (`TORA-\d+`) **sonra** gelmeli; kodsuz komut yok sayılır |
| Komut önceliği | **Explicit komut, genel push/MR durum ayarını override eder** (o görev için `applyStatusSync` atlanır) |
| Aktör | Email-eşleme: commit yazarı email → `User.email` (case-insensitive); bulunamazsa `git-otomasyonu` sistem kullanıcısı |
| Yorum aktörü | Eşleşen kullanıcı (veya sistem); `SecurityContext` kullanılmaz |
| `#time` | Kapsam dışı (zaman takibi modülü gelince eklenir) |
| DB | **Migration yok** — `authorEmail`/`message` yalnızca runtime ref alanları; yeni tablo/kolon gerekmez |
| Frontend | **Değişiklik yok** — durum/yorum mevcut UI'da zaten görünür |

---

## 2. Komut sözdizimi

Commit mesajı veya MR başlık+açıklamasında, bir iş kodunun ardından bir veya daha çok komut:

```
TORA-42 #done veritabanı migrasyonu tamamlandı
TORA-42 #progress #comment review bekliyor
```

- Komutlar `#` ile başlar.
- Aynı metinde birden çok komut olabilir.
- Birden çok kod eşleşirse komut(lar) hepsine uygulanır (mevcut linking davranışıyla tutarlı).
- Kodsuz komut yok sayılır.

### Sabit alias seti

| Komut (alias'lar) | Aksiyon |
|---|---|
| `#done` `#close` `#tamam` `#kapat` | → `COMPLETED` |
| `#progress` `#wip` `#basla` | → `IN_PROGRESS` |
| `#test` `#testing` | → `TESTING` |
| `#cancel` `#iptal` | → `CANCELLED` |
| `#reopen` `#open` `#ac` | → `OPEN` |
| `#comment <metin>` `#yorum <metin>` | → göreve yorum ekle |

`#comment`/`#yorum` metni: komutu izleyen, satır sonuna veya sonraki `#<komut>`'a kadar olan metin. Boşsa yorum eklenmez.

---

## 3. Yeni bileşenler

### `SmartCommand` (record, `com.tora.git`)
```
enum Kind { STATUS, COMMENT }
record SmartCommand(Kind kind, TaskStatus status, String text) {}
```
- `STATUS` → `status` dolu, `text` null.
- `COMMENT` → `text` dolu, `status` null.

### `SmartCommitParser` (saf, yan etkisiz, `com.tora.git`)
- `List<SmartCommand> parse(String text)`.
- Statik alias→`TaskStatus` `Map` (immutable). Türkçe takma adlar dahil.
- `#comment`/`#yorum` için, komuttan sonraki metni sonraki `#` veya satır sonuna kadar toplar, trim eder; boşsa COMMENT üretmez.
- Bilinmeyen `#xyz` → yok say.
- Büyük/küçük harf duyarsız komut eşleme.
- Yan etki yok → kolay birim testi.

---

## 4. `GitWebhookService` entegrasyonu

**Önkoşul — `GitRef.message`:** Komutları ref bazında (her commit'in kendi yazarıyla) işlemek için `GitRef`'e tam tarama metni alanı eklenir: push commit → tam commit mesajı; MR → `title + "\n" + body`. (Mevcut `title` yalnızca ilk satır; komut gövdede olabilir.) Üç parser doldurur.

`process()` akışında, linking'den sonra:

1. Her `GitRef` için, `ref.message` üzerinde:
   - `extractCodes(ref.message)` → o ref'in kendi kodları (yalnızca bu commit/MR'da geçen kodlar).
   - `SmartCommitParser.parse(ref.message)` → komut listesi.
2. O ref'te geçen **kendi** kodlarına karşılık gelen görevlere, o ref'ten gelen komutları uygula (bir commit'teki `#done`, yalnızca o commit'te adı geçen göreve uygulanır — cross-product yapılmaz):
   - **STATUS** → `taskService.updateTaskStatusAsSystem(taskId, status, actor)`. Bu görev için bir STATUS komutu işlendiyse, genel `applyStatusSync` (push/MR ayarı) o görev için **atlanır** (komut > ayar).
   - **COMMENT** → `taskCommentService.createSystemComment(task, text, actor)`.
3. `actor` = `resolveGitActor(ref)` (email-eşleme, §5) — komutun aktörü o commit'in/MR'ın yazarıdır.

**Linking ile ilişki:** Mevcut linking (her matchedTask × ref) değişmez. Smart-commit ayrı bir geçiş: ref bazında kod+komut çıkarımı yapar; böylece doğru görev + doğru aktör eşleşir. STATUS komutu işlenen görevler bir `overridden` set'ine eklenir; `applyStatusSync` yalnızca bu set'te olmayan görevlere genel ayarı uygular.

**Akış sırası (özet):**
1. Linking (mevcut, değişmez).
2. Smart-commit komutları (yeni): her ref → komutlar → eşleşen görevlere uygula; STATUS komutu işlenen görevleri `overridden` set'ine ekle.
3. `applyStatusSync` (mevcut): yalnızca `overridden` set'inde **olmayan** görevlere genel ayarı uygula.

---

## 5. Email-eşleme (`resolveGitActor`)

- **`GitRef`'e `authorEmail` alanı eklenir** (record'a yeni alan). Üç parser doldurur:
  - GitHub push: `commit.author.email`; PR: `pull_request.user` email payload'da yok → null (kullanıcı login'i email değil).
  - Gitea push: `commit.author.email`; PR benzer.
  - GitLab push: `commit.author.email`; MR: `user`/`author` email payload'da güvenilir değilse null.
  - Email yoksa `authorEmail = null`.
- **`resolveGitActor(GitRef ref)`** (event yerine ref bazlı):
  - `ref.authorEmail` varsa `userRepository.findByEmailIgnoreCase(email)` → bulunursa o `User`.
  - Yoksa/bulunamazsa `userRepository.findByUsername("git-otomasyonu")` (mevcut davranış).
- **Etki:** durum değişikliği `changed_by` ve yorum yazarı gerçek kişi olur; eşleşme yoksa sisteme düşer (geriye dönük uyumlu).

> `UserRepository.findByEmailIgnoreCase` yoksa eklenir.

---

## 6. Sistem yorumu

`TaskCommentService.createSystemComment(Task task, String content, User author)`:
- `SecurityContext` kullanmaz (webhook bağlamında auth yok).
- Verilen `author` ile `TaskComment` kaydeder.
- Mention çözümlemesi (`resolveMentions`) çalışır; `notifyCommentMention` + `notifyNewComment` gönderilir.
- Erişim kontrolü (`ensureAccessibleTeam`) **uygulanmaz** — sistem aktörü zaten güvenilir webhook'tan gelir.

---

## 7. Güvenlik / edge durumları

- Komut yalnızca **imzası doğrulanmış** webhook'tan işlenir (mevcut koruma; değişmez).
- Bilinmeyen/geçersiz komut → yok say (debug log).
- Kodsuz komut → yok say.
- Zaten hedef durumda → no-op (`updateTaskStatusAsSystem` mevcut guard).
- COMPLETED'e geçişte zincir görevler tetiklenir (mevcut `publishIfCompleted` akışı).
- `#comment` metni boş → yorum eklenmez.
- Bir görevde hem komut (override) hem genel ayar → komut kazanır, ayar atlanır.

---

## 8. Testler

- **`SmartCommitParserTest`** (yeni): tek/çoklu komut; tüm alias'lar → doğru `TaskStatus`; `#comment` metin sınırı (satır sonu / sonraki `#`); kodsuz komut yok sayılır (parser kod görmez; bu davranış servis testinde); boş comment; büyük/küçük harf; bilinmeyen komut.
- **`GitWebhookServiceTest`** (genişlet): komut→durum override (genel ayar atlanır); komut→yorum (createSystemComment çağrılır); email-eşleşen aktör vs sistem aktörü.
- **Parser testleri** (3 mevcut): `authorEmail` doğru çıkarılıyor.

---

## 9. Kapsam dışı (sonraki)

- **Outbound:** "Branch oluştur / MR oluştur", repo token saklama, git API'sine yazma — ayrı sub-project.
- **`#time` komutu** — zaman takibi (`time_entries`) modülüyle birlikte.
- Komut→durum eşlemesinin admin panelinden yapılandırılması (şimdilik sabit).
