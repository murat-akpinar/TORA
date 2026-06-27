package com.tora.git;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HmacUtilTest {

    @Test
    void hmacSha256_knownVector() {
        String h1 = HmacUtil.hmacSha256Hex("hello".getBytes(), "secret");
        String h2 = HmacUtil.hmacSha256Hex("hello".getBytes(), "secret");
        assertEquals(h1, h2);
        assertEquals(64, h1.length());
        assertNotEquals(h1, HmacUtil.hmacSha256Hex("hello".getBytes(), "other"));
    }

    @Test
    void constantTimeEquals_works() {
        assertTrue(HmacUtil.constantTimeEquals("abc", "abc"));
        assertFalse(HmacUtil.constantTimeEquals("abc", "abd"));
        assertFalse(HmacUtil.constantTimeEquals("abc", null));
        assertFalse(HmacUtil.constantTimeEquals(null, "abc"));
    }
}
