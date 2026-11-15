# Yad2 Car Hunter MCP

Custom MCP server for live used-car searches on Yad2, backed by ReefAPI.

## Tools

- `search_yad2_cars` — live filtered search.
- `get_yad2_listing` — full details for one ad.
- `find_best_yad2_deals` — scans multiple pages, deduplicates and produces a first-pass shortlist.

The ranking is intentionally only a shortlist heuristic. Final reliability judgment should be done by the assistant using the exact year, engine, gearbox, mileage, ownership and listing description.

## Setup

1. Create a free ReefAPI account and API key.
2. Clone this repository.
3. Install dependencies: `npm install`
4. Copy `.env.example` to `.env` and set `REEF_API_KEY`.
5. Export the environment variable in the process that launches the MCP server.
6. Build with `npm run build`.
7. Run with `npm start`.

Example MCP client configuration:

```json
{
  "mcpServers": {
    "yad2-car-hunter": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/Yad-2-car-search-2/dist/index.js"],
      "env": {
        "REEF_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

## Aviv search preset (broad reliability-first search)

- Target purchase price: up to ₪12,000; discover promising ads up to ₪14,000.
- Model years: 2005–2015. Mileage: up to 240,000 km; hand: up to 7.
- Body styles: ALL, including sedans, hatchbacks, and wagons (e.g. Mazda 2/3/6 and Honda Civic).
- Automatic preferred. Include reliable conventional torque-converter automatic variants even in older European cars.
- Focus: reliable Mazda, Honda, Toyota, Suzuki, Hyundai, Kia, Daihatsu, Nissan, Mitsubishi, Subaru, and appropriate Ford/Skoda variants; other reliable models can appear too.
- Hard reject: Peugeot/Citroën/Renault/Dacia; explicit dry DSG7/DQ200, PowerShift, EDC, i-Shift, M-MT, Dualogic, robotized single-clutch, PureTech and wet timing belts; manually driven cars.
- If the listing does not document the EXACT gearbox or engine, keep it for manual verification and **do not mark it as confirmed safe**.
- Regional priority: Center/Sharon/Hadera; broad discovery first rather than missing good ads.
- Ranking is ONLY preliminary. Confirm the exact engine, gearbox, timing system, service history, accident condition, and liens before purchase.
- Use `search-request.json` to change scan limits. A push of that file triggers the GitHub Action search.

## Data source

ReefAPI provides a read-only Yad2 API. This project does not store a Yad2 password or require logging into a Yad2 account.
