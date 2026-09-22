package com.testpsikolog.util;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.List;

public final class AttachmentFiles {

    private AttachmentFiles() {
    }

    public static void deleteQuietly(List<String> paths) {
        for (String path : paths) {
            if (path == null || path.isBlank()) {
                continue;
            }
            try {
                Files.deleteIfExists(Path.of(path));
            } catch (IOException | InvalidPathException ex) {
                System.out.println("Attachment delete failed: " + ex.getMessage());
            }
        }
    }
}
