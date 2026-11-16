# 🌱 Smart Farm

A working Flask web application that connects a soil-monitoring robot (ESP32) with a 16×16 farm map (256 zones), NASA POWER climate data, crop recommendations, AI plant-disease screening and profitability tracking.

## Features
- **Dashboard** – 16×16 zone map (zigzag route) coloured by soil moisture, TDS or best crop; click a zone for history and crop suitability.
- **Farm & Climate** – pick the farm location on a map; temperature, humidity, rain and solar radiation from NASA POWER (latest available day, not a live forecast).
- **Robot** – ESP32 sends moisture, TDS and zone ID by HTTP POST every hour to the website's public URL (API key protected). Connection status comes from the time of the last received reading. Includes a speed × time schedule (6 km/h, 6 km zones = 1 h per zone) used to cross-check the zone the robot reports.
- **Manual entry** – add readings by hand when the robot is unavailable.
- **Disease AI** – upload a photo of *any* plant. A vision AI (Claude, needs `ANTHROPIC_API_KEY`) names the plant, lists visible symptoms, the likely disease with alternatives and confidence, treatment (chemical and biological), prevention and fertilizer guidance. The Hugging Face classifier [`rodynaemad/plant-disease-dinov2-small`](https://huggingface.co/rodynaemad/plant-disease-dinov2-small) runs as a second opinion for the crops it was trained on. Either one works alone.
- **Profit** – costs, production, price, net profit (measured and estimated kept separate).

## Run locally
```bash
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt            # light install (vision AI works with ANTHROPIC_API_KEY)
# optional local classifier (heavy): pip install -r requirements-classifier.txt
python app.py                                        # http://localhost:5000
```
If you installed the optional classifier, the first analysis downloads the model from Hugging Face (internet required, may take a minute).

## Environment variables
| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables the any-plant vision AI (paid API usage per photo) |
| `ANTHROPIC_MODEL` | Optional, default `claude-sonnet-5-5` |
| `SECRET_KEY` | Flask secret |
| `SMARTFARM_DB` | Path of the SQLite file |

## Deploy (so the robot can reach it)
The robot posts to the site's public domain, so host it online (Render, Railway, PythonAnywhere, a VPS...). Start command: `gunicorn app:app --workers 1 --threads 4 --timeout 180` (see `Procfile`). Set the environment variable `SECRET_KEY`. SQLite needs a persistent disk; set `SMARTFARM_DB` to a path on it.

## Connect the robot
1. Open the **Robot** page and copy the endpoint and API key.
2. Edit `static/esp32/smartfarm_robot.ino` (Wi-Fi, endpoint, key, sensor calibration) and implement `getCurrentZone()` with your positioning method.
3. On the **Farm** page set speed, zone length and (optionally) the mission start time.

### How readings are linked to zones
The robot sends its zone (`zone_id` 1–256, or `row`+`col`). The speed × time schedule only cross-checks it: a mismatch is flagged "off schedule". If the robot sends no position, the zone is estimated from the schedule and marked `estimated`.
Zone numbering: zone 1 = row 1, col 1; odd rows run left → right, even rows right → left.

## Notes & limitations
- TDS is measured on a soil-water extract and is only an indirect salinity indicator.
- Crop ranges in `data/crops.json` and disease advice in `data/diseases.json` are general guidance; edit them for your region. Always confirm diagnoses and pesticide/fertilizer rates with an agronomist.
- The disease model supports only its trained crops/diseases and can be less reliable on field photos.
- There is no user login yet; add authentication before exposing the dashboard publicly.

---
**Developed by Fares Hazem**
