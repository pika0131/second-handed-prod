# 동네장터 — 중고거래 프론트엔드 (React + Vite)

`dbproject`(Spring Boot + Oracle) 백엔드와 연동되는 중고거래 웹 프론트엔드입니다.
와이어프레임(구매자 / 판매자 / 관리자 관점)을 바탕으로 만들었습니다.

## 기술 스택
- React 18 + TypeScript
- Vite 6 (`localhost:5173`)
- Tailwind CSS v4
- react-router-dom v6
- lucide-react (아이콘)
- 폰트: Pretendard (CDN)

## 실행 방법

```bash
# 1) 프론트엔드
cd frontend
npm install
npm run dev        # http://localhost:5173

# 2) 백엔드 (별도 터미널)
cd dbproject
./gradlew bootRun  # http://localhost:8080
```

> Vite가 `/api/*` 요청을 자동으로 `http://localhost:8080` 으로 프록시합니다
> (`vite.config.ts`의 `server.proxy`). 따라서 CORS 문제 없이 바로 동작합니다.

## 화면 구성

| 경로 | 화면 | 사용 API |
|------|------|----------|
| `/` | 상품 목록(구매자) · 검색/카테고리/상태 필터 | `GET /api/items` |
| `/items/:cno/:itemNo` | 상품 상세 | `GET /api/items/{cno}/{itemNo}` |
| `/login` | 로그인 | `POST /api/customers/login` |
| `/signup` | 회원가입 | `POST /api/customers` |
| `/sell` | 상품 등록(판매자) | `POST /api/items` |
| `/my-items` | 내 판매 상품 관리 · 상태변경/수정/삭제 | `GET /api/items/seller/{cno}` 등 |
| `/my-items/:itemNo/edit` | 상품 수정 | `PUT /api/items/{cno}/{itemNo}` |
| `/sales` | 판매 내역 · 통계 | `GET /api/items/seller/{cno}` |
| `/admin` | 관리자 대시보드 | `GET /api/items`, `GET /api/customers` |
| `/admin/users` | 회원 관리 | `GET /api/customers` |
| `/admin/items` | 상품 관리 · 삭제 | `GET /api/items`, `DELETE …` |

- 관리자 메뉴는 **회원번호(cno)가 `admin`으로 시작**하는 계정으로 로그인하면 보입니다.
  (백엔드 Customer 테이블에 권한 컬럼이 없어 학습용으로 단순화한 규칙입니다.)

## ⚠ 백엔드에 추가해야 하는 API

현재 `dbproject` 백엔드에는 `GET /api/items`, `GET /api/customers`,
`POST /api/customers/login` 3개만 있습니다. 등록·수정·삭제·상세·회원가입 화면이
실제로 동작하려면 **`backend_additions/` 폴더의 코드로 기존 파일을 교체**해야 합니다.
자세한 내용은 `backend_additions/README.md`를 참고하세요.

추가 API가 없어도 **상품 목록 / 상품 상세 / 로그인 / 관리자 조회**는 그대로 작동합니다.
(상세는 단건 API가 없으면 전체 목록에서 찾아오는 fallback이 들어 있습니다.)
