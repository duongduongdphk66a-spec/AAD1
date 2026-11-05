# AetherTerra 3D — 10-Billion Virtual Sample Clipmap & Non-Destructive World Engine (v3)

Kiến trúc thế giới mở 3D tỷ lệ thực **1:1** diện tích **10×10 km** (`10.000 × 10.000 m`), độ cao trần **1.000 m**, hỗ trợ điêu khắc địa hình đa phân giải xuống tới **10 cm/mẫu** (`10.000.200.001` mẫu ảo địa chỉ hóa được ở mức `L0`) với bộ nhớ thường trú dưới **80 MB RAM**.

---

## 1. Kiến trúc Cốt lõi (`src/core/`)

Hệ thống địa hình v3 tách biệt trường cao độ nền, tháp ô thưa, nhiễu thủ tục giới hạn dải tần Nyquist và tem nền vật thể SDF thành một hàm hợp thành duy nhất cho cả CPU và GPU:

$$H(x, z, L_{\min}) = H_{\text{stamp}}\!\left(x, z,\; H_{\text{base}}(x, z) + \sum_{L = L_{\min}}^{9} E_L(x, z) + D(x, z, L_{\min})\right)$$

- **`units.ts`**: Hệ tọa độ chuẩn hóa, hằng số `WORLD_SIZE = 10_000`, `TILE = 256`, `LEVELS = 10` (`L0 = 0.1 m` đến `L9 = 51.2 m`), đóng gói khóa ô 25-bit không dấu (`level` 5 bit, `tx` 10 bit, `tz` 10 bit — `tileKey` / `unpackTileKey`) kèm kiểm tra biên nghiêm ngặt.
- **`tileStore.ts`**: Tháp ô thưa `SparseTileStore` lượng tử hóa `Int16Array` động (`128 KB/ô`), cơ chế LRU chỉ loại bỏ ô đã lưu (`!dirty`), tự động lưu nền (autosave debounce 2 giây) và nạp lại đồng bộ từ `TilePersistence` mà không làm mất dữ liệu khi vượt 512 ô.
- **`detailGenerator.ts`**: Nhiễu fBm 3-octave xác định theo hạt giống (`seed`), lọc thông thấp theo tần số Nyquist ở từng mức LOD để chống răng cưa.
- **`stampSystem.ts`**: Tem nền vật thể SDF không phá hủy (`obb`, `ellipse`, `polygon`, `splineCorridor`) kết hợp bằng toán tử hợp mượt giao hoán (`smoothUnionSdf`), đảm bảo bất biến thứ tự và lũy đẳng tuyệt đối (`0.000 m` sai lệch sau 20 lần áp dụng).
- **`terrainField.ts`**: Trường địa hình hợp nhất `UnifiedTerrainField`, nội suy song tuyến tính xuyên biên ô (`tileStore.read` trên chỉ số toàn cục `ix, iz`), loại bỏ hoàn toàn vết nứt ở ranh giới ô (`Gate G2 <= 1 cm`), hỗ trợ `fillSubWindow` và `raycast` chia đôi.
- **`brushEngine.ts`**: Cọ đa phân giải tự chọn mức $L^* = \text{clamp}(\lfloor\log_2(r / 1.6)\rfloor, 0, 9)$, lưu hoàn tác/làm lại theo vi sai từng ô (`Undo/Redo` chính xác từng byte).
- **`clipmapRenderer.ts` & `clipmapWorker.ts`**: Geometry Clipmap 10 vòng đồng tâm dịch chuyển theo dải cuốn (`shiftRingBufferInPlace` + `fillSubWindow`), chỉ tính toán hàng/cột mới lộ ra khi camera di chuyển và đẩy tác vụ tạo cửa sổ sang luồng `Worker` (`ComposeWorkerPool`) kết hợp `Scheduler` ngân sách khung hình `<= 2.2 ms`.
- **`linkSystem.ts`**: Hệ thống khớp nối tự động (`Socket Snap`) và đường nối Spline gộp thành 1–2 `BufferGeometry` duy nhất; chỉ tải động `three-bvh-csg` khi người dùng bấm **"Chốt CSG"**.
- **`persistenceV3.ts`**: Định dạng lưu trữ nhị phân nén `.atw` (`ATW3` magic header) với bộ giải nén luồng có trần chống Gzip Bomb (`decompressGzipBounded`: `META <= 32 MB`, `BASE == 207.368 B`, `TILE == 131.092 B`) và kiểm tra tính hợp lệ toàn diện cho mọi trường dữ liệu.

