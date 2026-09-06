package com.testpsikolog.controller;

import com.testpsikolog.dto.ClientResponse;
import com.testpsikolog.dto.CreateClientRequest;
import com.testpsikolog.dto.CreateNoteRequest;
import com.testpsikolog.dto.DeletedResponse;
import com.testpsikolog.dto.IdResponse;
import com.testpsikolog.dto.NoteResponse;
import com.testpsikolog.dto.UpdateClientRequest;
import com.testpsikolog.dto.UpdateNoteRequest;
import com.testpsikolog.dto.UpdatedResponse;
import com.testpsikolog.service.ClientService;
import com.testpsikolog.service.CurrentUserService;
import com.testpsikolog.service.NoteService;
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
public class ClientController {

    private final ClientService clientService;
    private final NoteService noteService;
    private final CurrentUserService currentUserService;

    public ClientController(
            ClientService clientService,
            NoteService noteService,
            CurrentUserService currentUserService
    ) {
        this.clientService = clientService;
        this.noteService = noteService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/clients")
    public List<ClientResponse> getClients(@RequestParam(value = "search", required = false) String search) {
        long userId = currentUserService.requireUser().id();
        return clientService.getAll(userId, search);
    }

    @PostMapping("/clients")
    @ResponseStatus(HttpStatus.CREATED)
    public IdResponse createClient(@RequestBody CreateClientRequest request) {
        long userId = currentUserService.requireUser().id();
        return new IdResponse(clientService.create(userId, request));
    }

    @PutMapping("/clients/{id}")
    public UpdatedResponse updateClient(@PathVariable long id, @RequestBody UpdateClientRequest request) {
        long userId = currentUserService.requireUser().id();
        int updated = clientService.update(userId, id, request);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found");
        }
        return new UpdatedResponse(updated);
    }

    @DeleteMapping("/clients/{id}")
    public DeletedResponse deleteClient(@PathVariable long id) {
        long userId = currentUserService.requireUser().id();
        int deleted = clientService.delete(userId, id);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found");
        }
        return new DeletedResponse(deleted);
    }

    @GetMapping("/clients/{clientId}/notes")
    public List<NoteResponse> getClientNotes(@PathVariable long clientId) {
        long userId = currentUserService.requireUser().id();
        return noteService.getByClientId(userId, clientId);
    }

    @PostMapping("/clients/{clientId}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public IdResponse createClientNote(@PathVariable long clientId, @RequestBody CreateNoteRequest body) {
        long userId = currentUserService.requireUser().id();
        CreateNoteRequest merged = new CreateNoteRequest(
                clientId,
                body.appointmentId(),
                body.title(),
                body.content(),
                body.noteDate()
        );
        return new IdResponse(noteService.create(userId, merged));
    }

    @PutMapping("/clients/{clientId}/notes/{noteId}")
    public UpdatedResponse updateClientNote(
            @PathVariable long clientId,
            @PathVariable long noteId,
            @RequestBody UpdateNoteRequest body
    ) {
        long userId = currentUserService.requireUser().id();
        int updated = noteService.update(userId, clientId, noteId, body);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Not bulunamadı.");
        }
        return new UpdatedResponse(updated);
    }

    @DeleteMapping("/clients/{clientId}/notes/{noteId}")
    public DeletedResponse deleteClientNote(@PathVariable long clientId, @PathVariable long noteId) {
        long userId = currentUserService.requireUser().id();
        int deleted = noteService.delete(userId, clientId, noteId);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Not bulunamadı.");
        }
        return new DeletedResponse(deleted);
    }
}
