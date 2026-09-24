package com.testpsikolog.controller;

import com.testpsikolog.dto.AcceptInvitationRequest;
import com.testpsikolog.dto.CreateInvitationRequest;
import com.testpsikolog.dto.DeletedResponse;
import com.testpsikolog.dto.InvitationPreviewResponse;
import com.testpsikolog.dto.InvitationResponse;
import com.testpsikolog.dto.LoginResponse;
import com.testpsikolog.service.CurrentUserService;
import com.testpsikolog.service.InvitationService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class InvitationController {

    private final InvitationService invitationService;
    private final CurrentUserService currentUserService;

    public InvitationController(InvitationService invitationService, CurrentUserService currentUserService) {
        this.invitationService = invitationService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/clinic/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationResponse create(@RequestBody CreateInvitationRequest request) {
        long userId = currentUserService.requireUser().id();
        return invitationService.create(userId, request);
    }

    @GetMapping("/clinic/invitations")
    public List<InvitationResponse> list() {
        long userId = currentUserService.requireUser().id();
        return invitationService.list(userId);
    }

    @DeleteMapping("/clinic/invitations/{invitationId}")
    public DeletedResponse revoke(@PathVariable long invitationId) {
        long userId = currentUserService.requireUser().id();
        invitationService.revoke(userId, invitationId);
        return new DeletedResponse(1);
    }

    @GetMapping("/auth/invitations/{token}")
    public InvitationPreviewResponse preview(@PathVariable String token) {
        return invitationService.preview(token);
    }

    @PostMapping("/auth/invitations/{token}/accept")
    public LoginResponse accept(@PathVariable String token, @RequestBody AcceptInvitationRequest request) {
        return invitationService.accept(token, request);
    }
}
