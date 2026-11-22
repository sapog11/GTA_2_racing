# Díly aut — reference z Figmy pro AI 3D (Tripo / Meshy / Krea / Hunyuan / TRELLIS)

Každá složka = jedno auto, každý obrázek = jeden díl na bílém pozadí (ideální vstup pro image-to-3D).

| Auto | Inspirace | Díly |
|---|---|---|
| `drago/` | japonský hatchback ~2001 | headlight, taillight, rim |
| `felda/` | středoevropský hatchback 90. let | headlight, taillight, rim (plech + poklice) |
| `golfik/` | německý hot hatch ~2002 | headlight, taillight, rim (mesh) |
| `bavorak/` | německý sportovní sedan ~2002 | headlight (angel eyes), taillight (L), rim (star) |
| `imprezka/` | japonský rally sedan | headlight (hawk-eye), rim (zlatý 6 paprsků) |
| `supka/` | japonské kupé 90. let | headlight (3 projektory), taillight (kulatý) |
| `koncept/` | futuristický koncept | headlight (LED čepel), rim (turbína) |
| `common/` | univerzální | headlight, taillight, přední/zadní nárazník, zrcátko, disk, křídlo, kapota |
| `raw3d/` | hotové 3D z Tripo | headlight_tripo.glb, taillight_tripo.glb |

## Postup (podle plánu GTA2_Racing_AI_3D_city_plan.pdf)
1. Nahraj obrázek do Tripo / Meshy / Krea (free kredity), použij prompt níže.
2. Stáhni `.glb`, pojmenuj `<auto>_<díl>.glb` (např. `drago_headlight.glb`) a pošli / dej do `design/parts/raw3d/`.
3. Claude to v Blenderu vyčistí (měřítko, pivot, materiály, zmenšení polygonů) a posadí na auto.
4. U každého souboru si ulož, z jaké služby a s jakou licencí je.

Prompt: *Create a clean, game-ready 3D model of ONLY the [PART NAME] for a street racing car. Use the reference image as the source of truth. Preserve silhouette, proportions, mounting points and symmetry. No background, no text, no logos. Separate glass, rubber and metal materials. Will be cleaned in Blender and exported as GLB for a Three.js mobile game.*
