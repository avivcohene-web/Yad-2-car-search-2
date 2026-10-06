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

## Aviv search preset

For the current car hunt, start with:
- budget: up to ₪12,000
- year: 2007+
- mileage: up to 220,000 km
- automatic preferred
- Center / Sharon area preferred
- hatchback preferred
- prioritize simple, reliable powertrains and low repair risk

Do not automatically reject a car only because it falls outside a preference; condition and service history matter heavily at this budget.

## Data source

ReefAPI provides a read-only Yad2 API. This project does not store a Yad2 password or require logging into a Yad2 account.
