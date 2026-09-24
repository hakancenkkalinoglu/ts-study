package com.testpsikolog.dto;

import java.util.List;

public record ClinicResponse(
        long id,
        String name,
        String inviteCode,
        long ownerUserId,
        String role,
        List<ClinicMemberResponse> members,
        List<ClinicRoomResponse> rooms,
        List<String> permissions
) {
}
