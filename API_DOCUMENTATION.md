# API仕様書

## ベースURL
```
http://localhost:5000
```

## エンドポイント一覧

### 1. 全物件取得
**GET** `/api/properties/all`

全てのアクティブな物件を取得

**クエリパラメータ:**
- `category` (optional): カテゴリーでフィルター (jukyo, tochi, etc.)
- `category_type` (optional): タイプでフィルター (賃貸, 売買)
- `limit` (optional): 取得件数制限

**レスポンス例:**
```json
{
  "success": true,
  "count": 150,
  "data": [
    {
      "id": "...",
      "url": "https://www.e-uchina.net/bukken/jukyo/...",
      "category": "jukyo",
      "category_type": "賃貸",
      "title": "賃貸アパート恵マンション 301号",
      "price": "6.3万円",
      "favorites": 0,
      "images": ["url1", "url2"],
      "property_data": {...},
      "is_active": true,
      "first_seen_date": "2025-11-22",
      "last_seen_date": "2025-11-22"
    }
  ]
}
```

---

### 2. 新規物件取得
**GET** `/api/properties/new`

本日（または指定日）に追加された新規物件を取得

**クエリパラメータ:**
- `date` (optional): 日付 (YYYY-MM-DD format, デフォルト: 今日)
- `category` (optional): カテゴリーでフィルター

**レスポンス例:**
```json
{
  "success": true,
  "date": "2025-11-22",
  "count": 15,
  "data": [...]
}
```

---

### 3. 成約済み物件取得
**GET** `/api/properties/sold`

最近成約/削除された物件を取得

**クエリパラメータ:**
- `days` (optional): 何日前まで遡るか (デフォルト: 7)
- `category` (optional): カテゴリーでフィルター

**レスポンス例:**
```json
{
  "success": true,
  "days_back": 7,
  "count": 8,
  "data": [...]
}
```

---

### 4. 日次差分取得
**GET** `/api/properties/diff`

本日（または指定日）の新規物件と成約物件の差分をカテゴリー別に取得

**クエリパラメータ:**
- `date` (optional): 日付 (YYYY-MM-DD format, デフォルト: 今日)

**レスポンス例:**
```json
{
  "success": true,
  "date": "2025-11-22",
  "total_new": 25,
  "total_sold": 8,
  "by_category": {
    "jukyo": {
      "new_count": 10,
      "sold_count": 3,
      "new_properties": [...],
      "sold_properties": [...]
    },
    "tochi": {
      "new_count": 15,
      "sold_count": 5,
      "new_properties": [...],
      "sold_properties": [...]
    }
  }
}
```

---

### 5. 統計情報取得
**GET** `/api/stats`

全体の統計情報を取得

**レスポンス例:**
```json
{
  "success": true,
  "total_active": 20369,
  "new_today": 25,
  "by_category": {
    "jukyo": 8500,
    "tochi": 3200,
    "mansion": 2100,
    ...
  },
  "by_type": {
    "賃貸": 12000,
    "売買": 8369
  },
  "database_type": "sqlite"
}
```

---

## エラーレスポンス

全てのエンドポイントでエラーが発生した場合：

```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

HTTPステータスコード: 500

---

## 使用例

### cURL

```bash
# 全物件取得
curl http://localhost:5000/api/properties/all

# 賃貸物件のみ取得
curl "http://localhost:5000/api/properties/all?category_type=賃貸"

# 新規物件取得
curl http://localhost:5000/api/properties/new

# 昨日の新規物件取得
curl "http://localhost:5000/api/properties/new?date=2025-11-21"

# 差分取得
curl http://localhost:5000/api/properties/diff

# 統計情報取得
curl http://localhost:5000/api/stats
```

### JavaScript (Fetch API)

```javascript
// 全物件取得
const response = await fetch('http://localhost:5000/api/properties/all');
const data = await response.json();
console.log(data);

// 新規物件取得
const newProps = await fetch('http://localhost:5000/api/properties/new');
const newData = await newProps.json();
console.log(`新規物件: ${newData.count}件`);

// 差分取得
const diff = await fetch('http://localhost:5000/api/properties/diff');
const diffData = await diff.json();
console.log(`新規: ${diffData.total_new}, 成約: ${diffData.total_sold}`);
```

---

## サーバー起動方法

```bash
python3 server.py
```

デフォルトポート: 5000
デフォルトホスト: 0.0.0.0

環境変数で変更可能:
```bash
export API_PORT=8000
export API_HOST=127.0.0.1
python3 server.py
```
