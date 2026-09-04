# scripts/

## `obj2glb.py` — convertir un .obj (+ .mtl con texturas) a .glb

Existe porque `obj2gltf` se cuelga con archivos grandes (el pack de árboles
de 33 MB nunca terminó). Este hace lo mínimo necesario y termina en segundos.

```bash
python scripts/obj2glb.py entrada.obj carpeta_de_texturas salida.glb
```

Después **siempre** comprimir antes de meterlo en `public/models/`:

```bash
npx @gltf-transform/cli simplify in.glb mid.glb --ratio 0.35 --error 0.005
npx @gltf-transform/cli meshopt mid.glb public/models/salida.glb
```

`--ratio` es cuánta geometría se conserva. 0.35 va bien para props de fondo;
para algo que se mira de cerca, subilo a 0.6–0.8 o salteá el `simplify`.

### Dos decisiones que importan

**Meshopt, no Draco.** El decodificador de meshopt viene empaquetado con
three; el de Draco lo baja drei desde un CDN de Google. Sin internet en la
defensa, un modelo con Draco no carga.

**No se invierte la coordenada V.** Lo normal al pasar de OBJ a glTF es
invertirla (los dos formatos usan origen distinto), y este script lo hacía.
Pero cuando las UV se salen del rango [0,1] — típico en modelos con atlas de
texturas, como el pack de árboles — invertirlas cae en el tile equivocado del
atlas: los árboles salían con el follaje rosa pálido en vez de verde.

Si un modelo nuevo aparece con las texturas volteadas verticalmente, ahí sí
hay que invertir; es un caso por caso, no una regla fija.
