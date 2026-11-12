# Entity Relationship Diagram

The rendered diagram is in [`erd.svg`](erd.svg). The same model as a Mermaid diagram (renders on GitHub):

```mermaid
erDiagram
    PROVINCES ||--o{ SUPPLIERS : "located in"
    SUPPLIERS ||--o{ PURCHASES : "supplies"
    SUPPLIERS ||--o{ SUPPLIER_FRUITS : "offers"
    FRUITS ||--o{ SUPPLIER_FRUITS : "supplied as"
    FRUITS ||--o{ PRODUCTS : "has"
    BOX_SIZES ||--o{ PRODUCTS : "has"
    PRODUCTS ||--o{ PURCHASES : "received as"
    PRODUCTS ||--o{ ORDER_ITEMS : "sold as"
    STREET_VENDORS ||--o{ ORDERS : "places"
    ORDERS ||--|{ ORDER_ITEMS : "contains"
    USERS ||--o{ ORDERS : "created_by"
    USERS ||--o{ PURCHASES : "created_by"

    PROVINCES {
        int id PK
        string name
        char code
    }
    SUPPLIERS {
        int id PK
        string supplier_name
        int province_id FK
        string contact_person
        string telephone
        string email
        string physical_address
    }
    FRUITS {
        int id PK
        string name
        string description
        bool is_active
    }
    BOX_SIZES {
        int id PK
        enum name "Small|Medium|Large"
        decimal weight_kg
    }
    PRODUCTS {
        int id PK
        int fruit_id FK
        int box_size_id FK
        string sku
        decimal selling_price
        int stock_quantity
        int reorder_threshold
    }
    PURCHASES {
        int id PK
        int supplier_id FK
        int product_id FK
        int quantity
        decimal cost_per_box
        string batch_no
        date purchase_date
    }
    STREET_VENDORS {
        int id PK
        string vendor_name
        string business_name
        string telephone
        string location_area
        decimal latitude
        decimal longitude
        date registration_date
        enum status
    }
    ORDERS {
        int id PK
        int vendor_id FK
        date order_date
        enum status
        decimal total_amount
    }
    ORDER_ITEMS {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
        decimal unit_price
        decimal subtotal
    }
    USERS {
        int id PK
        string full_name
        string email
        string password_hash
        enum role
    }
```

## Key design decisions

- **Fruit + Box Size = Product.** `products` has `UNIQUE(fruit_id, box_size_id)`, so Apples (Small), Apples (Medium) and Apples (Large) are three rows, each with its own `selling_price` and `stock_quantity`.
- **Supplier to Stock.** `purchases` links a supplier to a product. Recording a purchase increments `products.stock_quantity` in the same transaction.
- **Price snapshot.** `order_items.unit_price` copies the product price at order time, so later price changes do not rewrite history.
- **Integrity.** CHECK constraints (price > 0, quantity > 0, stock >= 0), UNIQUE keys, and foreign keys on every relationship.
