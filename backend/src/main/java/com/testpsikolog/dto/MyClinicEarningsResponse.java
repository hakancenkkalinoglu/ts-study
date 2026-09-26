package com.testpsikolog.dto;

/** Psikoloğun tek bir klinikteki kazanç raporu; "tüm klinikler" görünümü bunların listesidir. */
public record MyClinicEarningsResponse(long clinicId, String clinicName, ClinicReportResponse report) {
}
