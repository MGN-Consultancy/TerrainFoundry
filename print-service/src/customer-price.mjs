// A deliberate allowlist: never expose supplier costs, margins or tariff assumptions.
export function customerPrice(p){
 const e=p.estimate,legacyTariff=!!e&&!Number.isInteger(e.assumptions?.materialMarkupBasisPoints);
 const filamentPence=e&&!legacyTariff?e.filamentCostPence+e.markupPence:null;
 const machinePence=e&&!legacyTariff?e.machineCostPence:null;
 const handlingPence=e&&!legacyTariff?p.piecePence+p.setupPence:null;
 const before=p.printBeforeDiscountPence??p.printPence;
 return {currency:p.currency,rateVersion:p.rateVersion,basis:p.basis,pieceCount:p.pieceCount,filamentPence,machinePence,handlingPence,legacyTariff,
  minimumAdjustmentPence:filamentPence===null?0:Math.max(0,before-filamentPence-machinePence-handlingPence),minimumApplied:p.minimumApplied,
  printBeforeDiscountPence:before,printPence:p.printPence,discountPence:p.discountPence||0,discount:p.discount?{code:p.discount.code}:null,shippingPence:p.shippingPence,vatPence:p.vatPence,totalPence:p.totalPence,
  estimate:e?{estimated:true,material:e.material,printer:e.printer,grams:e.grams,hours:e.hours,notice:e.notice}:null};
}
