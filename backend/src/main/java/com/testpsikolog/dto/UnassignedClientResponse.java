package com.testpsikolog.dto;

/** K7: kliniğe bağlı ama şu an hiçbir psikoloğa atanmamış danışan (ayrılan/çıkarılan üyeden kalan). */
public record UnassignedClientResponse(long id, String name, String email, String phone) {
}
