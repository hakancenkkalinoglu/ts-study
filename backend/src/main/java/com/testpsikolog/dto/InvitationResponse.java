package com.testpsikolog.dto;

/**
 * @param inviteUrl Yalnızca davet oluşturulurken dolu döner; token yalnızca hash'i saklandığı için sonradan geri alınamaz.
 */
public record InvitationResponse(long id, String email, long expiresAt, String inviteUrl) {
}
