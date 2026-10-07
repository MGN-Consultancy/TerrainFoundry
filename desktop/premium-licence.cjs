// Usage conditions from the purchase licence, without pack-specific sales copy.
const version='2026-10-07-activation-1';
const text=`Terrain Foundry Premium Scenery — usage terms
Version ${version}

Licensor: MGN CONSULTANCY LIMITED, company 10420886
176 Gosport Road, Fareham, PO16 0QJ, United Kingdom
Support: nigel.webster@mgnconsultancy.co.uk

1. Your licence
Your pack purchase or authorised complimentary grant permits two simultaneously activated PCs. Installed scenery, scenes and worlds work offline. Internet is required for activation and downloads. Contact support for a replacement activation without an additional licence charge.

2. Permitted use
You may use and modify the original scenery for your own games, share screenshots and videos of your scenes, and print physical models for personal use, gifts or sale. A printing service may use your supplied files solely to fulfil your print order and must not retain or redistribute them. You may keep backups for your own use.

3. Digital files and activation codes
You may not share, give away, upload, redistribute, sublicense or resell the original digital models, textures, STL files or modified digital derivatives. Do not share activation codes or provide downloads to others. Ownership of the original scenery remains with MGN Consultancy. This licence does not cover unrelated third-party models.

4. OpenLOCK components
OpenLOCK fixtures are separate from our original scenery and retain their own applicable notices and permissions. This scenery licence does not restrict rights granted independently under those notices. MGN's commercial OpenLOCK licence is non-transferable and is not assigned to you. Preserve included OpenLOCK notices when applicable.
Attribution: https://www.printablescenery.com/
MGN grant: https://www.printablescenery.com/2026/10/01/mgn-consultancy/
Printable Scenery does not endorse this product.

5. Printing and support
STL files contain geometry, not colours or printer settings. Results vary with printer calibration, material and settings. Print a clip/connection test first; digital geometry checks are not physical fit verification. No physical product is included with the digital pack.

6. Your purchase rights
The pack contents, price and digital-supply conditions agreed at purchase remain in your purchase licence and receipt. This activation acceptance does not replace that contract or remove your statutory rights for faulty, misdescribed or unusable digital content. Contact support with your order reference for assistance or an appropriate repair, replacement or refund. There is no subscription or renewal charge.

7. Privacy and local projects
PayPal handles payment details. We retain purchase email, order and licence records to deliver the product and support activation; Terrain Foundry holds no card details. Buying or activating a pack does not upload your scenes or worlds. Optional online AI is a separate choice. A record of the usage-terms version you accept is saved locally with your activation records.`;
function requireAcceptance(value){
 if(!value||typeof value!=='object'||value.acceptLicence!==true||value.licenceVersion!==version)throw Error('Read and accept the scenery licence before activating this pack.');
 return value.code;
}
module.exports={version,text,requireAcceptance};
