"""Apply per-face mapped source UVs to a GLB without changing its triangles.

Unlike vertex-colour baking, this preserves texture seams by splitting only
vertices that need distinct UV coordinates. Fallback faces remain a separate,
unpainted material. The input printable mesh is never modified.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import struct
from pathlib import Path

import numpy as np


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


parser = argparse.ArgumentParser()
parser.add_argument("--mapped-mesh", type=Path, required=True)
parser.add_argument("--atlas", type=Path, required=True)
parser.add_argument("--target-glb", type=Path, required=True)
parser.add_argument("--output-glb", type=Path, required=True)
parser.add_argument("--report", type=Path)
parser.add_argument("--neutral-engineered-surfaces", action="store_true",
                    help="Colour unmapped mechanical faces stone and high roof seats timber")
args = parser.parse_args()
if args.output_glb.exists() or args.output_glb.resolve() == args.target_glb.resolve():
    raise SystemExit("Use a fresh output path; selected inputs must not be overwritten")

mapping = (np.load(args.mapped_mesh) if args.mapped_mesh.suffix == '.npz'
           else json.loads(args.mapped_mesh.read_text(encoding="utf-8")))
positions = np.asarray(mapping["positions"], dtype="<f4").reshape(-1, 3)
faces = np.asarray(mapping["indices"], dtype="<u4").reshape(-1, 3)
face_uv = np.asarray(mapping["sourceTextureUv"], dtype="<f4").reshape(-1, 3, 2)
fallback = np.asarray(mapping.get("sourceTextureFallbackFaces", [False] * len(faces)), dtype=bool)
if len(face_uv) != len(faces) or len(fallback) != len(faces):
    raise SystemExit("UV and fallback face counts must match the mapped mesh")
if not np.isfinite(positions).all() or not np.isfinite(face_uv).all():
    raise SystemExit("Non-finite geometry or UV coordinates")

glb = args.target_glb.read_bytes()
if glb[:4] != b"glTF" or struct.unpack_from("<I", glb, 4)[0] != 2:
    raise SystemExit("Target must be a binary glTF 2 file")
json_len = struct.unpack_from("<I", glb, 12)[0]
doc = json.loads(glb[20:20 + json_len].decode("utf-8"))
bin_header = 20 + json_len
bin_len, bin_type = struct.unpack_from("<II", glb, bin_header)
if bin_type != 0x004E4942:
    raise SystemExit("Target GLB has no binary chunk")
binary = bytearray(glb[bin_header + 8:bin_header + 8 + bin_len])
primitive = doc["meshes"][0]["primitives"][0]
attributes = primitive["attributes"]


def read_accessor(index: int, dims: int, dtype: str) -> np.ndarray:
    accessor = doc["accessors"][index]
    view = doc["bufferViews"][accessor["bufferView"]]
    width = np.dtype(dtype).itemsize * dims
    stride = view.get("byteStride", width)
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return np.ndarray((accessor["count"], dims), dtype=dtype, buffer=binary,
                      offset=offset, strides=(stride, np.dtype(dtype).itemsize)).copy()


glb_positions = read_accessor(attributes["POSITION"], 3, "<f4")
index_accessor = doc["accessors"][primitive["indices"]]
if index_accessor.get("componentType") != 5125 or index_accessor.get("type") != "SCALAR":
    raise SystemExit("Expected uint32 indexed triangles")
glb_faces = read_accessor(primitive["indices"], 1, "<u4").reshape(-1, 3)
if not np.array_equal(glb_positions, positions) or not np.array_equal(glb_faces, faces):
    raise SystemExit("Mapped vertices/indices differ from the selected GLB")
if len(faces) != len(fallback) or np.any(faces >= len(positions)):
    raise SystemExit("Invalid mapped triangle index or fallback mask")

normal_accessor = attributes.get("NORMAL")
if normal_accessor is None:
    raise SystemExit("Target GLB has no normals to preserve")
normals = read_accessor(normal_accessor, 3, "<f4")
old_colours = None
if "COLOR_0" in attributes:
    old_colours = read_accessor(attributes["COLOR_0"], 3, "<f4")

# A quantized UV key merges numerically equivalent samples while retaining real
# atlas seams. The fallback bit prevents a source-mapped and unpainted corner
# from sharing an incompatible material vertex.
corner_ids = faces.reshape(-1).astype(np.int64)
corner_uv = face_uv.reshape(-1, 2).copy()
corner_fallback = np.repeat(fallback, 3)
corner_uv[corner_fallback] = 0
uv_quantized = np.rint(corner_uv * 10_000_000).astype(np.int64)
keys = np.column_stack((corner_ids, uv_quantized, corner_fallback.astype(np.int64)))
unique_keys, inverse = np.unique(keys, axis=0, return_inverse=True)
source_ids = unique_keys[:, 0].astype(np.int64)
new_positions = positions[source_ids]
new_normals = normals[source_ids]
new_uv = unique_keys[:, 1:3].astype(np.float32) / 10_000_000.0
# Mapped UVs came through Trimesh, which flips V on GLB import. Convert back
# to the raw glTF convention when writing TEXCOORD_0 into a new GLB.
new_uv[:, 1] = 1.0 - new_uv[:, 1]
new_fallback = unique_keys[:, 3].astype(bool)
new_colours = np.ones((len(unique_keys), 3), dtype=np.float32)
if old_colours is not None:
    new_colours[new_fallback] = old_colours[source_ids[new_fallback]]
if args.neutral_engineered_surfaces:
    # These are newly engineered cut/seat faces, not sampled provider scenery.
    new_colours[new_fallback] = [0.18,0.15,0.11]
    new_colours[new_fallback & (new_positions[:,1] > 63)] = [0.20,0.105,0.045]

new_faces = inverse.reshape(-1, 3).astype(np.uint32)
mapped_faces = new_faces[~fallback]
fallback_faces = new_faces[fallback]
if len(mapped_faces) == 0:
    raise SystemExit("No source-mapped faces to texture")


def align4() -> None:
    binary.extend(b"\0" * ((-len(binary)) % 4))


def append_accessor(array: np.ndarray, gltf_type: str, target: int, component: int = 5126) -> int:
    align4()
    offset = len(binary)
    contiguous = np.ascontiguousarray(array)
    payload = contiguous.tobytes()
    binary.extend(payload)
    view = {"buffer": 0, "byteOffset": offset, "byteLength": len(payload), "target": target}
    doc["bufferViews"].append(view)
    view_index = len(doc["bufferViews"]) - 1
    accessor = {"bufferView": view_index, "componentType": component,
                "count": int(len(array)), "type": gltf_type}
    if gltf_type == "VEC3" and component == 5126:
        accessor["min"] = contiguous.min(axis=0).astype(float).tolist()
        accessor["max"] = contiguous.max(axis=0).astype(float).tolist()
    doc["accessors"].append(accessor)
    return len(doc["accessors"]) - 1


position_i = append_accessor(new_positions, "VEC3", 34962)
normal_i = append_accessor(new_normals, "VEC3", 34962)
uv_i = append_accessor(new_uv, "VEC2", 34962)
colour_i = append_accessor(new_colours, "VEC3", 34962)
mapped_index_i = append_accessor(mapped_faces.reshape(-1), "SCALAR", 34963, component=5125)
fallback_index_i = append_accessor(fallback_faces.reshape(-1), "SCALAR", 34963, component=5125) if len(fallback_faces) else None

atlas_bytes = args.atlas.read_bytes()
mime = "image/png" if args.atlas.suffix.lower() == ".png" else "image/jpeg"
images = doc.setdefault("images", [])
textures = doc.setdefault("textures", [])
samplers = doc.setdefault("samplers", [])
samplers.append({"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497})
images.append({"uri": f"data:{mime};base64," + base64.b64encode(atlas_bytes).decode("ascii"), "mimeType": mime})
textures.append({"sampler": len(samplers) - 1, "source": len(images) - 1})
texture_index = len(textures) - 1
materials = doc.setdefault("materials", [])
materials.append({"pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1],
                                          "baseColorTexture": {"index": texture_index},
                                          "metallicFactor": 0, "roughnessFactor": 1},
                  "doubleSided": True})
texture_material = len(materials) - 1
if old_colours is not None:
    materials.append({"pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1],
                                               "metallicFactor": 0, "roughnessFactor": 1},
                      "doubleSided": True})
    fallback_material = len(materials) - 1
else:
    fallback_material = 0

primitives = [{"attributes": {"POSITION": position_i, "NORMAL": normal_i, "TEXCOORD_0": uv_i},
               "indices": mapped_index_i, "material": texture_material, "mode": 4}]
if fallback_index_i is not None:
    primitives.append({"attributes": {"POSITION": position_i, "NORMAL": normal_i, "COLOR_0": colour_i},
                       "indices": fallback_index_i, "material": fallback_material, "mode": 4})
doc["meshes"][0]["primitives"] = primitives
doc["buffers"][0]["byteLength"] = len(binary)

# Prove both material groups retain their original triangle coordinates and order.
expanded = positions[faces]
for mask, output_indices in ((~fallback, mapped_faces), (fallback, fallback_faces)):
    if len(output_indices) and not np.array_equal(new_positions[output_indices], expanded[mask]):
        raise SystemExit("Expanded GLB changed triangle positions or winding")

json_bytes = json.dumps(doc, separators=(",", ":")).encode("utf-8")
json_bytes += b" " * ((-len(json_bytes)) % 4)
binary.extend(b"\0" * ((-len(binary)) % 4))
total = 12 + 8 + len(json_bytes) + 8 + len(binary)
output = bytearray(total)
output[:4] = b"glTF"
struct.pack_into("<II", output, 4, 2, total)
struct.pack_into("<II", output, 12, len(json_bytes), 0x4E4F534A)
output[20:20 + len(json_bytes)] = json_bytes
bin_header = 20 + len(json_bytes)
struct.pack_into("<II", output, bin_header, len(binary), 0x004E4942)
output[bin_header + 8:] = binary
args.output_glb.parent.mkdir(parents=True, exist_ok=True)
args.output_glb.write_bytes(output)

report = {"targetGlbSha256": sha(args.target_glb), "mappedMeshSha256": sha(args.mapped_mesh),
          "atlasSha256": sha(args.atlas), "outputGlbSha256": sha(args.output_glb),
          "geometryUnchanged": True, "faces": int(len(faces)), "mappedFaces": int((~fallback).sum()),
          "fallbackFaces": int(fallback.sum()), "originalVertices": int(len(positions)),
          "uvSeamSplitVertices": int(len(unique_keys) - len(positions)),
          "outputBytes": int(args.output_glb.stat().st_size), "physicalFitVerified": False,
          "visualReviewPending": True}
report['neutralEngineeredSurfaces'] = args.neutral_engineered_surfaces
report_path = args.report or args.output_glb.with_suffix(".texture-application.json")
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
