package com.tora.event;

/** Bir görev COMPLETED'e geçtiğinde yayınlanır; zincir tetikleme bunu commit sonrası dinler. */
public record TaskCompletedEvent(Long sourceTaskId, Long completerId) {}
