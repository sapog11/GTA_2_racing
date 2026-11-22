# Blender díly

`python3 blender/parts.py` — postaví díly aut v Blenderu (modul `bpy`, `pip install bpy`) a uloží je jako `.glb` do `public/models/parts/`:

- `rim_five`, `rim_multi`, `rim_mesh`, `rim_deep`, `rim_turbine` — disky (poloměr 1, osa X, vnější strana +X)
- `headlight_slim` — štíhlé světlo s LED obočím a dvěma projektory
- `rear_diffuser` — difuzor s žebry, čtyři koncovky výfuku, odrazky

Náhled všech dílů: otevři `public/tools/parts.html` (na webu `/tools/parts.html`).
Nový díl = nová funkce v `parts.py`, export přes `export('jmeno')`, pak ho hra načte v `r3.js` (`this.parts`).
