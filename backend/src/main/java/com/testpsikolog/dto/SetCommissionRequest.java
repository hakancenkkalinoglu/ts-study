package com.testpsikolog.dto;

import java.math.BigDecimal;

/**
 * @param percent   0-100 arası klinik payı. Psikolog bazlı çağrıda null, "varsayılan orana dön" demektir.
 * @param validFrom YYYY-MM-DD; boşsa bugün.
 */
public record SetCommissionRequest(BigDecimal percent, String validFrom) {
}