---

## 2. Lệnh Chạy & Kiểm Thử

```bash
# Cài đặt phụ thuộc
npm install

# Chạy máy chủ phát triển (Express + Vite trên cổng 3000)
npm run dev

# Kiểm tra kiểu TypeScript (tsc --noEmit)
npm run lint

# Chạy toàn bộ bộ kiểm thử đơn vị (Node test runner)
npm test

# Chạy benchmark hiệu năng v3 (Link 800 vật thể, Clipmap, Cọ 1m/10m/100m)
npx tsx bench/terrainV3Bench.ts

# Đóng gói bản phân phối Production (Client + Server + nén Gzip/Brotli tĩnh)
npm run build

# Chạy máy chủ Production trên cổng 3000
npm start
```

---

## 3. Biến Môi Trường, AI Vision & Triển Khai Production

Sao chép `.env.example` sang `.env` (hoặc cấu hình biến môi trường trên hạ tầng Cloud Run / Docker / Kubernetes):

| Biến môi trường | Mặc định | Mô tả |
|---|---|---|
| `GEMINI_API_KEY` | *(rỗng)* | Khóa API Gemini cho tính năng phân tích địa hình từ ảnh (`POST /api/reconstruct`). Khi để trống hoặc khi `analysis` là `null`, API trả về `source: 'pixel-engine'` để trình duyệt dùng bộ giải tích Pixel Depth & Mahalanobis cục bộ. Khi dịch vụ Gemini gặp lỗi thượng nguồn hoặc quá thời gian chờ, API trả về mã HTTP `502`/`503` và hoàn lại hạn ngạch. |
| `GEMINI_MODEL` | `gemini-3-flash-preview` | Tên model Gemini sử dụng cho phân tích thị giác. |
| `VITE_TERRAIN_V3` | `true` | Bật kiến trúc địa hình v3 (10-level Geometry Clipmap + Sparse Tile Pyramid RLE + SDF Stamp & Link). |
| `AI_MAX_CALLS_PER_HOUR` | `200` | Trần số lượt gọi Gemini toàn cục mỗi giờ (các lượt gọi lỗi tự động được hoàn lại hạn ngạch). |
| `AI_MAX_CALLS_PER_IP_HOUR` | `40` | Trần số lượt gọi Gemini tối đa cho mỗi IP trong 1 giờ để chống một IP chiếm trọn hạn ngạch chung. |
| `GEMINI_DAILY_BUDGET` | `500` | Trần ngân sách số lượt gọi Gemini toàn cục mỗi ngày (24h). |
| `TRUST_PROXY_HOPS` | `0` | Số tầng reverse proxy tin cậy để đọc `X-Forwarded-For`. Không gán cứng trong `Dockerfile`; đặt `TRUST_PROXY_HOPS=1` qua biến môi trường khi chạy sau 1 tầng Cloud Run / Nginx / Cloudflare. |
| `CSP_FRAME_ANCESTORS` | `'self' https://aistudio.google.com ...` | Danh sách nguồn được phép nhúng ứng dụng qua `iframe` trong header `Content-Security-Policy`. Đặt `CSP_FRAME_ANCESTORS="'self'"` khi tự host độc lập. |
| `API_AUTH_TOKEN` | *(rỗng)* | Khóa xác thực Bearer / `X-API-Key` tùy chọn cho `/api/reconstruct` (so sánh hằng thời gian qua `crypto.timingSafeEqual`). |
| `REQUIRE_API_TOKEN` | `false` | Đặt `true` để bắt buộc mọi yêu cầu tới `/api/reconstruct` phải gửi `API_AUTH_TOKEN` hợp lệ. |

### Đóng gói & chạy bằng Docker

```bash
docker build --build-arg VITE_TERRAIN_V3=true -t aetherterra:latest .
docker run -d -p 3000:3000 \
  -e GEMINI_API_KEY="your_key" \
  -e TRUST_PROXY_HOPS=1 \
  -e CSP_FRAME_ANCESTORS="'self'" \
  aetherterra:latest
```

