package com.testpsikolog.controller;

import com.testpsikolog.dto.ClinicMineResponse;
import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.ClinicRoomResponse;
import com.testpsikolog.dto.CreateClinicRequest;
import com.testpsikolog.dto.CreateRoomRequest;
import com.testpsikolog.dto.DeletedResponse;
import com.testpsikolog.dto.JoinClinicRequest;
import com.testpsikolog.dto.MessageResponse;
import com.testpsikolog.dto.TransferOwnerRequest;
import com.testpsikolog.dto.UpdateClinicRequest;
import com.testpsikolog.dto.UpdateRoomRequest;
import com.testpsikolog.service.ClinicService;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ClinicController {

    private final ClinicService clinicService;
    private final CurrentUserService currentUserService;

    public ClinicController(ClinicService clinicService, CurrentUserService currentUserService) {
        this.clinicService = clinicService;
        this.currentUserService = currentUserService;
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
