package com.testpsikolog.dto;

/** @param role "member" (psikolog) ya da "secretary" (sekreter); boşsa "member" varsayılır. */
public record CreateInvitationRequest(String email, String role) {
}
