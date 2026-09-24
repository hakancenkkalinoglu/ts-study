package com.testpsikolog.controller;

import com.testpsikolog.dto.BlockedSlotResponse;
import com.testpsikolog.dto.CreateBlockedSlotRequest;
import com.testpsikolog.dto.UpdateBlockedSlotRequest;
import com.testpsikolog.dto.DeletedResponse;
import com.testpsikolog.service.CurrentUserService;
import com.testpsikolog.service.ScheduleService;
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
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final CurrentUserService currentUserService;

    public ScheduleController(ScheduleService scheduleService, CurrentUserService currentUserService) {
        this.scheduleService = scheduleService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/me/blocked-slots")
    public List<BlockedSlotResponse> list(
            @RequestParam String from,
            @RequestParam String to
    ) {
        long userId = currentUserService.requireUser().id();
        return scheduleService.list(userId, from, to);
    }

    @PostMapping("/me/blocked-slots")
    @ResponseStatus(HttpStatus.CREATED)
    public BlockedSlotResponse create(@RequestBody CreateBlockedSlotRequest request) {
        long userId = currentUserService.requireUser().id();
        return scheduleService.create(userId, request);
    }

    @PutMapping("/me/blocked-slots/{id}")
    public BlockedSlotResponse update(@PathVariable long id, @RequestBody UpdateBlockedSlotRequest request) {
        long userId = currentUserService.requireUser().id();
        return scheduleService.update(userId, id, request);
    }

    @DeleteMapping("/me/blocked-slots/{id}")
    public DeletedResponse delete(@PathVariable long id) {
        long userId = currentUserService.requireUser().id();
        int deleted = scheduleService.delete(userId, id);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Kapalı saat bulunamadı.");
        }
        return new DeletedResponse(deleted);
    }
}
