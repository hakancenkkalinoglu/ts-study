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
import com.testpsikolog.service.InventoryService;
import com.testpsikolog.service.NoteService;
import com.testpsikolog.service.PackageService;
import java.nio.file.Path;
import java.util.List;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ClientController {

    private final ClientService clientService;
    private final NoteService noteService;
    private final PackageService packageService;
    private final InventoryService inventoryService;
    private final CurrentUserService currentUserService;

    public ClientController(
            ClientService clientService,
            NoteService noteService,
            PackageService packageService,
            InventoryService inventoryService,
            CurrentUserService currentUserService
    ) {
        this.clientService = clientService;
        this.noteService = noteService;
        this.packageService = packageService;
        this.inventoryService = inventoryService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/clients")
    public List<ClientResponse> getClients(@RequestParam(value = "search", required = false) String search) {
        long userId = currentUserService.requireUser().id();
        return clientService.getAll(userId, search);
    }

    @GetMapping("/clients/{id}")
    public ClientResponse getClient(@PathVariable long id) {
        long userId = currentUserService.requireUser().id();
        ClientResponse client = clientService.getById(userId, id);
        if (client == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Danışan bulunamadı.");
        }
        return client;
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
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Danışan bulunamadı.");
        }
        return new UpdatedResponse(updated);
    }

    @DeleteMapping("/clients/{id}")
    public DeletedResponse deleteClient(@PathVariable long id) {
        long userId = currentUserService.requireUser().id();
        int deleted = clientService.delete(userId, id);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Danışan bulunamadı.");
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

    @PostMapping("/clients/{clientId}/notes/{noteId}/file")
    public NoteResponse attachNoteFile(
            @PathVariable long clientId,
            @PathVariable long noteId,
            @RequestParam("file") MultipartFile file
    ) {
        long userId = currentUserService.requireUser().id();
        return noteService.attachFile(userId, clientId, noteId, file);
    }

    @GetMapping("/clients/{clientId}/notes/{noteId}/file")
    public ResponseEntity<Resource> downloadNoteFile(@PathVariable long clientId, @PathVariable long noteId) {
        long userId = currentUserService.requireUser().id();
        Path path = noteService.loadFile(userId, clientId, noteId);
        String fileName = noteService.fileNameOf(userId, clientId, noteId);
        Resource resource = new FileSystemResource(path);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @DeleteMapping("/clients/{clientId}/notes/{noteId}/file")
    public DeletedResponse deleteNoteFile(@PathVariable long clientId, @PathVariable long noteId) {
        long userId = currentUserService.requireUser().id();
        noteService.removeFile(userId, clientId, noteId);
        return new DeletedResponse(1);
    }

    @GetMapping("/clients/{clientId}/packages")
    public List<com.testpsikolog.dto.SessionPackageResponse> listPackages(@PathVariable long clientId) {
        long userId = currentUserService.requireUser().id();
        return packageService.list(userId, clientId);
    }

    @PostMapping("/clients/{clientId}/packages")
    @ResponseStatus(HttpStatus.CREATED)
    public com.testpsikolog.dto.SessionPackageResponse createPackage(
            @PathVariable long clientId,
            @RequestBody com.testpsikolog.dto.CreatePackageRequest request
    ) {
        long userId = currentUserService.requireUser().id();
        return packageService.create(userId, clientId, request);
    }

    @PostMapping("/clients/{clientId}/packages/{packageId}/consume")
    public com.testpsikolog.dto.SessionPackageResponse consumePackage(
            @PathVariable long clientId,
            @PathVariable long packageId
    ) {
        long userId = currentUserService.requireUser().id();
        return packageService.consume(userId, clientId, packageId);
    }

    @DeleteMapping("/clients/{clientId}/packages/{packageId}")
    public DeletedResponse deletePackage(@PathVariable long clientId, @PathVariable long packageId) {
        long userId = currentUserService.requireUser().id();
        packageService.delete(userId, clientId, packageId);
        return new DeletedResponse(1);
    }

    @GetMapping("/inventories")
    public List<com.testpsikolog.dto.InventorySummaryResponse> listInventories() {
        currentUserService.requireUser();
        return inventoryService.listInventories();
    }

    @GetMapping("/inventories/{inventoryId}")
    public com.testpsikolog.dto.InventoryDetailResponse getInventory(@PathVariable long inventoryId) {
        currentUserService.requireUser();
        return inventoryService.getInventory(inventoryId);
    }

    @GetMapping("/clients/{clientId}/inventories")
    public List<com.testpsikolog.dto.InventoryResultResponse> listInventoryResults(@PathVariable long clientId) {
        long userId = currentUserService.requireUser().id();
        return inventoryService.listResults(userId, clientId);
    }

    @PostMapping("/clients/{clientId}/inventories/{inventoryId}")
    @ResponseStatus(HttpStatus.CREATED)
    public com.testpsikolog.dto.InventoryResultResponse submitInventory(
            @PathVariable long clientId,
            @PathVariable long inventoryId,
            @RequestBody com.testpsikolog.dto.SubmitInventoryRequest request
    ) {
        long userId = currentUserService.requireUser().id();
        return inventoryService.submit(userId, clientId, inventoryId, request);
    }
}
