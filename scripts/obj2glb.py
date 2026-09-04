"""OBJ (+MTL con map_Kd) -> GLB binario. Escrito a medida porque obj2gltf
se colgaba con este archivo de 33 MB."""
import json, struct, os, sys, base64

obj_path, tex_dir, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

# 4o argumento opcional: filtro de materiales. "a,b" conserva solo esos;
# "!a,b" los excluye. Sirve para partir un modelo en piezas que despues se
# animan por separado (p.ej. el tubo del canon, que se eleva con el angulo,
# separado de la cureña, que no se mueve).
mat_filter = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None
exclude = bool(mat_filter and mat_filter.startswith('!'))
wanted = set((mat_filter[1:] if exclude else mat_filter).split(',')) if mat_filter else None

def keep(mat):
    if wanted is None: return True
    return (mat not in wanted) if exclude else (mat in wanted)

# 5o argumento opcional: corte geometrico, "y>0" o "y<=0". Filtra por la
# altura del centro de cada cara. Hace falta cuando el modelo original le
# puso el mismo material a dos piezas que uno necesita separadas — en el
# canon naval, el tubo y el bloque de la cureña comparten material y no
# hay forma de partirlos si no es por posicion.
cut = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] else None
cut_above = cut.startswith('y>') if cut else False
cut_value = float(cut.lstrip('y><=')) if cut else 0.0

# 6o argumento opcional: "renorm" recalcula las normales a partir del giro de
# cada cara en vez de usar las 'vn' del archivo. Hace falta cuando el modelo
# trae normales invertidas — se nota porque las caras salen negras con
# cualquier material iluminado, pero bien con uno que ignore la luz.
renorm = len(sys.argv) > 6 and sys.argv[6] == 'renorm'

def keep_face(idxs):
    if cut is None: return True
    cy = sum(positions[(i) * 3 + 1] for i in idxs) / len(idxs)
    return cy > cut_value if cut_above else cy <= cut_value

positions, uvs, normals = [], [], []
groups = {}          # material -> lista de indices en el vertex buffer final
vmap = {}            # (vi,ti,ni) -> indice final
out_p, out_t, out_n = [], [], []
current = "default"

def vidx(tok):
    parts = (tok.split('/') + ['', ''])[:3]
    vi = int(parts[0]); ti = int(parts[1]) if parts[1] else 0; ni = int(parts[2]) if parts[2] else 0
    key = (vi, ti, ni)
    got = vmap.get(key)
    if got is not None:
        return got
    idx = len(out_p) // 3
    p = positions[(vi - 1) * 3:(vi - 1) * 3 + 3]
    out_p.extend(p)
    out_t.extend(uvs[(ti - 1) * 2:(ti - 1) * 2 + 2] if ti else [0.0, 0.0])
    out_n.extend(normals[(ni - 1) * 3:(ni - 1) * 3 + 3] if ni else [0.0, 1.0, 0.0])
    vmap[key] = idx
    return idx

with open(obj_path, 'r', errors='ignore') as fh:
    for line in fh:
        if line.startswith('v '):
            positions.extend(map(float, line.split()[1:4]))
        elif line.startswith('vt '):
            c = list(map(float, line.split()[1:3])); uvs.extend([c[0], c[1]])
        elif line.startswith('vn '):
            normals.extend(map(float, line.split()[1:4]))
        elif line.startswith('usemtl '):
            current = line.split(None, 1)[1].strip()
        elif line.startswith('f '):
            if not keep(current): continue
            toks = line.split()[1:]
            if cut is not None:
                raw = [int(t.split('/')[0]) - 1 for t in toks]
                if not keep_face(raw): continue
            ids = [vidx(t) for t in toks]
            g = groups.setdefault(current, [])
            for k in range(1, len(ids) - 1):       # triangular el poligono
                g.extend([ids[0], ids[k], ids[k + 1]])

if renorm:
    import math
    out_n = [0.0] * len(out_p)
    for g in groups.values():
        for k in range(0, len(g), 3):
            a, b, c = g[k], g[k+1], g[k+2]
            pa = out_p[a*3:a*3+3]; pb = out_p[b*3:b*3+3]; pc = out_p[c*3:c*3+3]
            u = [pb[i]-pa[i] for i in range(3)]; w = [pc[i]-pa[i] for i in range(3)]
            n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]]
            for vi in (a, b, c):
                for i in range(3): out_n[vi*3+i] += n[i]   # promedio ponderado por area
    for vi in range(len(out_n)//3):
        n = out_n[vi*3:vi*3+3]
        L = math.sqrt(sum(c*c for c in n)) or 1.0
        for i in range(3): out_n[vi*3+i] = n[i]/L
    print('normales recalculadas desde el giro de las caras')

nv = len(out_p) // 3
xs = out_p[0::3]; ys = out_p[1::3]; zs = out_p[2::3]
bbox = ([min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)])
print(f'vertices unicos: {nv}   materiales: {len(groups)}')
print(f'bbox min {[round(v,2) for v in bbox[0]]}  max {[round(v,2) for v in bbox[1]]}')

blob = bytearray(); views = []
def add_view(data, target):
    while len(blob) % 4: blob.append(0)
    off = len(blob); blob.extend(data)
    views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data), "target": target})
    return len(views) - 1

accessors = []
pv = add_view(struct.pack(f'<{nv*3}f', *out_p), 34962)
accessors.append({"bufferView": pv, "componentType": 5126, "count": nv, "type": "VEC3", "min": bbox[0], "max": bbox[1]})
nvw = add_view(struct.pack(f'<{nv*3}f', *out_n), 34962)
accessors.append({"bufferView": nvw, "componentType": 5126, "count": nv, "type": "VEC3"})
tv = add_view(struct.pack(f'<{nv*2}f', *out_t), 34962)
accessors.append({"bufferView": tv, "componentType": 5126, "count": nv, "type": "VEC2"})

images, textures, materials, prims = [], [], [], []
for mat, idxs in groups.items():
    iv = add_view(struct.pack(f'<{len(idxs)}I', *idxs), 34963)
    ai = len(accessors)
    accessors.append({"bufferView": iv, "componentType": 5125, "count": len(idxs), "type": "SCALAR"})

    jpg = os.path.join(tex_dir, mat if mat.endswith('.jpg') else mat + '.jpg')
    mi = None
    if os.path.exists(jpg):
        img_view = add_view(open(jpg, 'rb').read(), None)
        images.append({"bufferView": img_view, "mimeType": "image/jpeg"})
        textures.append({"source": len(images) - 1})
        mi = len(textures) - 1
    materials.append({
        "name": mat,
        "pbrMetallicRoughness": ({"baseColorTexture": {"index": mi}} if mi is not None
                                 else {"baseColorFactor": [0.35, 0.45, 0.25, 1]}) | {"metallicFactor": 0, "roughnessFactor": 0.9},
        "doubleSided": True,
    })
    prims.append({"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": ai, "material": len(materials) - 1})
    print(f'  {mat}: {len(idxs)//3} triangulos')

gltf = {"asset": {"version": "2.0", "generator": "immersilab obj2glb"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "trees"}],
        "meshes": [{"primitives": prims}], "materials": materials,
        "accessors": accessors, "bufferViews": views,
        "buffers": [{"byteLength": len(blob)}]}
if images: gltf["images"] = images; gltf["textures"] = textures

js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
while len(blob) % 4: blob.append(0)
with open(out_path, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(blob)
print(f'\n-> {out_path}  {os.path.getsize(out_path)/1048576:.1f} MB')
