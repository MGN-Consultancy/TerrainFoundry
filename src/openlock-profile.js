// CC BY-NC 4.0: adapted from caitlynb/OpenSCAD-OpenLock clipcut(),
// commit 2dc0e67caffe73901902541d93baaa5d804d961c.
// Original system: Printable Scenery. Attribution and full licence:
// third-party/openlock/NOTICE.md and third-party/openlock/CLIP-LICENSE.txt.
// Ported to Manifold/Y-up, 0.2 mm layer allowance, no breakaway supports.
export function socketCut(wasm){
 const M=wasm.Manifold;
 const outline=[[-7,-2],[-7,2],[-6,2],[-5,5],[-5,7],[5,7],[5,5],[6,2],[7,2],[7,-2]];
 const profile=new wasm.CrossSection([outline.reverse()]);
 const throat=profile.extrude(4.2).rotate([0,0,90]).rotate([-90,0,0]).translate([0,1.4,0]);
 const underside=M.cube([4.7,7.6,18],true).translate([-8.35,1.8,0]);
 const allowance=M.cube([4.7,5.8,14],true).translate([-8.35,3,0]);
 const result=M.union([throat,underside,allowance]);
 profile.delete();throat.delete();underside.delete();allowance.delete();return result;
}

