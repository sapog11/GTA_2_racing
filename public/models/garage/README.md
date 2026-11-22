# Garáž — vozy hráče

Každé auto má svou složku `models/garage/<id>/` s `car.json`:

- `p1`, `p2` — barva laku (hlavní, doplňková), `fin` — gloss | metal | matte | chrome
- `rim` — barva disků, `glow` — neon pod autem (`off` = vypnuto), `w` — šířka karoserie (1 = Koncept Z)
- `kit` — díly karoserie: `wing`, `duck`, `lip`, `splitter`, `skirts`, `scoop`, `flaps`, `rally`
- `rims` — styl disků: stock | five | mesh | deep | turbine, `cal` — barva brzdových třmenů
- `hl` — přední světla: stock | led | angel, `tl` — zadní světla: stock | bar
- `plate` — SPZ (česká, kraj U = Ústí)

Hra načte `car.json` při startu a přepíše výchozí hodnoty v `r3.js` (`R3.ZB`).
Všechna auta zatím stojí na detailní platformě Koncept Z (karoserie, interiér, kola, světla).
Až budou vlastní modely dílů, dají se sem přidat jako `body.glb`, `wheel.glb`, `kit_wing.glb` apod.

## Díly karoserie (mapa uzlů modelu Koncept Z)

Každý díl je samostatný objekt v `models/koncept/CarConcept.gltf`, takže se dá barvit, měnit nebo nahradit zvlášť:

| Díl | Uzly v modelu | Tuning |
|---|---|---|
| Střecha | `BodyRoofPanel` | `roof` |
| Kapota | `BodyHood`, `BodyHoodTopgrill`, `BodyHoodInterior01/02` | `hood` |
| Dveře L/P — horní část | `BodyDoorLColor1`, `BodyDoorRColor1` | `p1` (lak) |
| Dveře L/P — spodní část | `BodyDoorLColor2`, `BodyDoorRColor2` | `p2` |
| Dveře — sklo | `BodyDoorLWindow`, `BodyDoorRWindow` | `tint` |
| Dveře — těsnění okna (lišta) | `BodyDoorLWindowGasket`, `BodyDoorRWindowGasket` | `trim` |
| Dveře — kliky | `BodyDoorLHandle01/02`, `BodyDoorRHandle01/02` | `trim` |
| Zrcátka | `BodyDoorLMirror`, `BodyDoorLMirrorColor1/2` (+ R) | `mir` |
| Dveře — vnitřní panely | `InteriorDoorL01..06`, `InteriorDoorR01..06` | — |
| Přední sklo + stěrače | `BodyWindshield`, `BodyWindshieldGasket`, `BodyWindshieldWipers` | — |
| Zadní okno / boční okna | `BodyRearwindow`, `BodyWindowsRearSides` | `tint` |
| Světla | `BodyHeadlights`, `BodyTaillights`, `BodyTaillightsPanels`, `BodyTurnsignalsRear` | `hl`, `tl` |
| Kola | `WheelFrontL/R`, `WheelRearL/R` → `…Rim`, `…BrakeDisc`, `…BrakePad`, pneumatika | `rims`, `rim`, `cal` |
| Interiér | `InteriorSeats*`, `InteriorDash*`, `InteriorSteering*` | `seat`, `sw`, `amb`, `dice` |

Až budou vlastní modely dílů, stačí je pojmenovat stejně a hra je použije místo původních.
