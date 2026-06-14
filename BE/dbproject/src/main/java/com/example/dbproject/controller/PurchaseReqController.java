package com.example.dbproject.controller;

import com.example.dbproject.dto.CompletedSaleDto;
import com.example.dbproject.dto.PurchasedItemDto;
import com.example.dbproject.entity.Item;
import com.example.dbproject.entity.ItemId;
import com.example.dbproject.entity.PurchaseReq;
import com.example.dbproject.entity.PurchaseReqId;
import com.example.dbproject.repository.ItemRepository;
import com.example.dbproject.repository.PurchaseReqRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/purchase")
@CrossOrigin(origins = "http://localhost:5173")
public class PurchaseReqController {

    @Autowired
    private PurchaseReqRepository purchaseReqRepository;

    @Autowired
    private ItemRepository itemRepository;

    // 구매 요청 전송
    // body: { requestCno, cno, itemNo, reqPrice, reqMessage }
    @PostMapping
    public ResponseEntity<?> createRequest(@RequestBody PurchaseReq req) {
        if (req.getRequestCno().equals(req.getCno())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("본인 상품에는 구매 요청을 할 수 없습니다.");
        }
        PurchaseReqId id = new PurchaseReqId(req.getRequestCno(), req.getCno(), req.getItemNo());
        if (purchaseReqRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("이미 구매 요청을 보냈습니다.");
        }
        Optional<Item> itemOpt = itemRepository.findById(new ItemId(req.getCno(), req.getItemNo()));
        if (itemOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }
        if (!"판매 중".equals(itemOpt.get().getSellStatus())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("판매 중인 상품에만 구매 요청할 수 있습니다.");
        }
        req.setReqDateTime(LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.CREATED).body(purchaseReqRepository.save(req));
    }

    // 특정 상품에 들어온 구매 요청 목록 (판매자용)
    @GetMapping("/item/{cno}/{itemNo}")
    public ResponseEntity<List<PurchaseReq>> getRequestsForItem(
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo) {
        return ResponseEntity.ok(purchaseReqRepository.findByCnoAndItemNo(cno, itemNo));
    }

    // 내가 보낸 구매 요청 목록 (구매자용)
    @GetMapping("/sent/{requestCno}")
    public ResponseEntity<List<PurchaseReq>> getSentRequests(@PathVariable("requestCno") String requestCno) {
        return ResponseEntity.ok(purchaseReqRepository.findByRequestCno(requestCno));
    }

    // 구매 요청 승인 → 상품 sellStatus = '예약 중', resDateTime 기록, 나머지 요청 자동 삭제
    @Transactional
    @PatchMapping("/{requestCno}/{cno}/{itemNo}/approve")
    public ResponseEntity<?> approveRequest(
            @PathVariable("requestCno") String requestCno,
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo) {
        if (!purchaseReqRepository.existsById(new PurchaseReqId(requestCno, cno, itemNo))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("구매 요청을 찾을 수 없습니다.");
        }
        Optional<Item> itemOpt = itemRepository.findById(new ItemId(cno, itemNo));
        if (itemOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }
        Item item = itemOpt.get();
        item.setSellStatus("예약 중");
        item.setResDateTime(LocalDateTime.now());
        itemRepository.save(item);

        // 승인된 요청(requestCno) 외 나머지 구매 요청 자동 삭제
        purchaseReqRepository.deleteByCnoAndItemNoAndRequestCnoNot(cno, itemNo, requestCno);

        return ResponseEntity.ok(item);
    }

    // 거래 완료 → 상품 sellStatus = '거래 완료', finalPrice 기록
    // body: { finalPrice }
    @PatchMapping("/{requestCno}/{cno}/{itemNo}/complete")
    public ResponseEntity<?> completeTransaction(
            @PathVariable("requestCno") String requestCno,
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo,
            @RequestBody Map<String, Long> body) {
        if (!purchaseReqRepository.existsById(new PurchaseReqId(requestCno, cno, itemNo))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("구매 요청을 찾을 수 없습니다.");
        }
        Optional<Item> itemOpt = itemRepository.findById(new ItemId(cno, itemNo));
        if (itemOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }
        Item item = itemOpt.get();
        item.setSellStatus("거래 완료");
        item.setFinalPrice(body.get("finalPrice"));
        item.setResDateTime(LocalDateTime.now());
        return ResponseEntity.ok(itemRepository.save(item));
    }

    // 거래 완료된 판매 내역 (판매자용) - item + 구매자 cno 포함
    @GetMapping("/sales/{cno}")
    public ResponseEntity<List<CompletedSaleDto>> getCompletedSales(@PathVariable("cno") String cno) {
        List<Item> completedItems = itemRepository.findByCnoAndSellStatus(cno, "거래 완료");
        List<CompletedSaleDto> result = completedItems.stream().map(item -> {
            List<PurchaseReq> reqs = purchaseReqRepository.findByCnoAndItemNo(cno, item.getItemNo());
            String buyerCno = reqs.isEmpty() ? null : reqs.get(0).getRequestCno();
            return new CompletedSaleDto(
                    item.getCno(), item.getItemNo(), item.getTitle(), item.getCategory(),
                    item.getPrice(), item.getFinalPrice(), item.getResDateTime(), buyerCno
            );
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // 내가 구매한 내역 (구매자용) - 거래 완료된 것만
    @GetMapping("/history/{requestCno}")
    public ResponseEntity<List<PurchasedItemDto>> getPurchaseHistory(@PathVariable("requestCno") String requestCno) {
        List<PurchaseReq> reqs = purchaseReqRepository.findByRequestCno(requestCno);
        List<PurchasedItemDto> result = reqs.stream()
                .map(req -> itemRepository.findById(new ItemId(req.getCno(), req.getItemNo()))
                        .filter(item -> "거래 완료".equals(item.getSellStatus()))
                        .map(item -> new PurchasedItemDto(
                                item.getCno(), item.getItemNo(), item.getTitle(), item.getCategory(),
                                item.getPrice(), item.getFinalPrice(), item.getSellStatus(),
                                item.getResDateTime(), req.getReqDateTime(), req.getReqPrice()
                        ))
                        .orElse(null))
                .filter(d -> d != null)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // 구매 요청 거절 또는 취소
    @DeleteMapping("/{requestCno}/{cno}/{itemNo}")
    public ResponseEntity<?> deleteRequest(
            @PathVariable("requestCno") String requestCno,
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo) {
        PurchaseReqId id = new PurchaseReqId(requestCno, cno, itemNo);
        if (!purchaseReqRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("구매 요청을 찾을 수 없습니다.");
        }
        purchaseReqRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
