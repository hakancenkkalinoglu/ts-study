package com.testpsikolog.service;

import com.testpsikolog.dto.InventoryDetailResponse;
import com.testpsikolog.dto.InventoryItemResponse;
import com.testpsikolog.dto.InventoryResultResponse;
import com.testpsikolog.dto.InventorySummaryResponse;
import com.testpsikolog.dto.SubmitInventoryRequest;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InventoryService {

    private final JdbcTemplate jdbc;
    private final ClientService clientService;

    public InventoryService(JdbcTemplate jdbc, ClientService clientService) {
        this.jdbc = jdbc;
        this.clientService = clientService;
    }

    public List<InventorySummaryResponse> listInventories() {
        return jdbc.query(
                """
                SELECT i.id, i.code, i.name, i.description, i.maxScore,
                       (SELECT COUNT(*) FROM psych_inventory_items it WHERE it.inventoryId = i.id) AS itemCount
                FROM psych_inventories i
                ORDER BY i.id ASC
                """,
                (rs, rowNum) -> new InventorySummaryResponse(
                        rs.getLong("id"),
                        rs.getString("code"),
                        rs.getString("name"),
                        rs.getString("description"),
                        rs.getInt("maxScore"),
                        rs.getInt("itemCount")
                )
        );
    }

    public InventoryDetailResponse getInventory(long inventoryId) {
        List<InventorySummaryResponse> headers = jdbc.query(
                "SELECT id, code, name, description, maxScore, 0 AS itemCount FROM psych_inventories WHERE id = ?",
                (rs, rowNum) -> new InventorySummaryResponse(
                        rs.getLong("id"),
                        rs.getString("code"),
                        rs.getString("name"),
                        rs.getString("description"),
                        rs.getInt("maxScore"),
                        0
                ),
                inventoryId
        );
        if (headers.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ölçek bulunamadı.");
        }
        InventorySummaryResponse header = headers.get(0);
        List<InventoryItemResponse> items = jdbc.query(
                "SELECT id, sortOrder, prompt FROM psych_inventory_items WHERE inventoryId = ? ORDER BY sortOrder ASC",
                (rs, rowNum) -> new InventoryItemResponse(
                        rs.getLong("id"),
                        rs.getInt("sortOrder"),
                        rs.getString("prompt")
                ),
                inventoryId
        );
        return new InventoryDetailResponse(
                header.id(),
                header.code(),
                header.name(),
                header.description(),
                header.maxScore(),
                items
        );
    }

    public InventoryResultResponse submit(long userId, long clientId, long inventoryId, SubmitInventoryRequest request) {
        clientService.requireOwned(userId, clientId);
        InventoryDetailResponse inventory = getInventory(inventoryId);
        List<Integer> answers = request == null || request.answers() == null ? List.of() : request.answers();
        if (answers.size() != inventory.items().size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tüm maddeleri yanıtlayın.");
        }
        int score = 0;
        StringBuilder encoded = new StringBuilder();
        for (int index = 0; index < answers.size(); index++) {
            Integer value = answers.get(index);
            if (value == null || value < 0 || value > 3) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Yanıt 0 ile 3 arasında olmalı.");
            }
            score += value;
            if (index > 0) {
                encoded.append(',');
            }
            encoded.append(value);
        }
        String interpretation = interpret(inventory.code(), score);
        jdbc.update(
                """
                INSERT INTO client_inventory_results (clientId, inventoryId, answers, score, interpretation, createdAt)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
                """,
                clientId,
                inventoryId,
                encoded.toString(),
                score,
                interpretation
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        return new InventoryResultResponse(
                id == null ? 0L : id,
                inventoryId,
                inventory.name(),
                score,
                inventory.maxScore(),
                interpretation,
                java.time.LocalDateTime.now().toString()
        );
    }

    public List<InventoryResultResponse> listResults(long userId, long clientId) {
        clientService.requireOwned(userId, clientId);
        return jdbc.query(
                """
                SELECT r.id, r.inventoryId, i.name AS inventoryName, r.score, i.maxScore, r.interpretation, r.createdAt
                FROM client_inventory_results r
                INNER JOIN psych_inventories i ON i.id = r.inventoryId
                WHERE r.clientId = ?
                ORDER BY r.createdAt DESC, r.id DESC
                """,
                (rs, rowNum) -> new InventoryResultResponse(
                        rs.getLong("id"),
                        rs.getLong("inventoryId"),
                        rs.getString("inventoryName"),
                        rs.getInt("score"),
                        rs.getInt("maxScore"),
                        rs.getString("interpretation"),
                        rs.getString("createdAt")
                ),
                clientId
        );
    }

    public void seedCatalog() {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM psych_inventories", Integer.class);
        if (count != null && count > 0) {
            return;
        }
        insertInventory(
                "PHQ-9",
                "PHQ-9 (Depresyon tarama)",
                "Son iki haftadaki belirtiler. 0 Hiç, 1 Birkaç gün, 2 Haftanın yarısından fazla, 3 Hemen her gün.",
                27,
                List.of(
                        "İşlerinize ilgi duymama veya zevk alamama",
                        "Kendinizi hüzünlü, depresif veya umutsuz hissetme",
                        "Uykuya dalamama, uykuyu sürdürememe veya fazla uyuma",
                        "Yorgun hissetme veya enerjinizin az olması",
                        "İştahsızlık veya aşırı yeme",
                        "Kendinizi kötü hissetme; başarısız olduğunuzu veya kendinizi ya da ailenizi hayal kırıklığına uğrattığınızı düşünme",
                        "Konuşurken veya gazete okurken dikkatini toplamakta zorlanma",
                        "Başkalarının fark edebileceği kadar yavaş hareket etme veya konuşma, ya da tam tersi aşırı hareketlilik",
                        "Ölmek daha iyi olurdu düşüncesi veya kendinize zarar verme düşüncesi"
                )
        );
        insertInventory(
                "GAD-7",
                "GAD-7 (Kaygı tarama)",
                "Son iki haftadaki belirtiler. 0 Hiç, 1 Birkaç gün, 2 Haftanın yarısından fazla, 3 Hemen her gün.",
                21,
                List.of(
                        "Sinirli, kaygılı veya gergin hissetme",
                        "Kaygınızı kontrol edememe veya durduramama",
                        "Çeşitli şeyler hakkında fazla endişelenme",
                        "Rahatlamakta zorlanma",
                        "Öyle bir yerinde duramama ki oturmak güç geliyor",
                        "Kolayca sinirlenme veya öfkelenme",
                        "Kötü bir şey olacakmış gibi korkma"
                )
        );
    }

    private void insertInventory(String code, String name, String description, int maxScore, List<String> prompts) {
        jdbc.update(
                "INSERT INTO psych_inventories (code, name, description, maxScore) VALUES (?, ?, ?, ?)",
                code,
                name,
                description,
                maxScore
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        if (id == null) {
            return;
        }
        for (int index = 0; index < prompts.size(); index++) {
            jdbc.update(
                    "INSERT INTO psych_inventory_items (inventoryId, sortOrder, prompt) VALUES (?, ?, ?)",
                    id,
                    index + 1,
                    prompts.get(index)
            );
        }
    }

    private static String interpret(String code, int score) {
        if ("PHQ-9".equals(code)) {
            if (score <= 4) {
                return "Minimal depresif belirti";
            }
            if (score <= 9) {
                return "Hafif depresif belirti";
            }
            if (score <= 14) {
                return "Orta düzeyde depresif belirti";
            }
            if (score <= 19) {
                return "Orta-ağır depresif belirti";
            }
            return "Ağır depresif belirti";
        }
        if (score <= 4) {
            return "Minimal kaygı";
        }
        if (score <= 9) {
            return "Hafif kaygı";
        }
        if (score <= 14) {
            return "Orta düzeyde kaygı";
        }
        return "Ağır kaygı";
    }

    @Component
    @Order(3)
    public static class InventoryCatalogSeeder implements ApplicationRunner {
        private final InventoryService inventoryService;

        public InventoryCatalogSeeder(InventoryService inventoryService) {
            this.inventoryService = inventoryService;
        }

        @Override
        public void run(ApplicationArguments args) {
            inventoryService.seedCatalog();
        }
    }
}
