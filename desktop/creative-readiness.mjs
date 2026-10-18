import {sceneryCandidateMatches} from './scenery-adapter.mjs';

export function candidateGeometryReadiness(asset, candidate = asset.model) {
  if (!candidate) return {ready:false,message:'Import or generate a model first.'};
  const modular = asset.kind === 'scenery' && (candidate.provider === 'meshy' || candidate.validation?.adapterStatus || candidate.openlock?.requested);
  if (modular && !sceneryCandidateMatches(asset.design, candidate)) {
    return {ready:false,message:'Apply the current module size and connector settings locally before accepting or placing this candidate. Its retained source and previous versions are preserved.'};
  }
  return {ready:true,adapterVerified:!!modular,physicalFitVerified:false,message:modular?'Module geometry matches the current design. Physical print fit and minimum wall thickness still need review.':'Imported model: review its dimensions and geometry before use.'};
}
