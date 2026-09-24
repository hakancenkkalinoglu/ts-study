package com.testpsikolog.service;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Klinik içindeki yönetim yetkileri. Roller bu yetkilerin kümesine eşlenir; yeni rol
 * (ör. sekreter) eklemek için {@link #forRole(String)} içine bir dal eklemek yeterli.
 */
public enum ClinicPermission {
    MANAGE_CLINIC,
    MANAGE_ROOMS,
    INVITE_MEMBERS,
    MANAGE_MEMBERS,
    SET_COMMISSION,
    MANAGE_PAYMENTS,
    VIEW_CLINIC_SCHEDULE,
    VIEW_CLINIC_REPORTS;

    public static Set<ClinicPermission> forRole(String role) {
        if ("owner".equals(role)) {
            return EnumSet.allOf(ClinicPermission.class);
        }
        return EnumSet.noneOf(ClinicPermission.class);
    }

    public static List<String> namesForRole(String role) {
        return forRole(role).stream().map(Enum::name).sorted().toList();
    }

    public static List<String> allNames() {
        return Arrays.stream(values()).map(Enum::name).toList();
    }
}
