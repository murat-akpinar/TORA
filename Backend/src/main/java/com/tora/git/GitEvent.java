package com.tora.git;

import java.util.List;

public record GitEvent(
    String platform,
    GitEventType type,
    List<String> codeTexts,
    List<GitRef> refs
) {}
