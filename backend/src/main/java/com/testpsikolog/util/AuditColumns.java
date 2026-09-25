package com.testpsikolog.util;

/**
 * "Kaydı kim oluşturdu / kim güncelledi" sütunları (createdBy, updatedBy) için ortak SQL parçaları.
 */
public final class AuditColumns {

    private AuditColumns() {
    }

    /** Kullanıcı kimliği sütunundan görünen ada çeviren skaler alt sorgu, verilen takma adla. */
    public static String userName(String userIdColumn, String alias) {
        return "(SELECT COALESCE(NULLIF(u.displayName, ''), NULLIF(u.email, ''), u.username)"
                + " FROM app_users u WHERE u.id = " + userIdColumn + ") AS " + alias;
    }

    /** SELECT listesine eklenecek createdByName ve updatedByName alanları. */
    public static String names(String table) {
        return userName(table + ".createdBy", "createdByName") + ", "
                + userName(table + ".updatedBy", "updatedByName");
    }
}
