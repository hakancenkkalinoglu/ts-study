package com.testpsikolog.dto;

/**
 * @param password    Yeni hesapta belirlenecek şifre; hesap zaten varsa mevcut şifre.
 * @param displayName Yalnızca yeni hesap için.
 */
public record AcceptInvitationRequest(String password, String displayName) {
}
