package com.tora.model.enums;

public enum SlaStatus {
    ON_TRACK,   // Açık iş, SLA süresi içinde
    AT_RISK,    // Açık iş, son tarihe az kaldı (eşiğin ~%80'i geçildi)
    BREACHED,   // SLA süresi aşıldı (açık ya da geç tamamlanmış)
    MET         // SLA süresi içinde tamamlandı
}
