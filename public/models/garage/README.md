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
