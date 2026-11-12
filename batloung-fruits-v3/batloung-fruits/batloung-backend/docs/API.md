# REST API reference

Base URL `http://localhost:5001/api`. All routes except `POST /auth/login` and `GET /health` need `Authorization: Bearer <token>`.

| Resource | Endpoints | Administrator | Sales |
|---|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` | yes | yes |
| Fruits | `GET /fruits`, `GET /fruits/:id`, `POST /fruits`, `PUT /fruits/:id`, `DELETE /fruits/:id` | all | read |
| Products | `GET /products`, `POST /products`, `PUT /products/:id` | all | read |
| Box sizes | `GET /box-sizes`, `PUT /box-sizes/:id` | all | read |
| Suppliers | `GET /suppliers`, `GET /suppliers/:id`, `POST`, `PUT /suppliers/:id`, `DELETE /suppliers/:id` | all | none |
| Stock | `GET /stock`, `GET /stock/purchases`, `POST /stock`, `PUT /stock/:id` | all | none |
| Vendors | `GET /vendors`, `GET /vendors/geocode?q=...`, `GET /vendors/:id`, `POST /vendors`, `PUT /vendors/:id`, `DELETE /vendors/:id` | all | read + register |
| Orders | `GET /orders`, `GET /orders/:id`, `POST /orders`, `PUT /orders/:id`, `DELETE /orders/:id` | all | read, create, update status (not Completed) |
| Reports | `GET /reports/:name` (8 reports) | yes | none |
| Dashboard | `GET /dashboard` | yes | yes |

Search and filter query parameters: fruits `search,status`; suppliers `search,province_id`; vendors `search,status,location`; orders `search,status,fruit_id,box_size_id,vendor_id,date_from,date_to`; stock `fruit_id,box_size_id,province_id,status,search`.

Vendor create/update requests include `latitude` and `longitude` decimal values selected from the map. Vendor responses include these coordinates; they may be `null` for older records until edited.
The map uses OpenStreetMap tiles and the Nominatim geocoder to search Lesotho villages and businesses and reverse-look up a selected point's place/address. Search requests are serialized to respect the geocoder's usage limit; users can always choose a point manually on the map.

Reports: `available-stock`, `sales-by-fruit`, `sales-by-box-size`, `sales-by-vendor`, `purchases-by-province`, `pending-orders`, `completed-orders`, `sales-by-date` (date reports accept `from` and `to`).

## Status codes

`200` OK, `201` Created, `400` validation failed (body has `error` and field `details`), `401` missing or invalid token, `403` role not allowed, `404` not found, `409` conflict (insufficient stock, duplicate, record in use, illegal status change), `429` rate limited, `500` unexpected error.

## Order status rules

Statuses: Pending, Confirmed, Processing, Ready for Collection/Delivery, Completed, Cancelled.
Status only moves forward; Cancelled is allowed from any open state; Completed and Cancelled are final. Completing an order re-checks stock and deducts it in one transaction. Cancelling never touches stock. Sales users can set every status except Completed.
