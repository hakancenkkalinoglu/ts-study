package com.testpsikolog.controller;

import com.testpsikolog.dto.ClinicMineResponse;
import com.testpsikolog.dto.ClinicFeeReportResponse;
import com.testpsikolog.dto.ClinicOverviewResponse;
import com.testpsikolog.dto.ClinicReportResponse;
import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.ClinicRoomResponse;
import com.testpsikolog.dto.CommissionOverviewResponse;
import com.testpsikolog.dto.CreateClinicRequest;
import com.testpsikolog.dto.CreateRoomRequest;
import com.testpsikolog.dto.DeletedResponse;
import com.testpsikolog.dto.JoinClinicRequest;
import com.testpsikolog.dto.MessageResponse;
import com.testpsikolog.dto.RecordSharePaymentRequest;
import com.testpsikolog.dto.SetCommissionRequest;
import com.testpsikolog.dto.SharePaymentResponse;
import com.testpsikolog.dto.TransferOwnerRequest;
import com.testpsikolog.dto.UpdateClinicRequest;
import com.testpsikolog.dto.UpdateRoomRequest;
import com.testpsikolog.service.ClinicOverviewService;
import com.testpsikolog.service.ClinicReportService;
import com.testpsikolog.service.ClinicService;
import com.testpsikolog.service.SharePaymentService;
import com.testpsikolog.service.CommissionService;
import com.testpsikolog.service.CurrentUserService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ClinicController {

    private final ClinicService clinicService;
    private final CurrentUserService currentUserService;
    private final CommissionService commissionService;
    private final ClinicReportService reportService;
    private final ClinicOverviewService overviewService;
    private final SharePaymentService sharePaymentService;

    public ClinicController(
            ClinicService clinicService,
            CurrentUserService currentUserService,
            CommissionService commissionService,
            ClinicReportService reportService,
            ClinicOverviewService overviewService,
            SharePaymentService sharePaymentService
    ) {
        this.clinicService = clinicService;
        this.currentUserService = currentUserService;
        this.commissionService = commissionService;
        this.reportService = reportService;
        this.overviewService = overviewService;
        this.sharePaymentService = sharePaymentService;
    }

    @GetMapping("/clinic")
    public ClinicMineResponse getMine() {
        long userId = currentUserService.requireUser().id();
        return new ClinicMineResponse(clinicService.getMine(userId));
    }

    @GetMapping("/clinic/rooms")
    public List<ClinicRoomResponse> listRooms() {
        long userId = currentUserService.requireUser().id();
        return clinicService.listRooms(userId);
    }

    @PostMapping("/clinic")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicResponse create(@RequestBody CreateClinicRequest request) {
        long userId = currentUserService.requireUser().id();
        return clinicService.create(userId, request);
    }

    @PostMapping("/clinic/join")
    public ClinicResponse join(@RequestBody JoinClinicRequest request) {
        long userId = currentUserService.requireUser().id();
        return clinicService.join(userId, request);
    }

    @PostMapping("/clinic/leave")
    public MessageResponse leave() {
        long userId = currentUserService.requireUser().id();
        clinicService.leave(userId);
        return new MessageResponse("Klinikten ayrıldınız.");
    }

    @DeleteMapping("/clinic")
    public DeletedResponse deleteClinic() {
        long userId = currentUserService.requireUser().id();
        clinicService.deleteClinic(userId);
        return new DeletedResponse(1);
    }

    @PutMapping("/clinic")
    public ClinicResponse rename(@RequestBody UpdateClinicRequest request) {
        long userId = currentUserService.requireUser().id();
        return clinicService.rename(userId, request);
    }

    @PostMapping("/clinic/invite/rotate")
    public ClinicResponse rotateInvite() {
        long userId = currentUserService.requireUser().id();
        return clinicService.rotateInvite(userId);
    }

    @DeleteMapping("/clinic/members/{memberUserId}")
    public ClinicResponse kickMember(@PathVariable long memberUserId) {
        long userId = currentUserService.requireUser().id();
        return clinicService.kickMember(userId, memberUserId);
    }

    @PostMapping("/clinic/transfer")
    public ClinicResponse transfer(@RequestBody TransferOwnerRequest request) {
        long userId = currentUserService.requireUser().id();
        return clinicService.transferOwnership(userId, request);
    }

    @GetMapping("/clinic/commissions")
    public CommissionOverviewResponse commissions() {
        long userId = currentUserService.requireUser().id();
        return commissionService.overview(userId);
    }

    @PutMapping("/clinic/commissions/default")
    public CommissionOverviewResponse setDefaultCommission(@RequestBody SetCommissionRequest request) {
        long userId = currentUserService.requireUser().id();
        return commissionService.setDefault(userId, request);
    }

    @PostMapping("/clinic/commissions/apply-all")
    public CommissionOverviewResponse applyCommissionToAll(@RequestBody SetCommissionRequest request) {
        long userId = currentUserService.requireUser().id();
        return commissionService.applyToAll(userId, request);
    }

    @PutMapping("/clinic/commissions/members/{memberUserId}")
    public CommissionOverviewResponse setMemberCommission(
            @PathVariable long memberUserId,
            @RequestBody SetCommissionRequest request
    ) {
        long userId = currentUserService.requireUser().id();
        return commissionService.setForMember(userId, memberUserId, request);
    }

    @GetMapping("/clinic/overview")
    public ClinicOverviewResponse overview(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        long userId = currentUserService.requireUser().id();
        return overviewService.overview(userId, from, to);
    }

    @GetMapping("/clinic/fee-report")
    public ClinicFeeReportResponse feeReport(@RequestParam(required = false) String month) {
        long userId = currentUserService.requireUser().id();
        return reportService.feeReport(userId, month);
    }

    @PostMapping("/clinic/share-payments")
    @ResponseStatus(HttpStatus.CREATED)
    public SharePaymentResponse recordSharePayment(@RequestBody RecordSharePaymentRequest request) {
        long userId = currentUserService.requireUser().id();
        return sharePaymentService.record(userId, request);
    }

    @DeleteMapping("/clinic/share-payments/{paymentId}")
    public DeletedResponse deleteSharePayment(@PathVariable long paymentId) {
        long userId = currentUserService.requireUser().id();
        sharePaymentService.delete(userId, paymentId);
        return new DeletedResponse(1);
    }

    @GetMapping("/clinic/my-earnings")
    public ClinicReportResponse myEarnings(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        long userId = currentUserService.requireUser().id();
        return reportService.myEarnings(userId, from, to);
    }

    @PostMapping("/clinic/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicRoomResponse addRoom(@RequestBody CreateRoomRequest request) {
        long userId = currentUserService.requireUser().id();
        return clinicService.addRoom(userId, request);
    }

    @PutMapping("/clinic/rooms/{roomId}")
    public ClinicRoomResponse updateRoom(@PathVariable long roomId, @RequestBody UpdateRoomRequest request) {
        long userId = currentUserService.requireUser().id();
        return clinicService.updateRoom(userId, roomId, request);
    }

    @DeleteMapping("/clinic/rooms/{roomId}")
    public DeletedResponse deleteRoom(@PathVariable long roomId) {
        long userId = currentUserService.requireUser().id();
        clinicService.deleteRoom(userId, roomId);
        return new DeletedResponse(1);
    }
}
