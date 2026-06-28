package com.tora.git;

import com.tora.model.enums.TaskStatus;

public record SmartCommand(Kind kind, TaskStatus status, String text) {

    public enum Kind { STATUS, COMMENT }

    public static SmartCommand status(TaskStatus status) {
        return new SmartCommand(Kind.STATUS, status, null);
    }

    public static SmartCommand comment(String text) {
        return new SmartCommand(Kind.COMMENT, null, text);
    }
}
